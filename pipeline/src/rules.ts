import type { Role } from "./types.js";

export function roleForLabels(labels: string[]): Role | null {
  if (labels.includes("needs-human")) {
    return null;
  }
  if (labels.includes("needs-plan") && !labels.includes("ready-for-dev")) {
    return "analyst";
  }
  return null;
}
