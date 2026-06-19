import type { Job, JobStatus } from "../types/job";
import type { SyncRunStatus } from "../types/sync";

export function scoreBand(score: number) {
  if (score >= 85) return { color: "var(--accent)", bg: "var(--accentW1)", label: "Alto match" };
  if (score >= 60) return { color: "#4EA7F5", bg: "rgba(78,167,245,0.09)", label: "Match medio" };
  if (score >= 40) return { color: "#F2B84B", bg: "rgba(242,184,75,0.09)", label: "Match bajo" };
  return { color: "#E5484D", bg: "rgba(229,72,77,0.08)", label: "Muy bajo" };
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

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "P";
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
  const history = [
    { event: `Vacante detectada en ${job.source}`, time: job.detected, color: "#4EA7F5" },
    { event: `Evaluada por IA · score ${job.score}`, time: job.detected, color: "var(--accent)" },
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
