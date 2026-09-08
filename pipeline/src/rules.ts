import type { Role } from "./types.js";

export type AnalystDecision = "ready-for-dev" | "needs-human";
export type DeveloperDecision = "in-qa" | "needs-human";
export type TesterDecision = "in-qa" | "qa-passed" | "needs-human";

export function roleForLabels(labels: string[]): Role | null {
  if (labels.includes("needs-human")) {
    return null;
  }
  const hasType = labels.includes("bug") || labels.includes("feature");
  if (!hasType) {
    return null;
  }
  if (labels.includes("needs-plan") && !labels.includes("ready-for-dev")) {
    return "analyst";
  }
  if (
    labels.includes("ready-for-dev") &&
    !labels.includes("needs-plan") &&
    !labels.includes("in-qa")
  ) {
    return "developer";
  }
  if (
    labels.includes("in-qa") &&
    !labels.includes("qa-in-progress") &&
    !labels.includes("qa-passed") &&
    !labels.includes("ready-for-release")
  ) {
    return "tester";
  }
  return null;
}

export function decideAnalystOutcome(
  runStatus: "finished" | "error" | "startup_error",
  resultText: string | null,
): AnalystDecision {
  if (runStatus !== "finished") {
    return "needs-human";
  }

  const marker = resultText?.match(/PIPELINE_LABELS:\s*(needs-human|ready-for-dev)/i);
  if (marker) {
    return marker[1].toLowerCase() as AnalystDecision;
  }

  if (resultText && /needs-human/i.test(resultText)) {
    return "needs-human";
  }

  return "ready-for-dev";
}

export function decideDeveloperOutcome(
  runStatus: "finished" | "error" | "startup_error",
  hasOpenFixPr: boolean,
): DeveloperDecision {
  if (hasOpenFixPr) {
    return "in-qa";
  }
  if (runStatus !== "finished") {
    return "needs-human";
  }
  return "needs-human";
}

export function decideTesterOutcome(
  runStatus: "finished" | "error" | "startup_error",
  resultText: string | null,
  bugIssues: number[] | null,
): TesterDecision {
  if (runStatus !== "finished") {
    return "needs-human";
  }
  const marker = resultText?.match(
    /^PIPELINE_LABELS:\s*(needs-human|in-qa|qa-passed)\s*$/im,
  );
  if (!marker || bugIssues === null) {
    return "needs-human";
  }
  const requested = marker[1].toLowerCase() as TesterDecision;
  if (requested === "needs-human") {
    return "needs-human";
  }
  if (bugIssues.length === 0 && requested === "qa-passed") {
    return "qa-passed";
  }
  if (bugIssues.length > 0 && requested === "in-qa") {
    return "in-qa";
  }
  return "needs-human";
}

export function testerBugIssues(resultText: string | null): number[] | null {
  const marker = resultText?.match(
    /^PIPELINE_BUG_ISSUES:\s*(none|(?:#?\d+(?:\s*,\s*#?\d+)*))\s*$/im,
  );
  if (!marker) {
    return null;
  }
  if (marker[1].toLowerCase() === "none") {
    return [];
  }
  return [
    ...new Set(
      marker[1]
        .split(",")
        .map((value) => Number(value.trim().replace(/^#/, "")))
        .filter((value) => Number.isSafeInteger(value) && value > 0),
    ),
  ];
}

export function prFixesIssue(pr: {
  title: string;
  body: string | null;
  headRef: string;
}, issue: number): boolean {
  const text = `${pr.title}\n${pr.body ?? ""}`;
  const keywords = new RegExp(
    `(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${issue}\\b`,
    "i",
  );
  if (keywords.test(text)) {
    return true;
  }
  return new RegExp(`^issue/${issue}(?:-|$)`).test(pr.headRef);
}
