import type { CSSProperties, ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  color?: string;
  background?: string;
  className?: string;
}

export function Badge({ children, color = "var(--text2)", background = "rgba(143,163,155,0.10)", className = "" }: BadgeProps) {
  return (
    <span className={`status-badge ${className}`} style={{ color, background }}>
      {children}
    </span>
  );
}

export function StatusPill({ label, color, background, animated = false }: { label: string; color: string; background: string; animated?: boolean }) {
  const dotStyle: CSSProperties = { background: color, animation: animated ? "pulse 1.2s infinite" : undefined };
  return (
    <span className="status-badge" style={{ color, background, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "3px 9px", fontSize: 11.5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", ...dotStyle }} />
      {label}
    </span>
  );
}
