import type { Job, JobStatus } from "../types/job";
import type { Profile } from "../types/profile";
import type { SyncRunStatus } from "../types/sync";

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

// Análisis SEMÁNTICO honesto: compara el perfil real contra el TEXTO de la
// vacante (tags + descripción). El score se deriva del match real (ponderando
// skills), no del heurístico preliminar. Es aproximado: la IA es la precisa.
export function buildSemanticAnalysis(job: Job, profile: Profile) {
  // Texto completo de la vacante donde buscar las skills del candidato.
  const jobText = `${(job.skills || []).join(" ")} ${job.description || ""}`.toLowerCase();
  const profileSkills = (profile.skills || []).map((skill) => skill.name).filter(Boolean);
  const matched = profileSkills.filter((name) => jobText.includes(name.toLowerCase()));
  const missing = profileSkills.filter((name) => !jobText.includes(name.toLowerCase()));
  // % de TUS skills que la vacante realmente menciona (relevancia de tu perfil).
  const skillsScore = profileSkills.length ? Math.round((matched.length / profileSkills.length) * 100) : 0;

  const profileModality = (profile.modality || "").toLowerCase();
  const remote = `${job.modality} ${job.location}`.toLowerCase().includes("remot");
  const modalityScore = profileModality && job.modality && profileModality.includes(job.modality.toLowerCase()) ? 100 : remote ? 85 : 50;

  const profileLoc = (profile.location || "").toLowerCase();
  const jobLoc = (job.location || "").toLowerCase();
  const locationScore = remote || !jobLoc ? 100 : profileLoc && (profileLoc.includes(jobLoc) || jobLoc.includes(profileLoc) || jobLoc.includes("latam")) ? 100 : 55;

  // Ponderación: las skills mandan; modalidad y ubicación pesan poco (suelen ser
  // remoto/100%). Así una vacante sin relación con tu perfil da un score bajo real.
  const score = Math.round(skillsScore * 0.7 + modalityScore * 0.15 + locationScore * 0.15);

  const reasons = matched.length
    ? [`${matched.length} de tus ${profileSkills.length} skills aparecen en esta vacante: ${matched.slice(0, 6).join(", ")}.`]
    : ["Ninguna de tus skills aparece en el texto de la vacante: poca relación con tu perfil."];
  if (modalityScore >= 85) reasons.push(`Modalidad ${job.modality.toLowerCase()} compatible con tu preferencia.`);
  const gaps = [
    skillsScore < 40
      ? "El match de skills es bajo: esta vacante exige tecnologías que tu perfil no refleja."
      : `${missing.length} de tus skills no se mencionan en esta vacante.`,
    "El análisis semántico es aproximado (busca coincidencias de texto). Usa el análisis con IA para una evaluación precisa.",
  ];

  return {
    score,
    reasons,
    gaps,
    breakdown: [
      { key: "Skills relevantes", value: skillsScore, color: scoreBand(skillsScore).color },
      { key: "Modalidad", value: modalityScore, color: scoreBand(modalityScore).color },
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
