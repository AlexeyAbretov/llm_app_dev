import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import { runCloudAgent } from "./cursor.js";
import { GitHubClient, agentResultComment, jobComment, type GitHubIssue } from "./github.js";
import { JobStore } from "./jobs.js";
import { jobLog } from "./log.js";
import {
  decideAnalystOutcome,
  decideDeveloperOutcome,
  roleForLabels,
} from "./rules.js";
import type { Role } from "./types.js";

export function startPoller(
  config: Config,
  logger: FastifyBaseLogger,
  store: JobStore,
): { stop: () => void } {
  const github = new GitHubClient(config);
  let busy = false;

  const tick = (): void => {
    if (busy) {
      jobLog(logger, {}, "poll skip: previous tick still running");
      return;
    }
    busy = true;
    void pollOnce(config, logger, store, github).finally(() => {
      busy = false;
    });
  };

  tick();
  const timer = setInterval(tick, config.POLL_INTERVAL_MS);
  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}

function mergeIssues(groups: GitHubIssue[][]): GitHubIssue[] {
  const byNumber = new Map<number, GitHubIssue>();
  for (const group of groups) {
    for (const issue of group) {
      byNumber.set(issue.number, issue);
    }
  }
  return [...byNumber.values()];
}

async function pollOnce(
  config: Config,
  logger: FastifyBaseLogger,
  store: JobStore,
  github: GitHubClient,
): Promise<void> {
  jobLog(logger, {}, "poll tick");

  if (!config.GITHUB_TOKEN || !config.GITHUB_REPO) {
    jobLog(logger, {}, "poll skip: GITHUB_TOKEN or GITHUB_REPO empty");
    return;
  }

  const pollStartedAt = new Date().toISOString();
  let issues: GitHubIssue[];
  try {
    issues = mergeIssues(
      await Promise.all([
        github.listOpenIssuesByLabel("needs-plan"),
        github.listOpenIssuesByLabel("ready-for-dev"),
      ]),
    );
  } catch (err) {
    logger.error({ err }, "github list failed");
    return;
  }

  for (const issue of issues) {
    const role = roleForLabels(issue.labels);
    if (!role) {
      jobLog(
        logger,
        { issue: issue.number, role: null, agentId: null, runId: null },
        "skip: labels do not match analyst or developer trigger",
      );
      continue;
    }
    await handleIssue(config, logger, store, github, issue, role);
  }

  store.setLastPollAt(pollStartedAt);
}

async function applyDeveloperLabels(
  github: GitHubClient,
  issue: number,
  decision: "in-qa" | "needs-human",
): Promise<void> {
  await github.removeIssueLabel(issue, "in-dev");
  await github.removeIssueLabel(issue, "ready-for-dev");
  await github.addIssueLabels(issue, [decision]);
}

async function handleIssue(
  config: Config,
  logger: FastifyBaseLogger,
  store: JobStore,
  github: GitHubClient,
  issue: GitHubIssue,
  role: Role,
): Promise<void> {
  const fields = { issue: issue.number, role, agentId: null, runId: null };

  if (role === "developer") {
    let hasPr = false;
    try {
      hasPr = await github.hasOpenFixPr(issue.number);
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github pulls failed");
      return;
    }
    if (hasPr) {
      try {
        await applyDeveloperLabels(github, issue.number, "in-qa");
        jobLog(logger, fields, "labels: PR already open → in-qa");
      } catch (err) {
        logger.error({ err, issue: issue.number }, "github labels failed");
      }
      return;
    }
  }

  if (store.find(issue.number, role)) {
    jobLog(logger, fields, "skip existing job");
    return;
  }

  if (!config.CURSOR_API_KEY || !config.CURSOR_REPO_URL) {
    jobLog(logger, fields, "poll skip: CURSOR_API_KEY or CURSOR_REPO_URL empty");
    return;
  }

  const job = store.create(issue.number, role);
  if (!job) {
    jobLog(logger, fields, "skip existing job");
    return;
  }

  store.update(job.id, { status: "running" });
  if (role === "developer") {
    try {
      await github.addIssueLabels(issue.number, ["in-dev"]);
      jobLog(logger, fields, "labels: +in-dev");
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github labels failed");
    }
  }
  jobLog(logger, { ...fields }, "cursor agent starting");

  const outcome = await runCloudAgent(config, role, issue, async ({ agentId, runId }) => {
    store.update(job.id, { agentId, runId });
    jobLog(logger, { issue: issue.number, role, agentId, runId }, "cursor run started");
    try {
      await github.commentOnIssue(
        issue.number,
        jobComment({
          jobId: job.id,
          role,
          agentId,
          runId,
          status: "running",
        }),
      );
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github comment failed");
    }
  });

  const status = outcome.status === "finished" ? "finished" : outcome.status;
  store.update(job.id, {
    status,
    agentId: outcome.agentId,
    runId: outcome.runId,
    error: outcome.error,
  });
  jobLog(
    logger,
    {
      issue: issue.number,
      role,
      agentId: outcome.agentId,
      runId: outcome.runId,
    },
    outcome.status === "finished" ? "cursor run finished" : "cursor run failed",
  );

  let decision: string | null = null;
  if (role === "analyst") {
    decision = decideAnalystOutcome(outcome.status, outcome.resultText);
    try {
      await github.removeIssueLabel(issue.number, "needs-plan");
      await github.addIssueLabels(issue.number, [decision]);
      jobLog(
        logger,
        {
          issue: issue.number,
          role,
          agentId: outcome.agentId,
          runId: outcome.runId,
        },
        `labels: -needs-plan +${decision}`,
      );
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github labels failed");
    }
  }

  if (role === "developer") {
    let hasPr = false;
    try {
      hasPr = await github.hasOpenFixPr(issue.number);
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github pulls failed");
    }
    decision = decideDeveloperOutcome(outcome.status, hasPr);
    try {
      await applyDeveloperLabels(github, issue.number, decision);
      jobLog(
        logger,
        {
          issue: issue.number,
          role,
          agentId: outcome.agentId,
          runId: outcome.runId,
        },
        `labels: -ready-for-dev -in-dev +${decision}`,
      );
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github labels failed");
    }
  }

  try {
    await github.commentOnIssue(
      issue.number,
      jobComment({
        jobId: job.id,
        role,
        agentId: outcome.agentId,
        runId: outcome.runId,
        status: outcome.status,
        error: outcome.error,
        decision,
      }),
    );
  } catch (err) {
    logger.error({ err, issue: issue.number }, "github comment failed");
  }

  if (outcome.resultText?.trim()) {
    try {
      await github.commentOnIssue(issue.number, agentResultComment(role, outcome.resultText));
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github plan comment failed");
    }
  }
}
