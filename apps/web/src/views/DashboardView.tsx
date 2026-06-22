import { useRef } from "react";
import type { AnalysisMode, DetailTab, Job, JobFilter, JobSort } from "../types/job";
import type { Profile } from "../types/profile";
import { ActiveProfilePanel } from "../components/jobs/ActiveProfilePanel";
import { InboxJobControls } from "../components/jobs/JobFilters";
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
  usesAi: boolean;
  analyzed?: "quick" | "deep";
  evaluation?: { mode?: string; markdown?: string };
  keywordsExpanded: boolean;
  counts: { total: number; nuevas: number; alto: number; aplicadas: number; descartadas: number };
  onSearch: (value: string) => void;
  onFilter: (filter: JobFilter) => void;
  onSort: (sort: JobSort) => void;
  onSelectJob: (id: number) => void;
  onCloseDetail: () => void;
  onTab: (tab: DetailTab) => void;
  onApply: () => void;
  onUnapply: () => void;
  onUndiscard: () => void;
  onDismiss: (reason: string) => void;
  onAnalyze: (mode: AnalysisMode) => void;
  onClearFilters: () => void;
  onToggleKeywords: () => void;
}

export function DashboardView(props: DashboardViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="inbox-view">
      <aside className="params-panel">
        <ActiveProfilePanel profile={props.activeProfile} expanded={props.keywordsExpanded} onToggle={props.onToggleKeywords} />
      </aside>
      <section className="list-area">
        <div className="list-scroll" ref={scrollRef}>
          <InboxJobControls
            search={props.search}
            filter={props.filter}
            sort={props.sort}
            counts={props.counts}
            onSearch={props.onSearch}
            onFilter={props.onFilter}
            onSort={props.onSort}
          />
          <JobList jobs={props.jobs} profile={props.activeProfile} selectedId={props.selectedJob?.id ?? null} scrollRef={scrollRef} onSelect={props.onSelectJob} onClearFilters={props.onClearFilters} />
        </div>
        {props.selectedJob ? (
          <JobDetailPanel
            job={props.selectedJob}
            tab={props.detailTab}
            analyzing={props.analyzing}
            usesAi={props.usesAi}
            analyzed={props.analyzed}
            profile={props.activeProfile}
            evaluation={props.evaluation}
            onClose={props.onCloseDetail}
            onTab={props.onTab}
            onApply={props.onApply}
            onUnapply={props.onUnapply}
            onUndiscard={props.onUndiscard}
            onDismiss={props.onDismiss}
            onAnalyze={props.onAnalyze}
          />
        ) : null}
      </section>
    </div>
  );
}
