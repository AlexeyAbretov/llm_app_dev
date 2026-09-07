import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Job, Role } from "./types.js";

type StoreFile = {
  lastPollAt: string | null;
  jobs: Job[];
};

export class JobStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "jobs.json");
  }

  load(): StoreFile {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as StoreFile;
    } catch {
      return { lastPollAt: null, jobs: [] };
    }
  }

  private save(data: StoreFile): void {
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  find(issue: number, role: Role): Job | undefined {
    return this.load().jobs.find((job) => job.issue === issue && job.role === role);
  }

  create(issue: number, role: Role): Job | null {
    const data = this.load();
    if (data.jobs.some((job) => job.issue === issue && job.role === role)) {
      return null;
    }
    const now = new Date().toISOString();
    const job: Job = {
      id: randomUUID(),
      issue,
      role,
      status: "queued",
      agentId: null,
      runId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    data.jobs.push(job);
    this.save(data);
    return job;
  }

  update(
    id: string,
    patch: Partial<Pick<Job, "status" | "agentId" | "runId" | "error">>,
  ): Job | undefined {
    const data = this.load();
    const job = data.jobs.find((item) => item.id === id);
    if (!job) {
      return undefined;
    }
    Object.assign(job, patch);
    job.updatedAt = new Date().toISOString();
    this.save(data);
    return job;
  }

  setLastPollAt(iso: string): void {
    const data = this.load();
    data.lastPollAt = iso;
    this.save(data);
  }

  lastPollAt(): string | null {
    return this.load().lastPollAt;
  }
}
