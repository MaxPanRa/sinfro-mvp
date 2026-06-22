import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Job } from "../../types/job";
import type { Profile } from "../../types/profile";
import { displayJobScore, scoreBand, scoreTypeLabel, statusMeta } from "../../lib/formatters";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

interface JobListProps {
  jobs: Job[];
  profile: Profile;
  selectedId: number | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: number) => void;
  onClearFilters: () => void;
}

export function JobList({ jobs, profile, selectedId, scrollRef, onSelect, onClearFilters }: JobListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // Offset de la lista dentro del scroll (la results-bar sticky vive arriba).
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, [jobs.length]);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 8,
    scrollMargin,
    getItemKey: (index) => jobs[index].id,
  });

  if (!jobs.length) {
    return (
      <div ref={listRef}>
        <EmptyState
          title="Sin resultados"
          message="No hay vacantes para este filtro o busqueda. Ajusta los criterios o ejecuta un nuevo escaneo."
          actionLabel="Limpiar filtros"
          onAction={onClearFilters}
        />
      </div>
    );
  }

  return (
    <div ref={listRef}>
      <div style={{ position: "relative", height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const job = jobs[virtualItem.index];
          const displayScore = displayJobScore(job, profile);
          const band = scoreBand(displayScore);
          const status = statusMeta(job.status);
          const accent = job.status === "descartada" ? "#E5484D" : job.status === "aplicada" ? "#16A34A" : band.color;
          const statusClass =
            job.status === "descartada" ? "is-discarded" :
            job.status === "aplicada" ? "is-applied" :
            job.status === "vista" ? "is-seen" : "";
          return (
            <article
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={`job-row ${job.id === selectedId ? "is-selected" : ""} ${statusClass}`}
              onClick={() => onSelect(job.id)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                // El transform posiciona la fila virtual; desactivamos la animación
                // rowIn (que anima transform) para que no pelee con el posicionamiento.
                animation: "none",
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              }}
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
              <div className="score-box" style={{ background: statusClass ? "transparent" : band.bg }}>
                <span className="score-value" style={{ color: band.color }}>{displayScore}</span>
                <span className="score-label" style={{ color: band.color }}>{scoreTypeLabel(job.scoreType)}</span>
              </div>
            </article>
          );
        })}
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
}
