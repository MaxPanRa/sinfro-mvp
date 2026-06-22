export type SyncRunStatus = "running" | "success" | "failed" | "pending";

export interface SyncRun {
  id: number;
  source: string;
  status: SyncRunStatus;
  found: number | string;
  duration: string;
  started: string;
  createdAt?: string | null;
  error?: string;
}
