import type { FastifyBaseLogger } from "fastify";
import type { Config } from "./config.js";
import { DeployRequestStore } from "./deploy-request-store.js";
import { DeployStore } from "./deploy-store.js";
import { GitHubClient } from "./github.js";
import { jobLog } from "./log.js";
import {
  blockedNoTagComment,
  isMilestoneDueOn,
  tagFromMilestoneTitle,
} from "./schedule-rules.js";
import { ScheduleStateStore } from "./schedule-state.js";

export function startSchedulePoller(
  config: Config,
  logger: FastifyBaseLogger,
): { stop: () => void } {
  const github = new GitHubClient(config);
  const deployStore = new DeployStore(config.DATA_DIR);
  const requests = new DeployRequestStore(config.DATA_DIR);
  const state = new ScheduleStateStore(config.DATA_DIR);
  let busy = false;

  const tick = (): void => {
    if (busy) {
      jobLog(logger, {}, "schedule skip: previous tick still running");
      return;
    }
    busy = true;
    void scheduleOnce(config, logger, github, deployStore, requests, state).finally(() => {
      busy = false;
    });
  };

  tick();
  const timer = setInterval(tick, config.SCHEDULE_INTERVAL_MS);
  return {
    stop: () => {
      clearInterval(timer);
    },
  };
}

async function scheduleOnce(
  config: Config,
  logger: FastifyBaseLogger,
  github: GitHubClient,
  deployStore: DeployStore,
  requests: DeployRequestStore,
  state: ScheduleStateStore,
): Promise<void> {
  jobLog(logger, {}, "schedule tick");

  if (!config.GITHUB_TOKEN || !config.GITHUB_REPO) {
    jobLog(logger, {}, "schedule skip: GITHUB_TOKEN or GITHUB_REPO empty");
    return;
  }

  let milestones;
  try {
    milestones = await github.listOpenMilestones();
  } catch (err) {
    logger.error({ err }, "github milestones failed");
    return;
  }

  const due = milestones.filter((item) => isMilestoneDueOn(item.due_on));
  if (due.length === 0) {
    jobLog(logger, {}, "schedule: no milestones due today");
    return;
  }

  for (const milestone of due) {
    const fields = {
      issue: milestone.number,
      role: "schedule",
      agentId: null,
      runId: null,
    };
    const tag = tagFromMilestoneTitle(milestone.title);
    let hasTag = false;
    if (tag) {
      try {
        hasTag = await github.tagOrReleaseExists(tag);
      } catch (err) {
        logger.error({ err, milestone: milestone.title }, "tag check failed");
        continue;
      }
    }

    if (!tag || !hasTag) {
      if (state.wasBlockedNotified(milestone.id)) {
        jobLog(logger, fields, `blocked: no tag for ${milestone.title} (already notified)`);
        continue;
      }
      try {
        const issues = await github.listOpenIssuesForMilestone(milestone.number);
        let commented = 0;
        for (const issue of issues) {
          if (issue.labels.includes("deployed")) {
            continue;
          }
          await github.commentOnIssue(
            issue.number,
            blockedNoTagComment(milestone.title, milestone.id),
          );
          commented += 1;
        }
        state.markBlockedNotified(milestone.id);
        jobLog(
          logger,
          fields,
          `blocked: no tag for milestone ${milestone.title} (${commented} comments); compose not touched`,
        );
      } catch (err) {
        logger.error({ err, milestone: milestone.title }, "blocked-no-tag notify failed");
      }
      continue;
    }

    if (deployStore.hasTag(tag)) {
      jobLog(logger, fields, `schedule skip: ${tag} already in deploys.json`);
      continue;
    }

    const enqueued = requests.enqueue({
      tag,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
    });
    if (enqueued) {
      jobLog(logger, fields, `schedule: queued deploy request for ${tag}`);
    } else {
      jobLog(logger, fields, `schedule: deploy request for ${tag} already pending/done`);
    }
  }
}
