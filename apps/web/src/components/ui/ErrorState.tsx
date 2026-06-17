import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state">
      <AlertTriangle size={22} color="var(--danger)" />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>No se pudo cargar</div>
        <div className="muted" style={{ maxWidth: 320, fontSize: 12.5, lineHeight: 1.5 }}>{message}</div>
      </div>
      {onRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
    </div>
  );
}
