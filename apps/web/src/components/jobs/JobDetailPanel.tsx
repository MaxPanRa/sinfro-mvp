import { ArrowLeft, Check, ExternalLink, Loader2, MapPin, Sparkles, X, AlertTriangle, Inbox, CreditCard } from "lucide-react";
import type { DetailTab, Job } from "../../types/job";
import { buildJobAnalysis, scoreBand, statusMeta } from "../../lib/formatters";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Tabs } from "../ui/Tabs";

interface JobDetailPanelProps {
  job: Job;
  tab: DetailTab;
  analyzing: boolean;
  onClose: () => void;
  onTab: (tab: DetailTab) => void;
  onApply: () => void;
  onDismiss: () => void;
  onAnalyze: () => void;
}

export function JobDetailPanel({ job, tab, analyzing, onClose, onTab, onApply, onDismiss, onAnalyze }: JobDetailPanelProps) {
  const band = scoreBand(job.score);
  const status = statusMeta(job.status);
  const analysis = buildJobAnalysis(job);

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
              <div className="score-card__value">{job.score}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{band.label}</div>
              <div className="chip" style={{ display: "inline-flex", marginTop: 9, background: "var(--bg)", fontSize: 9.5, textTransform: "uppercase" }}>
                <Sparkles size={10} /> {job.scoreType}
              </div>
            </div>
          </div>

          <div className="action-row">
            <Button variant="primary" onClick={onApply} icon={<Check size={15} />}>Aplicar</Button>
            <Button onClick={onAnalyze} icon={analyzing ? <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={15} />}>
              {analyzing ? "Analizando..." : "Analizar con IA"}
            </Button>
            <Button onClick={onAnalyze}>Analisis profundo</Button>
            <div className="spacer" />
            <Button variant="danger" onClick={onDismiss} icon={<X size={14} />}>Descartar</Button>
            <Button icon={<ExternalLink size={14} />}>Abrir original</Button>
          </div>

          {analyzing ? (
            <div className="mono" style={{ margin: "14px 0 4px", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--accent)" }}>
              <Loader2 size={15} style={{ animation: "spin 0.9s linear infinite" }} /> Analizando con IA...
            </div>
          ) : null}

          <Tabs active={tab} onChange={onTab} />

          {tab === "analisis" ? (
            <div className="tab-panel">
              <div className="analysis-grid">
                <div className="analysis-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, color: "var(--accent)", fontSize: 12.5, fontWeight: 600 }}>
                    <Check size={15} /> Razones de compatibilidad
                  </div>
                  {analysis.reasons.map((reason) => <Bullet key={reason} color="var(--accent)" text={reason} />)}
                </div>
                <div className="analysis-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, color: "#F2B84B", fontSize: 12.5, fontWeight: 600 }}>
                    <AlertTriangle size={15} /> Brechas detectadas
                  </div>
                  {analysis.gaps.map((gap) => <Bullet key={gap} color="#F2B84B" text={gap} />)}
                </div>
              </div>
              <div className="section-kicker" style={{ marginBottom: 14 }}>Desglose del match</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {analysis.breakdown.map((item) => (
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
          ) : null}

          {tab === "vacante" ? (
            <div className="tab-panel">
              <p style={{ margin: "0 0 18px", maxWidth: 660, color: "var(--text1)", fontSize: 13.5, lineHeight: 1.7 }}>{analysis.description}</p>
              <div className="section-kicker" style={{ marginBottom: 11 }}>Requisitos / keywords detectadas</div>
              <div className="keyword-cloud">{job.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
            </div>
          ) : null}

          {tab === "historial" ? (
            <div className="tab-panel">
              {analysis.history.map((item) => (
                <div key={item.event} style={{ display: "flex", gap: 14, paddingBottom: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: item.color, border: "2px solid var(--bg)", boxShadow: `0 0 0 1px ${item.color}` }} />
                    <span style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 2 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.event}</div>
                    <div className="mono faint" style={{ fontSize: 11.5, marginTop: 2 }}>{item.time}</div>
                  </div>
                </div>
              ))}
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
