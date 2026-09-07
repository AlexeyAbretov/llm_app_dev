import type { Role } from "./types.js";

export type AnalystDecision = "ready-for-dev" | "needs-human";

export function roleForLabels(labels: string[]): Role | null {
  if (labels.includes("needs-human")) {
    return null;
  }
  const hasType = labels.includes("bug") || labels.includes("feature");
  if (
    hasType &&
    labels.includes("needs-plan") &&
    !labels.includes("ready-for-dev")
  ) {
    return "analyst";
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
