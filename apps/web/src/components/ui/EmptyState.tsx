import { SearchX } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="icon-button" aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 12 }}>
        <SearchX size={22} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{title}</div>
        <div className="muted" style={{ maxWidth: 280, fontSize: 12.5, lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
