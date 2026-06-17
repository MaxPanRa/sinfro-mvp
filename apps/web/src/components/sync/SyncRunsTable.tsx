import type { SyncRun } from "../../types/sync";
import { syncStatusMeta } from "../../lib/formatters";
import { StatusPill } from "../ui/Badge";
import { useGsapList } from "../../hooks/useGsapList";

export function SyncRunsTable({ runs }: { runs: SyncRun[] }) {
  const ref = useGsapList<HTMLDivElement>(runs.map((run) => run.id).join(","));

  return (
    <div className="sync-panel">
      <div style={{ overflowX: "auto" }}>
        <div className="sync-table" ref={ref}>
          <div className="sync-row is-head">
            <span>Fuente</span><span>Estado</span><span className="right">Vacantes</span><span className="right">Duracion</span><span className="right">Iniciado</span>
          </div>
          {runs.map((run) => {
            const meta = syncStatusMeta(run.status);
            return (
              <div className="sync-row" key={run.id} data-animate-row>
                <div style={{ minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.source}</div>
                <div>
                  <StatusPill label={meta.label} color={meta.color} background={meta.bg} animated={run.status === "running"} />
                  {run.error ? <div className="mono" style={{ color: "var(--danger)", marginTop: 5, fontSize: 11 }}>{run.error}</div> : null}
                </div>
                <span className="right mono" style={{ color: run.status === "failed" ? "var(--danger)" : run.found !== "—" ? "var(--text)" : "var(--faint)" }}>{run.found}</span>
                <span className="right mono muted">{run.duration}</span>
                <span className="right mono faint">{run.started}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
