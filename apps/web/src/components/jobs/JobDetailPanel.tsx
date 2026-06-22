import { useEffect, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Loader2, MapPin, Sparkles, X, AlertTriangle, Inbox, CreditCard, Languages, RotateCcw, FileText, Copy } from "lucide-react";
import type { AnalysisMode, DetailTab, Job } from "../../types/job";
import type { Profile } from "../../types/profile";
import { apiClient } from "../../lib/apiClient";
import { buildJobAnalysis, buildSemanticAnalysis, displayJobScore, scoreBand, scoreTypeLabel, statusMeta } from "../../lib/formatters";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Tabs } from "../ui/Tabs";
import { MarkdownEval } from "./MarkdownEval";

interface JobDetailPanelProps {
  job: Job;
  tab: DetailTab;
  analyzing: boolean;
  usesAi: boolean;
  analyzed?: "quick" | "deep";
  profile: Profile;
  evaluation?: { mode?: string; markdown?: string };
  onClose: () => void;
  onTab: (tab: DetailTab) => void;
  onApply: () => void;
  onUnapply: () => void;
  onUndiscard: () => void;
  onDismiss: (reason: string) => void;
  onAnalyze: (mode: AnalysisMode) => void;
}

const TRANSLATION_LANGUAGES = [
  "Español",
  "Inglés",
  "Portugués",
  "Francés",
  "Alemán",
  "Italiano",
];

// Motivos predefinidos de descarte (tomados de la app original; multiselección).
const DISCARD_REASONS = [
  "No me gusta",
  "Esquema híbrido",
  "Esquema presencial",
  "Salario bajo",
  "Ubicación",
  "Requiere mudanza",
  "Stack / tecnologías",
  "Seniority no encaja",
  "Idioma",
  "Empresa",
  "Ya apliqué / repetida",
  "Vacante caducada",
];

