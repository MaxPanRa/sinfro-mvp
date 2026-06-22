import { useEffect, useState } from "react";
import type { SyncRun } from "../types/sync";
import { apiClient, type ApiUsageInfo } from "../lib/apiClient";
import { SyncRunsTable } from "../components/sync/SyncRunsTable";

const API_LABELS: Record<string, string> = { serpapi: "SerpAPI", adzuna: "Adzuna", jooble: "Jooble", apify: "Apify" };

export function SyncRunsView({ runs, totalJobs, nuevas }: { runs: SyncRun[]; totalJobs: number; nuevas: number }) {
  const okRuns = runs.filter((run) => run.status === "success").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const [usage, setUsage] = useState<ApiUsageInfo[]>([]);

  useEffect(() => {
    apiClient.getMyApiUsage().then(setUsage).catch(() => undefined);
  }, [runs.length]);

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

        {usage.length ? (
          <>
            <div className="section-kicker" style={{ margin: "22px 0 10px" }}>Uso de APIs de búsqueda</div>
            <div className="sync-stats">
              {usage.map((item) => (
                <div key={item.provider} className="surface-card" style={{ padding: "14px 16px", borderRadius: 9 }}>
                  <div className="section-kicker" style={{ marginBottom: 6 }}>{API_LABELS[item.provider] ?? item.provider}</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
                    {item.quotaLimit ? `${item.used}/${item.quotaLimit}` : item.period === "rolling7" ? `${item.daysLeft ?? 0} d` : String(item.used)}
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div style={{ marginTop: 22 }}>
          <SyncRunsTable runs={runs} />
        </div>
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
