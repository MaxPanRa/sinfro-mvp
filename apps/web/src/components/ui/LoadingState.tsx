import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="empty-state">
      <Loader2 size={20} style={{ animation: "spin 0.9s linear infinite", color: "var(--accent)" }} />
      <div className="mono" style={{ color: "var(--accent)", fontSize: 12.5 }}>{label}</div>
    </div>
  );
}
