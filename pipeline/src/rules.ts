import type { Role } from "./types.js";

export type AnalystDecision = "ready-for-dev" | "needs-human";
export type DeveloperDecision = "in-qa" | "needs-human";

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
