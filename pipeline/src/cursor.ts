import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import type { Config } from "./config.js";
import type { GitHubIssue } from "./github.js";
import type { Role } from "./types.js";

export type CursorRunOutcome = {
  agentId: string | null;
  runId: string | null;
  status: "finished" | "error" | "startup_error";
  error: string | null;
};

function loadPrompt(promptsDir: string, role: Role): string {
  return readFileSync(join(promptsDir, `${role}.md`), "utf8");
}

function buildMessage(rolePrompt: string, issue: GitHubIssue): string {
  return [
    rolePrompt.trim(),
    "",
    "## Issue",
    `Номер: #${issue.number}`,
    `URL: ${issue.html_url}`,
    `Заголовок: ${issue.title}`,
    "",
    issue.body?.trim() || "(пустое описание)",
  ].join("\n");
}

export async function runCloudAgent(
  config: Config,
  role: Role,
  issue: GitHubIssue,
  onStarted: (ids: { agentId: string; runId: string }) => Promise<void>,
): Promise<CursorRunOutcome> {
  let agentId: string | null = null;
  let runId: string | null = null;

  try {
    await using agent = await Agent.create({
      apiKey: config.CURSOR_API_KEY,
      model: { id: config.CURSOR_MODEL },
      cloud: {
        repos: [{ url: config.CURSOR_REPO_URL, startingRef: config.CURSOR_STARTING_REF }],
        skipReviewerRequest: true,
        autoCreatePR: false,
        metadata: {
          issue: String(issue.number),
          role,
        },
      },
    });

    agentId = agent.agentId;
    const run = await agent.send(buildMessage(loadPrompt(config.PROMPTS_DIR, role), issue));
    runId = run.id;
    await onStarted({ agentId, runId });

    const result = await run.wait();
    if (result.status === "error") {
      return {
        agentId,
        runId,
        status: "error",
        error: result.error?.message ?? "run.status=error",
      };
    }
    if (result.status === "cancelled") {
      return { agentId, runId, status: "error", error: "run cancelled" };
    }
    return { agentId, runId, status: "finished", error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable =
      err instanceof CursorAgentError ? ` retryable=${String(err.isRetryable)}` : "";
    const status = runId ? "error" : "startup_error";
    return {
      agentId,
      runId,
      status,
      error: `${message}${retryable}`,
    };
  }
}
