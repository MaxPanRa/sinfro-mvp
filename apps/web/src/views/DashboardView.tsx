import type { DetailTab, Job, JobFilter, JobSort } from "../types/job";
import type { Profile } from "../types/profile";
import { ActiveProfilePanel } from "../components/jobs/ActiveProfilePanel";
import { JobFilters, MobileJobControls } from "../components/jobs/JobFilters";
import { JobList } from "../components/jobs/JobList";
import { JobDetailPanel } from "../components/jobs/JobDetailPanel";

interface DashboardViewProps {
  jobs: Job[];
  activeProfile: Profile;
  search: string;
  filter: JobFilter;
  sort: JobSort;
  selectedJob: Job | null;
  detailTab: DetailTab;
  analyzing: boolean;
  keywordsExpanded: boolean;
  counts: { total: number; nuevas: number; alto: number; aplicadas: number; descartadas: number };
  onSearch: (value: string) => void;
  onFilter: (filter: JobFilter) => void;
  onSort: (sort: JobSort) => void;
  onSelectJob: (id: number) => void;
  onCloseDetail: () => void;
  onTab: (tab: DetailTab) => void;
  onApply: () => void;
  onDismiss: () => void;
  onAnalyze: () => void;
  onClearFilters: () => void;
  onToggleKeywords: () => void;
}

export function DashboardView(props: DashboardViewProps) {
  return (
    <div className="inbox-view">
      <aside className="params-panel">
        <ActiveProfilePanel profile={props.activeProfile} expanded={props.keywordsExpanded} onToggle={props.onToggleKeywords} />
        <JobFilters
          search={props.search}
          filter={props.filter}
          sort={props.sort}
          counts={props.counts}
          onSearch={props.onSearch}
          onFilter={props.onFilter}
          onSort={props.onSort}
        />
      </aside>
      <section className="list-area">
        <div className="list-scroll">
          <MobileJobControls search={props.search} filter={props.filter} counts={props.counts} onSearch={props.onSearch} onFilter={props.onFilter} />
          <div className="results-bar">
            <span className="mono faint" style={{ fontSize: 11.5 }}>{props.jobs.length} resultados</span>
            <div className="spacer" />
            <span className="faint" style={{ fontSize: 11 }}>Leyenda:</span>
            <Legend color="var(--accent)" label="Alto" />
            <Legend color="#4EA7F5" label="Medio" />
            <Legend color="#F2B84B" label="Bajo" />
          </div>
          <JobList jobs={props.jobs} selectedId={props.selectedJob?.id ?? null} onSelect={props.onSelectJob} onClearFilters={props.onClearFilters} />
        </div>
        {props.selectedJob ? (
          <JobDetailPanel
            job={props.selectedJob}
            tab={props.detailTab}
            analyzing={props.analyzing}
            onClose={props.onCloseDetail}
            onTab={props.onTab}
            onApply={props.onApply}
            onDismiss={props.onDismiss}
            onAnalyze={props.onAnalyze}
          />
        ) : null}
      </section>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text2)", fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}
