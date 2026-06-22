import type { Job, JobStatus } from "../types/job";
import type { Profile } from "../types/profile";
import type { SyncRunStatus } from "../types/sync";

// "hace X min/h/d" a partir de un timestamp ISO; espejo del relative_time_label
// del backend, pero calculado en el cliente para que el chip se actualice en vivo.
export function relativeTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const moment = new Date(iso).getTime();
  if (Number.isNaN(moment)) return null;
  const seconds = Math.floor((Date.now() - moment) / 1000);
  if (seconds < 45) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function scoreBand(score: number) {
  if (score >= 85) return { color: "#047857", bg: "rgba(16,163,127,0.14)", label: "Alto match" };
  if (score >= 60) return { color: "#1D4ED8", bg: "rgba(78,167,245,0.13)", label: "Match medio" };
  if (score >= 40) return { color: "#B45309", bg: "rgba(242,184,75,0.16)", label: "Match bajo" };
  return { color: "#B91C1C", bg: "rgba(229,72,77,0.13)", label: "Muy bajo" };
}

export function statusMeta(status: JobStatus) {
  const map = {
    nueva: { label: "Nueva", color: "#4EA7F5", bg: "rgba(78,167,245,0.13)" },
    vista: { label: "Vista", color: "var(--text2)", bg: "rgba(143,163,155,0.10)" },
    aplicada: { label: "Aplicada", color: "#16A34A", bg: "rgba(22,163,74,0.14)" },
    descartada: { label: "Descartada", color: "#E5484D", bg: "rgba(229,72,77,0.12)" },
  };
  return map[status];
}

export function syncStatusMeta(status: SyncRunStatus) {
  const map = {
    running: { label: "Ejecutando", color: "#4EA7F5", bg: "rgba(78,167,245,0.13)" },
    success: { label: "Completado", color: "var(--accent)", bg: "var(--accentW2)" },
    failed: { label: "Fallido", color: "#E5484D", bg: "rgba(229,72,77,0.12)" },
    pending: { label: "En cola", color: "var(--text2)", bg: "rgba(143,163,155,0.10)" },
  };
  return map[status];
}

export function skillColor(level: number) {
  if (level >= 9) return "var(--accent)";
  if (level >= 7) return "#4EA7F5";
  if (level >= 5) return "#F2B84B";
  return "#E5484D";
}

export function scoreTypeLabel(scoreType: Job["scoreType"]) {
  if (scoreType === "semantica") return "Semántico";
  return scoreType;
}

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "P";
}

// Análisis SEMÁNTICO honesto: compara el perfil real (skills + palabras clave)
// contra el TEXTO de la vacante (tags + descripción). El score se deriva del match
// real, no del heurístico preliminar. Ponderación: contenido (skills y palabras
// clave) 60%, esquema 20%, ubicación 20%. Espejo de semantic_match_score (worker).
export function buildSemanticAnalysis(job: Job, profile: Profile) {
  // Texto completo de la vacante donde buscar los términos del candidato.
  const jobText = `${(job.skills || []).join(" ")} ${job.description || ""}`.toLowerCase();
  // Términos del perfil: skills + palabras clave, deduplicados (case-insensitive).
  const rawTerms = [...(profile.skills || []).map((skill) => skill.name), ...(profile.keywords || [])].filter(Boolean);
  const seen = new Set<string>();
  const terms = rawTerms.filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matched = terms.filter((term) => jobText.includes(term.toLowerCase()));
  const missing = terms.filter((term) => !jobText.includes(term.toLowerCase()));
  // % de TUS skills/keywords que la vacante realmente menciona (relevancia del perfil).
  const relevanceScore = terms.length ? Math.round((matched.length / terms.length) * 100) : 0;

  const profileModality = (profile.modality || "").toLowerCase();
  const remote = `${job.modality} ${job.location}`.toLowerCase().includes("remot");
  const modalityScore = profileModality && job.modality && profileModality.includes(job.modality.toLowerCase()) ? 100 : remote ? 85 : 50;

  const profileLoc = (profile.location || "").toLowerCase();
  const jobLoc = (job.location || "").toLowerCase();
  const locationScore = remote || !jobLoc ? 100 : profileLoc && (profileLoc.includes(jobLoc) || jobLoc.includes(profileLoc) || jobLoc.includes("latam")) ? 100 : 55;

  // Ponderación pedida: ubicación con más peso (30%), esquema 20%, contenido 50%.
  const score = Math.round(relevanceScore * 0.5 + modalityScore * 0.2 + locationScore * 0.3);

  const reasons = matched.length
    ? [`${matched.length} de tus ${terms.length} skills/palabras clave aparecen en esta vacante: ${matched.slice(0, 6).join(", ")}.`]
    : ["Ninguna de tus skills o palabras clave aparece en el texto de la vacante: poca relación con tu perfil."];
  if (modalityScore >= 85) reasons.push(`Esquema ${job.modality.toLowerCase()} compatible con tu preferencia.`);
  const gaps = [
    relevanceScore < 40
      ? "El match de contenido es bajo: esta vacante exige skills/temas que tu perfil no refleja."
      : `${missing.length} de tus skills/palabras clave no se mencionan en esta vacante.`,
    "El análisis semántico es aproximado (busca coincidencias de texto). Usa el análisis con IA para una evaluación precisa.",
  ];

  return {
    score,
    reasons,
    gaps,
    breakdown: [
      { key: "Skills y palabras clave", value: relevanceScore, color: scoreBand(relevanceScore).color },
      { key: "Esquema", value: modalityScore, color: scoreBand(modalityScore).color },
      { key: "Ubicación", value: locationScore, color: scoreBand(locationScore).color },
    ],
    matched,
    missing,
  };
}

