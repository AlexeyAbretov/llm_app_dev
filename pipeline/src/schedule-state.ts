import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type StoreFile = {
  /** Milestone ids that already received blocked: no tag comments. */
  blockedNotified: number[];
};

export class ScheduleStateStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "schedule-state.json");
  }

  load(): StoreFile {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as StoreFile;
    } catch {
      return { blockedNotified: [] };
    }
  }

  private save(data: StoreFile): void {
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  wasBlockedNotified(milestoneId: number): boolean {
    return this.load().blockedNotified.includes(milestoneId);
  }

  markBlockedNotified(milestoneId: number): void {
    const data = this.load();
    if (!data.blockedNotified.includes(milestoneId)) {
      data.blockedNotified.push(milestoneId);
      this.save(data);
    }
  }
}
