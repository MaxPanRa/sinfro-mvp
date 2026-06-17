import type { DetailTab } from "../../types/job";

const labels: Record<DetailTab, string> = {
  analisis: "Analisis",
  vacante: "Vacante original",
  historial: "Historial",
};

export function Tabs({ active, onChange }: { active: DetailTab; onChange: (tab: DetailTab) => void }) {
  return (
    <div className="tabs">
      {(Object.keys(labels) as DetailTab[]).map((tab) => (
        <button key={tab} className={`tab ${active === tab ? "is-active" : ""}`} onClick={() => onChange(tab)}>
          {labels[tab]}
        </button>
      ))}
    </div>
  );
}
