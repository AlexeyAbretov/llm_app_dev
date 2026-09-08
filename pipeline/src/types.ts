export type Role = "analyst" | "developer" | "tester";

export type JobStatus = "queued" | "running" | "finished" | "error" | "startup_error";

export type Job = {
  id: string;
  issue: number;
  role: Role;
  status: JobStatus;
  agentId: string | null;
  runId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
