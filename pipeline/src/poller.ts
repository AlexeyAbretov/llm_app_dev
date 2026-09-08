import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import { runCloudAgent } from "./cursor.js";
import { GitHubClient, agentResultComment, jobComment, type GitHubIssue, type GitHubPull } from "./github.js";
import { JobStore } from "./jobs.js";
import { jobLog } from "./log.js";
import {
  childBugStillOpen,
  decideAnalystOutcome,
  decideDeveloperOutcome,
  decideReleaseManagerOutcome,
  decideTesterOutcome,
  fixRoundBlocksDeveloper,
  MAX_FIX_ROUNDS,
  parseChildBugIssues,
  parseFixRound,
  releaseChangelog,
  releasePrNumbers,
  releaseTag,
  roleForLabels,
  testerBugIssues,
  upsertChildBugIssuesInBody,
  upsertFixRoundInBody,
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
  store: JobStore,
  parent: GitHubIssue,
  bugIssues: number[],
): Promise<number[]> {
  const children = bugIssues.filter((number) => number !== parent.number);
  if (children.length !== bugIssues.length) {
    throw new Error("tester marked the parent issue as a child bug");
  }
  for (const issue of children) {
    // Новый круг плана: сбросить джобы и state-метки, только bug + needs-plan.
    store.removeRoles(issue, ["analyst", "developer", "tester", "release-manager"]);
    await github.removeIssueLabel(issue, "ready-for-dev");
    await github.removeIssueLabel(issue, "in-dev");
    await github.removeIssueLabel(issue, "in-qa");
    await github.removeIssueLabel(issue, "qa-in-progress");
    await github.removeIssueLabel(issue, "qa-passed");
    await github.addIssueLabels(issue, ["bug", "needs-plan"]);
  }
  const merged = [...new Set([...parseChildBugIssues(parent.body), ...children])];
  await github.updateIssueBody(
    parent.number,
    upsertChildBugIssuesInBody(parent.body, merged),
  );
  return children;
}

async function childBugsBlockingReQa(
  github: GitHubClient,
  parentBody: string | null,
): Promise<number[]> {
  const children = parseChildBugIssues(parentBody);
  const blocking: number[] = [];
  for (const number of children) {
    const child = await github.getIssue(number);
    if (childBugStillOpen(child.labels, child.state)) {
      blocking.push(number);
    }
  }
  return blocking;
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
    if (fixRoundBlocksDeveloper(issue.body)) {
      try {
        await applyDeveloperLabels(github, issue.number, "needs-human");
        await github.commentOnIssue(
          issue.number,
          `Пайплайн: лимит \`fix-round\` (${MAX_FIX_ROUNDS}) исчерпан — разработчик не стартует, нужен человек.`,
        );
        jobLog(logger, fields, `labels: fix-round limit → needs-human`);
      } catch (err) {
        logger.error({ err, issue: issue.number }, "fix-round limit labels failed");
      }
      return;
    }

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

  if (role === "tester") {
    try {
      const blocking = await childBugsBlockingReQa(github, issue.body);
      if (blocking.length > 0) {
        jobLog(
          logger,
          fields,
          `skip tester: waiting for child bugs ${blocking.map((n) => `#${n}`).join(", ")}`,
        );
        return;
      }
      if (parseChildBugIssues(issue.body).length > 0 && store.find(issue.number, "tester")) {
        store.remove(issue.number, "tester");
        jobLog(logger, fields, "cleared tester job for re-QA after child bugs");
      }
    } catch (err) {
      logger.error({ err, issue: issue.number }, "child bug status check failed");
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
    const nextRound = (parseFixRound(issue.body) ?? 0) + 1;
    try {
      const body = upsertFixRoundInBody(issue.body, nextRound);
      await github.updateIssueBody(issue.number, body);
      issue = { ...issue, body };
      jobLog(logger, fields, `fix-round: ${nextRound}`);
    } catch (err) {
      store.update(job.id, { status: "startup_error", error: "failed to set fix-round" });
      logger.error({ err, issue: issue.number }, "fix-round update failed");
      try {
        await applyDeveloperLabels(github, issue.number, "needs-human");
      } catch (labelErr) {
        logger.error({ err: labelErr, issue: issue.number }, "github fallback labels failed");
      }
      return;
    }
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
        const bugs = await labelTesterBugs(github, store, issue, bugIssues ?? []);
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

  if (decision) {
    store.update(job.id, { decision });
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
