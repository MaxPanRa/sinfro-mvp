import type { JobFilter, JobSort } from "../../types/job";
import { SearchInput } from "../ui/SearchInput";

interface FilterCounts {
  total: number;
  nuevas: number;
  alto: number;
  aplicadas: number;
  descartadas: number;
}

const filterLabels: Array<{ id: JobFilter; label: string; dot: string }> = [
  { id: "todas", label: "Todas", dot: "var(--bdStrong)" },
  { id: "nuevas", label: "Nuevas", dot: "#4EA7F5" },
  { id: "alto", label: "Alto match", dot: "var(--accent)" },
  { id: "aplicadas", label: "Aplicadas", dot: "var(--accent)" },
  { id: "descartadas", label: "Descartadas", dot: "#E5484D" },
];

export function JobFilters({ search, filter, sort, counts, onSearch, onFilter, onSort }: { search: string; filter: JobFilter; sort: JobSort; counts: FilterCounts; onSearch: (value: string) => void; onFilter: (filter: JobFilter) => void; onSort: (sort: JobSort) => void }) {
  return (
    <>
      <div style={{ padding: "0 16px 8px" }}>
        <SearchInput value={search} onChange={onSearch} placeholder="Buscar en la bandeja..." />
      </div>
      <div style={{ padding: "8px 16px 0" }}>
        <div className="section-kicker" style={{ marginBottom: 8 }}>Filtrar</div>
        <div className="filter-list">
          {filterLabels.map((item) => (
            <button key={item.id} className={`filter-button ${filter === item.id ? "is-active" : ""}`} onClick={() => onFilter(item.id)}>
              <span className="square-dot" style={{ background: item.dot }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span className="mono faint" style={{ fontSize: 11 }}>{counts[item.id === "todas" ? "total" : item.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "18px 16px 8px" }}>
        <div className="section-kicker" style={{ marginBottom: 8 }}>Ordenar por</div>
        <div className="segmented">
          <button style={{ flex: 1 }} className={sort === "score" ? "is-active" : ""} onClick={() => onSort("score")}>Score IA</button>
          <button style={{ flex: 1 }} className={sort === "fecha" ? "is-active" : ""} onClick={() => onSort("fecha")}>Fecha</button>
        </div>
      </div>
    </>
  );
}

export function MobileJobControls({ search, filter, counts, onSearch, onFilter }: Omit<Parameters<typeof JobFilters>[0], "sort" | "onSort">) {
  return (
    <div className="mobile-controls">
      <SearchInput value={search} onChange={onSearch} placeholder="Buscar..." />
      <div className="horizontal-chips">
        {filterLabels.map((item) => (
          <button key={item.id} className={`filter-button ${filter === item.id ? "is-active" : ""}`} style={{ whiteSpace: "nowrap", border: "1px solid var(--border)", borderRadius: 20 }} onClick={() => onFilter(item.id)}>
            <span className="square-dot" style={{ background: item.dot }} />
            {item.label} · {counts[item.id === "todas" ? "total" : item.id]}
          </button>
        ))}
      </div>
    </div>
  );
}
