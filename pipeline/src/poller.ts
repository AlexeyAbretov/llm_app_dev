import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import { runCloudAgent } from "./cursor.js";
import { GitHubClient, agentResultComment, jobComment, type GitHubIssue, type GitHubPull } from "./github.js";
import { JobStore } from "./jobs.js";
import { jobLog } from "./log.js";
import {
  decideAnalystOutcome,
  decideDeveloperOutcome,
  decideReleaseManagerOutcome,
  decideTesterOutcome,
  releaseChangelog,
  releasePrNumbers,
  releaseTag,
  roleForLabels,
  testerBugIssues,
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
        github.listOpenIssuesByLabel("in-qa"),
        github.listOpenIssuesByLabel("qa-passed"),
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
        "skip: labels do not match a pipeline role trigger",
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

async function applyTesterLabels(
  github: GitHubClient,
  issue: number,
  decision: "in-qa" | "qa-passed" | "needs-human",
): Promise<void> {
  await github.removeIssueLabel(issue, "in-qa");
  await github.removeIssueLabel(issue, "qa-in-progress");
  await github.addIssueLabels(issue, [decision]);
}

async function labelTesterBugs(
  github: GitHubClient,
  parentIssue: number,
  bugIssues: number[],
): Promise<number[]> {
  const children = bugIssues.filter((number) => number !== parentIssue);
  if (children.length !== bugIssues.length) {
    throw new Error("tester marked the parent issue as a child bug");
  }
  for (const issue of children) {
    await github.addIssueLabels(issue, ["bug", "needs-plan"]);
  }
  return children;
}

async function applyReleasePackage(
  github: GitHubClient,
  issue: number,
  tag: string,
  prNumbers: number[],
  changelog: string,
): Promise<string> {
  const owner = github.releaseOwnerLogin();
  await github.setIssueAssignees(issue, [owner]);
  for (const pr of prNumbers) {
    await github.requestPullReviewers(pr, [owner]);
  }
  const release = await github.upsertDraftRelease({
    tag,
    name: tag,
    body: changelog,
  });
  await github.addIssueLabels(issue, ["ready-for-release"]);
  return release.html_url;
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

  let linkedPull: GitHubPull | undefined;
  if (role === "tester" || role === "release-manager") {
    try {
      linkedPull = (await github.findOpenFixPr(issue.number)) ?? undefined;
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github pulls failed");
      return;
    }
    if (role === "tester" && !linkedPull) {
      jobLog(logger, fields, "skip tester: no open Fixes PR");
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
  if (role === "tester") {
    try {
      await github.removeIssueLabel(issue.number, "in-qa");
      await github.addIssueLabels(issue.number, ["qa-in-progress"]);
      jobLog(logger, fields, "labels: -in-qa +qa-in-progress");
    } catch (err) {
      store.update(job.id, {
        status: "startup_error",
        error: "failed to set qa-in-progress",
      });
      logger.error({ err, issue: issue.number }, "github QA labels failed");
      try {
        await applyTesterLabels(github, issue.number, "needs-human");
      } catch (labelErr) {
        logger.error({ err: labelErr, issue: issue.number }, "github fallback labels failed");
      }
      return;
    }
  }
  jobLog(logger, { ...fields }, "cursor agent starting");

  const outcome = await runCloudAgent(
    config,
    role,
    issue,
    async ({ agentId, runId }) => {
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
    },
    linkedPull,
  );

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
    const developerDecision = decideDeveloperOutcome(outcome.status, hasPr);
    decision = developerDecision;
    try {
      await applyDeveloperLabels(github, issue.number, developerDecision);
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

  if (role === "tester") {
    const bugIssues = testerBugIssues(outcome.resultText);
    let testerDecision = decideTesterOutcome(
      outcome.status,
      outcome.resultText,
      bugIssues,
    );
    if (testerDecision === "in-qa") {
      try {
        const bugs = await labelTesterBugs(github, issue.number, bugIssues ?? []);
        jobLog(
          logger,
          {
            issue: issue.number,
            role,
            agentId: outcome.agentId,
            runId: outcome.runId,
          },
          bugs.length
            ? `labeled tester bugs: ${bugs.map((number) => `#${number}`).join(", ")}`
            : "tester reported no bugs",
        );
      } catch (err) {
        testerDecision = "needs-human";
        logger.error({ err, issue: issue.number }, "tester bug handoff failed");
      }
    }
    decision = testerDecision;
    try {
      await applyTesterLabels(github, issue.number, testerDecision);
      jobLog(
        logger,
        {
          issue: issue.number,
          role,
          agentId: outcome.agentId,
          runId: outcome.runId,
        },
        `labels: -qa-in-progress +${testerDecision}`,
      );
    } catch (err) {
      logger.error({ err, issue: issue.number }, "github labels failed");
    }
  }

  if (role === "release-manager") {
    const tag = releaseTag(outcome.resultText);
    const prNumbers = releasePrNumbers(outcome.resultText);
    const changelog = releaseChangelog(outcome.resultText);
    let releaseDecision = decideReleaseManagerOutcome(
      outcome.status,
      outcome.resultText,
      tag,
      prNumbers,
      changelog,
    );
    if (releaseDecision === "ready-for-release" && tag && prNumbers && changelog) {
      try {
        const releaseUrl = await applyReleasePackage(
          github,
          issue.number,
          tag,
          prNumbers,
          changelog,
        );
        jobLog(
          logger,
          {
            issue: issue.number,
            role,
            agentId: outcome.agentId,
            runId: outcome.runId,
          },
          `draft release ${tag}: ${releaseUrl}; +ready-for-release`,
        );
      } catch (err) {
        releaseDecision = "needs-human";
        logger.error({ err, issue: issue.number }, "release package failed");
      }
    }
    decision = releaseDecision;
    if (releaseDecision === "needs-human") {
      try {
        await github.addIssueLabels(issue.number, ["needs-human"]);
        jobLog(
          logger,
          {
            issue: issue.number,
            role,
            agentId: outcome.agentId,
            runId: outcome.runId,
          },
          "labels: +needs-human",
        );
      } catch (err) {
        logger.error({ err, issue: issue.number }, "github labels failed");
      }
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
