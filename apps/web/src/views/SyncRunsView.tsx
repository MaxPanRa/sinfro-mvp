import type { SyncRun } from "../types/sync";
import { SyncRunsTable } from "../components/sync/SyncRunsTable";

export function SyncRunsView({ runs, totalJobs, nuevas }: { runs: SyncRun[]; totalJobs: number; nuevas: number }) {
  const okRuns = runs.filter((run) => run.status === "success").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Historial de ejecuciones</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>ultimas 24 h</span>
        </div>

        <div className="sync-stats">
          <Stat title="Vacantes" value={String(totalJobs)} />
          <Stat title="Nuevas" value={String(nuevas)} accent />
          <Stat title="Runs OK" value={String(okRuns)} />
          <Stat title="Fallidos" value={String(failedRuns)} danger />
        </div>

        <SyncRunsTable runs={runs} />
      </div>
    </div>
  );
}

function Stat({ title, value, accent, danger }: { title: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="surface-card" style={{ padding: "16px 18px", borderRadius: 9 }}>
      <div className="section-kicker" style={{ marginBottom: 8 }}>{title}</div>
      <div className="mono" style={{ color: danger ? "var(--danger)" : accent ? "var(--accent)" : "var(--text)", fontSize: 26, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
