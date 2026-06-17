import type { SyncRun } from "../types/sync";

export const mockSyncRuns: SyncRun[] = [
  { id: 1, source: "Indeed MX (Apify)", status: "running", found: "—", duration: "00:48", started: "ahora" },
  { id: 2, source: "LinkedIn (SerpAPI)", status: "success", found: 9, duration: "00:08", started: "hace 5 min" },
  { id: 3, source: "Adzuna", status: "success", found: 18, duration: "00:24", started: "hace 12 min" },
  { id: 4, source: "Workana", status: "success", found: 12, duration: "00:31", started: "hace 18 min" },
  { id: 5, source: "Jooble", status: "failed", found: 0, duration: "00:03", started: "hace 22 min", error: "API key invalida (401)" },
  { id: 6, source: "Indeed MX (Apify)", status: "success", found: 42, duration: "01:12", started: "hace 41 min" },
  { id: 7, source: "Adzuna", status: "success", found: 7, duration: "00:19", started: "hace 1 h" },
  { id: 8, source: "OpenCode Go", status: "pending", found: "—", duration: "—", started: "en cola" },
];