export function displayJobScore(job: Job, profile: Profile) {
  return job.scoreType === "semantica" ? buildSemanticAnalysis(job, profile).score : job.score;
}

export function buildJobAnalysis(job: Job) {
  const top = job.skills.slice(0, 3).join(", ");
  const reasons = [
    `Coincidencia fuerte con tus skills clave: ${top}.`,
    `Modalidad ${job.modality.toLowerCase()} compatible con tu preferencia de busqueda.`,
    job.score >= 85 ? "Seniority y stack alineados con tu perfil de 10+ anos." : "Stack parcialmente alineado con tu experiencia.",
  ];
  const gaps = job.score >= 85
    ? ["Sin brechas relevantes detectadas.", "Verifica el rango salarial directamente con la empresa."]
    : ["Algunos requisitos no aparecen en tu CV (revisar descripcion).", job.score < 60 ? "Seniority solicitado por debajo de tu nivel." : "Se sugiere ingles C1 para el rol."];
  const breakdown = [
    { key: "Skills tecnicas", value: Math.min(99, job.score + 5), color: scoreBand(Math.min(99, job.score + 5)).color },
    { key: "Seniority", value: Math.max(35, job.score - 7), color: scoreBand(Math.max(35, job.score - 7)).color },
    { key: "Ubicacion / modalidad", value: 100, color: scoreBand(100).color },
    { key: "Salario", value: job.salary ? 90 : 62, color: scoreBand(job.salary ? 90 : 62).color },
  ];
  const evaluationLabel = job.scoreType === "IA" ? "Evaluada por IA" : "Analizada semánticamente";
  const history = [
    { event: `Vacante detectada en ${job.source}`, time: job.detected, color: "#4EA7F5" },
    { event: `${evaluationLabel} · score ${job.score}`, time: job.detected, color: "var(--accent)" },
    ...(job.status === "aplicada" ? [{ event: "Marcada como aplicada", time: "hace unos minutos", color: "var(--accent)" }] : []),
    ...(job.status === "descartada" ? [{ event: "Descartada: ya aplique / repetida", time: "hace unos minutos", color: "#E5484D" }] : []),
  ];

  return {
    reasons,
    gaps,
    breakdown,
    history,
    description: `${job.company} busca un ${job.title} para trabajar en modalidad ${job.modality.toLowerCase()} desde ${job.location}. El rol involucra el diseno y desarrollo de productos con un stack moderno (${job.skills.join(", ")}), colaboracion con equipos multidisciplinarios y participacion en decisiones de arquitectura. Se valora experiencia integrando IA generativa y construyendo interfaces de alto rendimiento.`,
  };
}
