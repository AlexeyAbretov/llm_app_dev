import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import {
  appendDeployNote,
  releaseBodyHasDeployMarker,
  releasesToDeploy,
} from "./deploy-rules.js";
import { runCatalogDeploy } from "./deploy-run.js";
import { DeployStore } from "./deploy-store.js";
import { GitHubClient } from "./github.js";
import { jobLog } from "./log.js";

export function startDeployPoller(
  config: Config,
  logger: FastifyBaseLogger,
  store: DeployStore,
): { stop: () => void } {
  const github = new GitHubClient(config);
  let busy = false;

  const tick = (): void => {
    if (busy) {
      jobLog(logger, {}, "deploy poll skip: previous tick still running");
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

async function pollOnce(
  config: Config,
  logger: FastifyBaseLogger,
  store: DeployStore,
  github: GitHubClient,
): Promise<void> {
  jobLog(logger, {}, "deploy poll tick");

  if (!config.GITHUB_TOKEN || !config.GITHUB_REPO) {
    jobLog(logger, {}, "deploy poll skip: GITHUB_TOKEN or GITHUB_REPO empty");
    return;
  }

  let releases;
  try {
    releases = await github.listPublishedReleases();
  } catch (err) {
    logger.error({ err }, "github list releases failed");
    return;
  }

  const pending = releasesToDeploy(releases, store.deployedIds()).filter(
    (release) => !releaseBodyHasDeployMarker(release.body, release.id),
  );

  if (pending.length === 0) {
    jobLog(logger, {}, "deploy: no new published releases");
    return;
  }

  for (const release of pending) {
    await handleRelease(config, logger, store, github, release);
  }
}

async function applyDeployLabels(
  github: GitHubClient,
  status: "deployed" | "deploy-failed",
): Promise<number[]> {
  const labeled: number[] = [];
  const groups = await Promise.all([
    github.listOpenIssuesByLabel("release-approved"),
    github.listOpenIssuesByLabel("ready-for-release"),
  ]);
  const byNumber = new Map<number, (typeof groups)[0][0]>();
  for (const group of groups) {
    for (const issue of group) {
      byNumber.set(issue.number, issue);
    }
  }
  for (const issue of byNumber.values()) {
    if (issue.labels.includes("deployed") || issue.labels.includes("deploy-failed")) {
      continue;
    }
    await github.removeIssueLabel(issue.number, status === "deployed" ? "deploy-failed" : "deployed");
    await github.addIssueLabels(issue.number, [status]);
    labeled.push(issue.number);
  }
  return labeled;
}

async function handleRelease(
  config: Config,
  logger: FastifyBaseLogger,
  store: DeployStore,
  github: GitHubClient,
  release: {
    id: number;
    tag_name: string;
    body: string | null;
    html_url: string;
  },
): Promise<void> {
  const fields = { issue: release.id, role: "deployer", agentId: null, runId: null };
  jobLog(logger, fields, `deploy start: ${release.tag_name} (${release.html_url})`);

  const result = await runCatalogDeploy(config, release.tag_name);
  const status = result.ok ? "deployed" : "deploy-failed";

  store.record({
    releaseId: release.id,
    tag: release.tag_name,
    status,
    mode: config.DEPLOY_MODE,
    detail: result.detail,
    at: new Date().toISOString(),
  });

  try {
    await github.updateReleaseBody(
      release.id,
      appendDeployNote(release.body, release.id, status, result.detail),
    );
  } catch (err) {
    logger.error({ err, releaseId: release.id }, "github release body update failed");
  }

  try {
    const labeled = await applyDeployLabels(github, status);
    jobLog(
      logger,
      fields,
      labeled.length
        ? `labels +${status} on ${labeled.map((n) => `#${n}`).join(", ")}`
        : `no open release issues to label (${status})`,
    );
  } catch (err) {
    logger.error({ err, releaseId: release.id }, "github deploy labels failed");
  }

  jobLog(logger, fields, result.ok ? `deploy ok: ${release.tag_name}` : `deploy failed: ${release.tag_name}`);
}
