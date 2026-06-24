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

// Ventana para considerar una vacante "nueva": solo cuenta como nueva si su estado
// es "nueva" Y fue encontrada hace menos de 30 min. Las "nueva" más viejas quedan
// en estado neutro (sin badge): ni "nueva" ni "vista" (ese es otro estado, manual).
export const JOB_NEW_WINDOW_MIN = 30;

export function isJobNew(job: Job): boolean {
  if (job.status !== "nueva" || !job.detectedAt) return false;
  const detected = new Date(job.detectedAt).getTime();
  if (Number.isNaN(detected)) return false;
  return Date.now() - detected < JOB_NEW_WINDOW_MIN * 60 * 1000;
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

const normSkill = (value: string) => (value || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Palabras significativas del rol/puesto del perfil (espejo de role_match_terms del worker).
function roleMatchTerms(profile: Profile): string[] {
  const words = normSkill(profile.role || "").match(/[a-z0-9.+#]+/g) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (word.length >= 3 && !seen.has(word)) { seen.add(word); out.push(word); }
  }
  return out.slice(0, 8);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longest = Math.max(a.length, b.length);
  if ((longest - Math.min(a.length, b.length)) / longest > 0.6) return 0;
  return 1 - levenshtein(a, b) / longest;
}

// Similitud rol vs título (espejo de role_title_similarity del backend). Atajo exacto
// (sin Levenshtein) cuando la palabra del rol está tal cual en el título.
function roleTitleSimilarity(profile: Profile, title: string): number {
  const roleTokens = roleMatchTerms(profile);
  const titleTokens = (normSkill(title).match(/[a-z0-9.+#]+/g) || []).filter((t) => t.length >= 3);
  if (!roleTokens.length || !titleTokens.length) return 0;
  const titleSet = new Set(titleTokens);
  let total = 0;
  for (const rt of roleTokens) {
    total += titleSet.has(rt) ? 1 : Math.max(...titleTokens.map((tt) => tokenSimilarity(rt, tt)));
  }
  return total / roleTokens.length;
}

// Match por tramos (espejo de simple_match_score del worker/API):
//  1) Base estructural (máx 50): ubicación 25 + esquema 25.
//  2) +10% si el título coincide con tu rol (>= mitad de las palabras del rol).
//  3) Densidad de relevancia: +5% por palabra clave y +2% por skill del perfil que
//     aparezca en el texto de la vacante (título + descripción + skills). Clamp 0-99.
export function buildSemanticAnalysis(job: Job, profile: Profile) {
  // --- 1) Base estructural (máx 50): ubicación 25 + esquema 25 ---
  const profileModality = (profile.modality || "").toLowerCase();
  const remote = `${job.modality} ${job.location}`.toLowerCase().includes("remot");
  const modalityScore = profileModality && job.modality && profileModality.includes(job.modality.toLowerCase()) ? 100 : remote ? 85 : 50;
  const modalityComponent = modalityScore >= 100 ? 25 : modalityScore >= 85 ? 21 : 13;

  const profileLoc = (profile.location || "").toLowerCase();
  const jobLoc = (job.location || "").toLowerCase();
  const locationAllowed = remote || !jobLoc || (!!profileLoc && (profileLoc.includes(jobLoc) || jobLoc.includes(profileLoc) || jobLoc.includes("latam")));
  const locationScore = locationAllowed ? 100 : 55;
  const locationComponent = locationAllowed ? 25 : 13;

  const base = locationComponent + modalityComponent;

  // --- 2) Bonus de rol: similitud Levenshtein rol vs título (>70% perfecto +10, >40% aprox +5) ---
  const roleSim = roleTitleSimilarity(profile, job.title || "");
  const roleBonus = roleSim > 0.70 ? 10 : roleSim > 0.40 ? 5 : 0;
  const roleScore = Math.round(roleSim * 100);

  // --- 3) Densidad de relevancia sobre el texto de la vacante ---
  const text = normSkill(`${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`);
  const matchedKeywords = (profile.keywords || []).filter((k) => { const t = normSkill(k); return !!t && text.includes(t); });
  const matchedSkills = (profile.skills || []).map((s) => s.name).filter((s) => { const t = normSkill(s); return !!t && text.includes(t); });
  const keywordBonus = matchedKeywords.length * 5;
  const skillBonus = matchedSkills.length * 2;

  const score = Math.min(99, base + roleBonus + keywordBonus + skillBonus);

  const matched = [...matchedKeywords, ...matchedSkills];
  const reasons: string[] = [];
  if (roleBonus === 10) reasons.push(`El título coincide con tu rol (${roleScore}%, +10%).`);
  else if (roleBonus === 5) reasons.push(`El título coincide aprox. con tu rol (${roleScore}%, +5%).`);
  if (matchedKeywords.length || matchedSkills.length) reasons.push(`Menciona ${matchedKeywords.length} de tus palabras clave (+${keywordBonus}%) y ${matchedSkills.length} skills (+${skillBonus}%).`);
  if (modalityScore >= 85) reasons.push(`Esquema ${job.modality.toLowerCase()} compatible con tu preferencia.`);
  if (locationAllowed) reasons.push("Ubicación compatible con tu perfil.");
  if (!reasons.length) reasons.push("Coincidencia baja: el texto de la vacante no menciona tu rol, palabras clave ni skills.");

  const gaps = [
    roleBonus > 0 ? "El título refleja tu rol objetivo." : "El título no coincide con tu rol objetivo (no suma bonus de rol).",
    "El match es aproximado (ubicación, esquema, rol y densidad de tus términos). Usa el análisis con IA para una evaluación precisa.",
  ];

  const relevancePct = Math.min(99, roleBonus + keywordBonus + skillBonus);
  return {
    score,
    reasons,
    gaps,
    breakdown: [
      { key: "Ubicación", value: locationScore, color: scoreBand(locationScore).color },
      { key: "Esquema", value: modalityScore, color: scoreBand(modalityScore).color },
      { key: "Rol en título", value: roleScore, color: scoreBand(roleScore).color },
      { key: "Relevancia (frases + skills)", value: relevancePct, color: scoreBand(relevancePct).color },
    ],
    matched,
    missing: [] as string[],
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
