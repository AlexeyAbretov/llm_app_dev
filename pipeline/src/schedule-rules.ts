/** YYYY-MM-DD in UTC for GitHub milestone due_on comparison. */
export function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isMilestoneDueOn(dueOn: string | null | undefined, today: Date = new Date()): boolean {
  if (!dueOn) {
    return false;
  }
  const day = dueOn.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day === utcDateString(today);
}

/**
 * Milestone title → expected git/release tag.
 * Accepts `v0.3`, `v0.3.0`, `0.3.0` (adds `v` if missing).
 */
export function tagFromMilestoneTitle(title: string): string | null {
  const trimmed = title.trim();
  const semver = trimmed.match(/^v?(\d+\.\d+(?:\.\d+)?)$/i);
  if (semver) {
    return `v${semver[1]}`;
  }
  if (/^v[\w.-]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function blockedNoTagMarker(milestoneId: number): string {
  return `<!-- pipeline:blocked-no-tag:${milestoneId} -->`;
}

export function bodyHasBlockedNoTagMarker(body: string | null, milestoneId: number): boolean {
  if (!body) {
    return false;
  }
  return body.includes(blockedNoTagMarker(milestoneId));
}

export function blockedNoTagComment(milestoneTitle: string, milestoneId: number): string {
  return [
    blockedNoTagMarker(milestoneId),
    `Пайплайн: milestone \`${milestoneTitle}\` due сегодня, но **tag / published Release нет**.`,
    "`blocked: no tag` — локальный compose / deployer не запускается.",
    "Создайте tag и Publish Release (после `release-approved`), затем дождитесь deployer.",
  ].join("\n");
}
