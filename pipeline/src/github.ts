import { parseOwnerRepo, type Config } from "./config.js";

export type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: string[];
};

type GitHubIssueRaw = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  pull_request?: unknown;
  labels: Array<string | { name: string }>;
};

function labelNames(labels: GitHubIssueRaw["labels"]): string[] {
  return labels.map((label) => (typeof label === "string" ? label : label.name));
}

export class GitHubClient {
  constructor(private readonly config: Config) {}

  private headers(): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.config.GITHUB_TOKEN}`,
      "User-Agent": "llm-app-dev-orchestrator",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async listNeedsPlan(since: string | null): Promise<GitHubIssue[]> {
    const parsed = parseOwnerRepo(this.config.GITHUB_REPO);
    if (!parsed) {
      throw new Error(`Invalid GITHUB_REPO: ${this.config.GITHUB_REPO}`);
    }

    const url = new URL(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues`,
    );
    url.searchParams.set("state", "open");
    url.searchParams.set("labels", "needs-plan");
    url.searchParams.set("per_page", "50");
    if (since) {
      url.searchParams.set("since", since);
    }

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub issues ${response.status}: ${text.slice(0, 500)}`);
    }

    const items = (await response.json()) as GitHubIssueRaw[];
    return items
      .filter((item) => !item.pull_request)
      .map((item) => ({
        number: item.number,
        title: item.title,
        body: item.body,
        html_url: item.html_url,
        labels: labelNames(item.labels),
      }));
  }

  async commentOnIssue(issue: number, body: string): Promise<void> {
    const parsed = parseOwnerRepo(this.config.GITHUB_REPO);
    if (!parsed) {
      throw new Error(`Invalid GITHUB_REPO: ${this.config.GITHUB_REPO}`);
    }

    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${issue}/comments`,
      {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub comment ${response.status}: ${text.slice(0, 500)}`);
    }
  }
}

export function jobComment(params: {
  jobId: string;
  role: string;
  agentId: string | null;
  runId: string | null;
  status: string;
  error?: string | null;
}): string {
  const lines = [
    `<!-- pipeline:job:${params.jobId} -->`,
    `Пайплайн: роль \`${params.role}\`, статус \`${params.status}\`.`,
    params.agentId ? `agentId: \`${params.agentId}\`` : "agentId: —",
    params.runId ? `runId: \`${params.runId}\`` : "runId: —",
  ];
  if (params.error) {
    lines.push(`Ошибка: ${params.error}`);
  }
  return lines.join("\n");
}
