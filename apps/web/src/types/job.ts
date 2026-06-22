export type JobStatus = "nueva" | "vista" | "aplicada" | "descartada";
export type ScoreType = "IA" | "prelim" | "semantica";
export type AnalysisMode = "semantic" | "quick" | "deep";

export interface Job {
  id: number;
  title: string;
  company: string;
  source: string;
  modality: string;
  location: string;
  score: number;
  scoreType: ScoreType;
  status: JobStatus;
  detected: string;
  detectedAt?: string; // ISO; usado para ordenar por fecha
  description?: string | null;
  url?: string | null; // enlace a la vacante original
  discardReason?: string | null; // motivo si fue descartada
  salary?: string;
  skills: string[];
}

export type JobFilter = "todas" | "nuevas" | "alto" | "aplicadas" | "descartadas";
export type JobSort = "score" | "fecha";
export type DetailTab = "analisis" | "vacante" | "carta";
