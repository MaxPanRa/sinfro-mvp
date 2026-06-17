import { Check } from "lucide-react";
import type { AccentId, ThemeId } from "../../types/theme";

const themes: Array<{ id: ThemeId; name: string; bg: string; surface: string }> = [
  { id: "esmeralda", name: "Esmeralda", bg: "#0B0F0E", surface: "#111816" },
  { id: "pizarra", name: "Pizarra", bg: "#0C0E11", surface: "#14171C" },
  { id: "carbon", name: "Carbon", bg: "#100E0C", surface: "#1A1713" },
  { id: "medianoche", name: "Medianoche", bg: "#000000", surface: "#0B0D0C" },
  { id: "claro", name: "Claro", bg: "#F4F6F5", surface: "#FFFFFF" },
];

const accents: Array<{ id: AccentId; name: string; color: string }> = [
  { id: "esmeralda", name: "Esmeralda", color: "#10A37F" },
  { id: "teal", name: "Teal", color: "#14B8A6" },
  { id: "lima", name: "Lima", color: "#84CC16" },
  { id: "cian", name: "Cian", color: "#06B6D4" },
];

export function ThemeMenu({ theme, accent, onTheme, onAccent }: { theme: ThemeId; accent: AccentId; onTheme: (theme: ThemeId) => void; onAccent: (accent: AccentId) => void }) {
  const activeAccent = accents.find((item) => item.id === accent) ?? accents[0];

  return (
    <div className="theme-menu">
      <div className="section-kicker" style={{ padding: "12px 14px 8px" }}>Tema</div>
      <div style={{ padding: "0 8px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
        {themes.map((item) => (
          <button key={item.id} className={`theme-option ${theme === item.id ? "is-active" : ""}`} onClick={() => onTheme(item.id)}>
            <span className="swatch">
              <span style={{ flex: 1, background: item.bg }} />
              <span style={{ flex: 1, background: item.surface }} />
              <span style={{ width: 9, background: activeAccent.color }} />
            </span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{item.name}</span>
            {theme === item.id ? <Check size={14} color="var(--accent)" strokeWidth={2.4} /> : null}
          </button>
        ))}
      </div>
      <div className="section-kicker" style={{ padding: "9px 14px 8px", borderTop: "1px solid var(--border)" }}>Color de acento</div>
      <div style={{ padding: "0 14px 15px", display: "flex", gap: 11 }}>
        {accents.map((item) => (
          <button key={item.id} className={`accent-dot ${accent === item.id ? "is-active" : ""}`} title={item.name} style={{ background: item.color }} onClick={() => onAccent(item.id)} />
        ))}
      </div>
    </div>
  );
}