export function JobDetailPanel({ job, tab, analyzing, usesAi, analyzed, profile, evaluation, onClose, onTab, onApply, onUnapply, onUndiscard, onDismiss, onAnalyze }: JobDetailPanelProps) {
  const displayScore = displayJobScore(job, profile);
  const band = scoreBand(displayScore);
  const status = statusMeta(job.status);
  const analysis = buildJobAnalysis(job);
  const semantic = buildSemanticAnalysis(job, profile);
  const hasEvaluation = job.scoreType !== "prelim";
  const aiMarkdown = job.scoreType === "IA" ? (evaluation?.markdown || "") : "";
  const noDescription = !(job.description || "").trim();
  // Cover letter (carta de presentación) — requiere IA asignada a comparación.
  const [coverLang, setCoverLang] = useState<"es" | "en">("es");
  const [coverText, setCoverText] = useState("");
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverError, setCoverError] = useState("");
  useEffect(() => { setCoverText(""); setCoverError(""); }, [job.id]);
  async function handleCover(lang: "es" | "en") {
    setCoverLang(lang);
    setCoverLoading(true);
    setCoverError("");
    try {
      const result = await apiClient.generateCoverLetter(job.id, lang);
      setCoverText(result.text);
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "No se pudo generar la carta");
    } finally {
      setCoverLoading(false);
    }
  }
  const scoreLabel = scoreTypeLabel(job.scoreType);
  const originalDescription = (job.description || "").trim();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("Español");
  const [translatedDescription, setTranslatedDescription] = useState("");
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [showTranslated, setShowTranslated] = useState(false);
  const displayedDescription = showTranslated && translatedDescription ? translatedDescription : originalDescription;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardReasons, setDiscardReasons] = useState<Set<string>>(new Set());
  const [discardNotes, setDiscardNotes] = useState("");

  useEffect(() => {
    setTranslateOpen(false);
    setTargetLanguage("Español");
    setTranslatedDescription("");
    setTranslationLoading(false);
    setTranslationError("");
    setShowTranslated(false);
    setDiscardOpen(false);
    setDiscardReasons(new Set());
    setDiscardNotes("");
  }, [job.id]);

  const toggleDiscardReason = (reason: string) => {
    setDiscardReasons((current) => {
      const next = new Set(current);
      if (next.has(reason)) next.delete(reason); else next.add(reason);
      return next;
    });
  };
  const confirmDiscard = () => {
    const parts = [...discardReasons];
    const notes = discardNotes.trim();
    if (notes) parts.push(notes);
    onDismiss(parts.join(", "));
    setDiscardOpen(false);
  };

  async function handleTranslate() {
    setTranslationLoading(true);
    setTranslationError("");
    try {
      const result = await apiClient.translateJobDescription(job.id, targetLanguage);
      setTranslatedDescription(result.translatedDescription);
      setShowTranslated(true);
      setTranslateOpen(false);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "No se pudo traducir la vacante");
    } finally {
      setTranslationLoading(false);
    }
  }

  return (
    <section className="detail-overlay">
      <div className="detail-header">
        <Button onClick={onClose} icon={<ArrowLeft size={14} />}>Volver</Button>
        <div className="spacer" />
        <span className="mono faint" style={{ fontSize: 11 }}>{job.detected} · {job.source}</span>
      </div>

      <div className="detail-body">
        <div className="detail-inner">
          <div className="detail-hero">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <Badge color={status.color} background={status.bg}>{status.label}</Badge>
                <span className="mono faint" style={{ fontSize: 11.5 }}>{job.company}</span>
              </div>
              <h2 className="detail-title">{job.title}</h2>
              <div className="detail-meta">
                <span><MapPin size={14} color="var(--faint)" />{job.location} · {job.modality}</span>
                <span><CreditCard size={14} color="var(--faint)" /><span style={{ color: job.salary ? "var(--accent)" : "var(--text2)" }}>{job.salary || "No especificado"}</span></span>
                <span><Inbox size={14} color="var(--faint)" />{job.source}</span>
              </div>
            </div>
            <div className="score-card" style={{ color: band.color, background: band.bg }}>
              <div className="score-card__value">{displayScore}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{band.label}</div>
              <div className="chip" style={{ display: "inline-flex", marginTop: 9, background: "var(--bg)", fontSize: 9.5, textTransform: "uppercase" }}>
                <Sparkles size={10} /> {scoreLabel}
              </div>
            </div>
          </div>

          <div className="action-row">
            {job.status === "aplicada" ? (
              <Button onClick={onUnapply} icon={<X size={15} />}>Quitar Aplicación</Button>
            ) : (
              <Button variant="primary" onClick={onApply} icon={<Check size={15} />}>Aplicar</Button>
            )}
            {noDescription ? null : usesAi ? (
              <>
                <Button
                  disabled={analyzing || analyzed === "quick" || analyzed === "deep"}
                  onClick={() => onAnalyze("quick")}
                  title={analyzed ? "Ya analizada. Edita el perfil para volver a habilitar." : "Pase breve y económico con tu IA asignada."}
                  icon={analyzing ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={15} />}
                >
                  {analyzing ? "Analizando..." : "Análisis rápido"}
                </Button>
                <Button
                  disabled={analyzing || analyzed === "deep"}
                  onClick={() => onAnalyze("deep")}
                  title={analyzed === "deep" ? "Ya analizada a profundidad. Edita el perfil para volver a habilitar." : "Análisis exhaustivo con tu IA asignada."}
                  icon={<Sparkles size={15} />}
                >
                  Análisis profundo
                </Button>
              </>
            ) : (
              <Button
                disabled={analyzing}
                onClick={() => onAnalyze("semantic")}
                title="Puede contener múltiples inconsistencias, tanto textuales, como de porcentaje de compatibilidad"
                icon={analyzing ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={15} />}
              >
                {analyzing ? "Analizando..." : "Análisis semántico"}
              </Button>
            )}
            <div className="spacer" />
            {job.status === "descartada" ? (
              <Button onClick={onUndiscard} icon={<RotateCcw size={14} />}>Dejar de descartar</Button>
            ) : (
              <Button variant="danger" onClick={() => setDiscardOpen(true)} icon={<X size={14} />}>Descartar</Button>
            )}
            <Button
              icon={<ExternalLink size={14} />}
              disabled={!job.url}
              title={job.url ? "Abrir la vacante original en otra pestaña" : "Esta vacante no tiene enlace original"}
              onClick={() => job.url && window.open(job.url, "_blank", "noopener,noreferrer")}
            >
              Abrir original
            </Button>
          </div>

          {job.status === "descartada" && job.discardReason ? (
            <div className="notice is-error" style={{ marginTop: 12, fontSize: 12.5 }}>
              <strong>Descartada:</strong> {job.discardReason}
            </div>
          ) : null}

          <Modal open={discardOpen} onClose={() => setDiscardOpen(false)}>
            <section className="modal-panel" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 700 }}>¿Por qué descartas esta vacante?</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Elige una o varias opciones y/o escribe tus notas.</div>
                </div>
              </div>
              <div className="modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", marginBottom: 14 }}>
                  {DISCARD_REASONS.map((reason) => (
                    <label key={reason} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={discardReasons.has(reason)} onChange={() => toggleDiscardReason(reason)} />
                      {reason}
                    </label>
                  ))}
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <span className="label">Otra razón / notas (opcional)</span>
                  <textarea className="textarea" style={{ minHeight: 70 }} value={discardNotes} onChange={(event) => setDiscardNotes(event.target.value)} placeholder="Detalla por qué no te interesa..." />
                </label>
              </div>
              <div className="modal-footer">
                <Button onClick={() => setDiscardOpen(false)}>Cancelar</Button>
                <Button variant="danger" onClick={confirmDiscard} icon={<X size={14} />}>Descartar</Button>
              </div>
            </section>
          </Modal>

          {analyzing ? (
            <div className="mono" style={{ margin: "14px 0 4px", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--accent)" }}>
              <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> {usesAi ? "Analizando..." : "Analizando semánticamente..."}
            </div>
          ) : null}

          <Tabs active={tab} onChange={onTab} />

          {tab === "analisis" ? (
            noDescription ? (
              <div className="tab-panel">
                <div className="analysis-card" style={{ maxWidth: 560, borderLeft: "3px solid #F2B84B" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#F2B84B", fontSize: 12.5, fontWeight: 700 }}>
                    <AlertTriangle size={15} /> Sin descripción para analizar
                  </div>
                  <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.6, color: "var(--text1)" }}>
                    Esta vacante no incluye descripción, así que no generamos un análisis (no inventamos datos).
                    Abre el sitio original para ver los detalles completos y decidir.
                  </p>
                  <Button variant="primary" disabled={!job.url} icon={<ExternalLink size={14} />} onClick={() => job.url && window.open(job.url, "_blank", "noopener,noreferrer")}>
                    Abrir sitio de la vacante
                  </Button>
                </div>
              </div>
            ) : aiMarkdown ? (
              <div className="tab-panel">
                <div className="section-kicker" style={{ marginBottom: 14 }}>
                  Evaluación con IA{evaluation?.mode ? ` · ${evaluation.mode === "quick" ? "rápida" : "profunda"}` : ""}
                </div>
                <MarkdownEval markdown={aiMarkdown} mode={evaluation?.mode} />
              </div>
            ) : hasEvaluation ? (
              <div className="tab-panel">
                <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                  Análisis semántico: solo verifica coincidencias comprobables entre tu perfil y la vacante (sin IA).
                </div>
                <div className="analysis-grid">
                  <div className="analysis-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, color: "var(--accent)", fontSize: 12.5, fontWeight: 600 }}>
                      <Check size={15} /> Coincidencias verificadas
                    </div>
                    {semantic.reasons.map((reason) => <Bullet key={reason} color="var(--accent)" text={reason} />)}
                  </div>
                  <div className="analysis-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, color: "#F2B84B", fontSize: 12.5, fontWeight: 600 }}>
                      <AlertTriangle size={15} /> No detectado en tu perfil
                    </div>
                    {semantic.gaps.map((gap) => <Bullet key={gap} color="#F2B84B" text={gap} />)}
                  </div>
                </div>
                <div className="section-kicker" style={{ marginBottom: 14 }}>Desglose del match</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {semantic.breakdown.map((item) => (
                    <div key={item.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                        <span className="muted">{item.key}</span>
                        <span className="mono" style={{ color: item.color, fontWeight: 600 }}>{item.value}%</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${item.value}%`, background: item.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tab-panel">
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, padding: "6px 0" }}>
                  Esta vacante aún no ha sido analizada. Usa los botones de arriba para evaluarla.
                </div>
              </div>
            )
          ) : null}

          {tab === "vacante" ? (
            <div className="tab-panel">
              <div className="analysis-card" style={{ maxWidth: 760, marginBottom: 22 }}>
                <div className="section-kicker" style={{ marginBottom: 10 }}>Resumen semántico</div>
                <p style={{ margin: 0, color: "var(--text1)", fontSize: 13.5, lineHeight: 1.7 }}>{analysis.description}</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
                <div className="section-kicker" style={{ marginRight: "auto" }}>{showTranslated ? `Vacante traducida a ${targetLanguage}` : "Vacante original"}</div>
                {usesAi && originalDescription ? (
                  <Button onClick={() => setTranslateOpen(true)} icon={<Languages size={14} />}>Traducir</Button>
                ) : null}
                {translatedDescription ? (
                  <Button onClick={() => setShowTranslated((value) => !value)}>
                    {showTranslated ? "Ver Original" : "Ver Traducido"}
                  </Button>
                ) : null}
              </div>
              <div className="job-description-card">
                {displayedDescription ? displayedDescription : "Sin descripción original disponible."}
              </div>

              <div className="section-kicker" style={{ margin: "22px 0 11px" }}>Requisitos / keywords detectadas</div>
              <div className="keyword-cloud">{job.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>

              <Modal open={translateOpen} onClose={() => setTranslateOpen(false)}>
                <section className="modal-panel" style={{ maxWidth: 460 }}>
                  <div className="modal-header">
                    <div>
                      <div style={{ fontWeight: 700 }}>Traducir vacante</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{job.title}</div>
                    </div>
                  </div>
                  <div className="modal-body">
                    <label style={{ display: "grid", gap: 8 }}>
                      <span className="label">Idioma</span>
                      <select className="select" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                        {TRANSLATION_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
                      </select>
                    </label>
                    {translationError ? <div className="error-text" style={{ marginTop: 12 }}>{translationError}</div> : null}
                  </div>
                  <div className="modal-footer">
                    <Button onClick={() => setTranslateOpen(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={handleTranslate} disabled={translationLoading} icon={translationLoading ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Languages size={15} />}>
                      {translationLoading ? "Traduciendo..." : "Traducir"}
                    </Button>
                  </div>
                </section>
              </Modal>
            </div>
          ) : null}

          {tab === "carta" ? (
            <div className="tab-panel">
              {!usesAi ? (
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Para generar cartas de presentación con IA, asigna un modelo a <strong>Análisis CV vs vacante</strong> en Conexiones.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <div className="section-kicker" style={{ marginRight: "auto" }}>Carta de presentación</div>
                    <Button disabled={coverLoading} onClick={() => handleCover("es")} icon={coverLoading && coverLang === "es" ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <FileText size={14} />}>Generar en Español</Button>
                    <Button disabled={coverLoading} onClick={() => handleCover("en")} icon={coverLoading && coverLang === "en" ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <FileText size={14} />}>Generar en Inglés</Button>
                    {coverText ? <Button onClick={() => navigator.clipboard?.writeText(coverText)} icon={<Copy size={14} />}>Copiar</Button> : null}
                  </div>
                  {coverError ? <div className="notice is-error" style={{ marginBottom: 12 }}>{coverError}</div> : null}
                  {coverText ? (
                    <div className="job-description-card" style={{ whiteSpace: "pre-wrap" }}>{coverText}</div>
                  ) : coverLoading ? (
                    <div className="mono" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--accent)" }}>
                      <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> Generando carta en {coverLang === "es" ? "español" : "inglés"}...
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                      Genera una carta personalizada para esta vacante en español o inglés, basada en tu perfil y CV.
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Bullet({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 9, marginBottom: 9, color: "var(--text1)", fontSize: 12.5, lineHeight: 1.45 }}>
      <span style={{ color, flexShrink: 0 }}>›</span>
      <span>{text}</span>
    </div>
  );
}
