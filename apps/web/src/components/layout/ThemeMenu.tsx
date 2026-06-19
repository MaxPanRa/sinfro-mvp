import { Check } from "lucide-react";
import type { AccentId, Density, ThemeId } from "../../types/theme";

const themes: Array<{ id: ThemeId; name: string; bg: string; surface: string }> = [
  { id: "esmeralda", name: "Esmeralda", bg: "#0B0F0E", surface: "#111816" },
  { id: "pizarra", name: "Pizarra", bg: "#0C0E11", surface: "#14171C" },
  { id: "carbon", name: "Carbon", bg: "#100E0C", surface: "#1A1713" },
  { id: "medianoche", name: "Medianoche", bg: "#000000", surface: "#0B0D0C" },
  { id: "claro", name: "Claro", bg: "#F4F6F5", surface: "#FFFFFF" },
  { id: "cafe", name: "Café", bg: "#211B16", surface: "#2B231C" },
  { id: "terracota", name: "Terracota", bg: "#271A16", surface: "#32221C" },
  { id: "canela", name: "Canela", bg: "#241B12", surface: "#2F2317" },
  { id: "tabaco", name: "Tabaco", bg: "#241E14", surface: "#2F2719" },
  { id: "oliva", name: "Oliva", bg: "#1E2014", surface: "#282B1A" },
  { id: "vino", name: "Vino", bg: "#241519", surface: "#2F1D22" },
  { id: "arena", name: "Arena", bg: "#E8E0D3", surface: "#F3ECE0" },
  { id: "pergamino", name: "Pergamino", bg: "#EFE9DC", surface: "#F8F3E9" },
  { id: "durazno", name: "Durazno", bg: "#ECE1D8", surface: "#F7EEE6" },
  { id: "rosa", name: "Rosa", bg: "#E7DCDB", surface: "#F3EAE9" },
];

const densities: Array<{ id: Density; name: string }> = [
  { id: "comoda", name: "Cómoda" },
  { id: "compacta", name: "Compacta" },
  { id: "super", name: "Súper compacta" },
];

const accents: Array<{ id: AccentId; name: string; color: string }> = [
  { id: "#10A37F", name: "Esmeralda", color: "#10A37F" },
  { id: "#14B8A6", name: "Teal", color: "#14B8A6" },
  { id: "#84CC16", name: "Lima", color: "#84CC16" },
  { id: "#06B6D4", name: "Cian", color: "#06B6D4" },
  { id: "#4EA7F5", name: "Azul", color: "#4EA7F5" },
  { id: "#F2B84B", name: "Ambar", color: "#F2B84B" },
  { id: "#E5484D", name: "Rojo", color: "#E5484D" },
  { id: "#F97316", name: "Naranja", color: "#F97316" },
];

export function ThemeMenu({ theme, accent, density, onTheme, onAccent, onDensity }: { theme: ThemeId; accent: AccentId; density: Density; onTheme: (theme: ThemeId) => void; onAccent: (accent: AccentId) => void; onDensity: (density: Density) => void }) {
  const activeAccent = accents.find((item) => item.id.toLowerCase() === accent.toLowerCase()) ?? { id: accent, name: "Custom", color: accent || "#10A37F" };

  return (
    <div className="theme-menu">
      <div className="section-kicker" style={{ padding: "12px 14px 8px" }}>Tema</div>
      <div style={{ padding: "0 8px 6px", display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
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
      <div style={{ padding: "0 14px 15px", display: "flex", gap: 11, flexWrap: "wrap" }}>
        {accents.map((item) => (
          <button key={item.id} className={`accent-dot ${accent.toLowerCase() === item.id.toLowerCase() ? "is-active" : ""}`} title={item.name} style={{ background: item.color }} onClick={() => onAccent(item.id)} />
        ))}
        <input className="color-input is-compact" type="color" value={accent.startsWith("#") ? accent : activeAccent.color} onChange={(event) => onAccent(event.target.value)} title="Color personalizado" />
      </div>
      <div className="section-kicker" style={{ padding: "9px 14px 8px", borderTop: "1px solid var(--border)" }}>Densidad</div>
      <div className="segmented" style={{ margin: "0 14px 15px" }}>
        {densities.map((item) => (
          <button key={item.id} className={density === item.id ? "is-active" : ""} onClick={() => onDensity(item.id)}>{item.name}</button>
        ))}
      </div>
    </div>
  );
}
