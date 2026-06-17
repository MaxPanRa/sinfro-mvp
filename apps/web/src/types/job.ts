export type JobStatus = "nueva" | "vista" | "aplicada" | "descartada";
export type ScoreType = "IA" | "prelim";

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
  salary?: string;
  skills: string[];
}

export type JobFilter = "todas" | "nuevas" | "alto" | "aplicadas" | "descartadas";
export type JobSort = "score" | "fecha";
export type DetailTab = "analisis" | "vacante" | "historial";
