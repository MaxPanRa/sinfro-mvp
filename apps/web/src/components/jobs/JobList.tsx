import type { Job } from "../../types/job";
import { scoreBand, statusMeta } from "../../lib/formatters";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { useGsapList } from "../../hooks/useGsapList";

interface JobListProps {
  jobs: Job[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClearFilters: () => void;
}

export function JobList({ jobs, selectedId, onSelect, onClearFilters }: JobListProps) {
  const ref = useGsapList<HTMLDivElement>(jobs.map((job) => job.id).join(","));

  return (
    <div ref={ref}>
      {jobs.map((job) => {
        const band = scoreBand(job.score);
        const status = statusMeta(job.status);
        const accent = job.status === "descartada" ? "#E5484D" : job.status === "aplicada" ? "var(--accent)" : band.color;
        const statusClass =
          job.status === "descartada" ? "is-discarded" :
          job.status === "aplicada" ? "is-applied" :
          job.status === "vista" ? "is-seen" : "";
        return (
          <article
            key={job.id}
            data-animate-row
            className={`job-row ${job.id === selectedId ? "is-selected" : ""} ${statusClass}`}
            onClick={() => onSelect(job.id)}
          >
            <div className="job-accent" style={{ background: accent }} />
            <div className="job-main">
              <div className="job-title-line">
                <span className="job-title">{job.title}</span>
                <Badge color={status.color} background={status.bg}>{status.label}</Badge>
                {job.salary ? <span className="mono" style={{ flexShrink: 0, fontSize: 11, color: "var(--accent)" }}>{job.salary}</span> : null}
              </div>
              <div className="job-meta">{job.company} · {job.source} · {job.modality} · {job.location}</div>
              <div className="keyword-cloud">
                {job.skills.slice(0, 4).map((skill) => <span key={skill} className="chip">{skill}</span>)}
                <span className="faint" style={{ fontSize: 10.5, marginLeft: 2 }}>· {job.detected}</span>
              </div>
            </div>
            <div className="score-box" style={{ background: band.bg }}>
              <span className="score-value" style={{ color: band.color }}>{job.score}</span>
              <span className="score-label" style={{ color: band.color }}>{job.scoreType}</span>
            </div>
          </article>
        );
      })}

      {!jobs.length ? (
        <EmptyState
          title="Sin resultados"
          message="No hay vacantes para este filtro o busqueda. Ajusta los criterios o ejecuta un nuevo escaneo."
          actionLabel="Limpiar filtros"
          onAction={onClearFilters}
        />
      ) : null}
      <div style={{ height: 30 }} />
    </div>
  );
}
