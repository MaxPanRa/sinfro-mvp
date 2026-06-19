import { Menu, Palette, Zap } from "lucide-react";
import { Button } from "../ui/Button";
import { ThemeMenu } from "./ThemeMenu";
import type { AccentId, Density, ThemeId, ViewId } from "../../types/theme";

const titles: Record<ViewId, string> = {
  inbox: "Bandeja de vacantes",
  perfiles: "Perfiles",
  settings: "Conexiones",
  jobs: "Sync Runs",
  subscription: "Suscripcion",
};

interface TopBarProps {
  view: ViewId;
  subtitle: string;
  density: Density;
  syncing: boolean;
  theme: ThemeId;
  accent: AccentId;
  themeMenuOpen: boolean;
  onToggleNav: () => void;
  onDensity: (density: Density) => void;
  onRunSync: () => void;
  onToggleThemeMenu: () => void;
  onTheme: (theme: ThemeId) => void;
  onAccent: (accent: AccentId) => void;
}

export function TopBar({ view, subtitle, density, syncing, theme, accent, themeMenuOpen, onToggleNav, onDensity, onRunSync, onToggleThemeMenu, onTheme, onAccent }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="icon-button" onClick={onToggleNav} aria-label="Abrir navegacion">
        <Menu size={17} />
      </button>
      <div className="topbar-title">
        <h1>{titles[view]}</h1>
        <span className="mono faint" style={{ fontSize: 12 }}>{subtitle}</span>
      </div>
      <div className="spacer" />

      <div className="status-chip desktop-only">
        <span className={`status-dot ${syncing ? "is-running" : ""}`} />
        {syncing ? "Sincronizando..." : "Sync · hace 5 min"}
      </div>
      <div className="segmented desktop-only">
        <button className={density === "comoda" ? "is-active" : ""} onClick={() => onDensity("comoda")}>Comoda</button>
        <button className={density === "compacta" ? "is-active" : ""} onClick={() => onDensity("compacta")}>Compacta</button>
        <button className={density === "super" ? "is-active" : ""} onClick={() => onDensity("super")}>Super</button>
      </div>

      <div style={{ position: "relative", flexShrink: 0 }}>
        <button className="icon-button" onClick={onToggleThemeMenu} title="Tema" aria-label="Tema">
          <Palette size={16} />
        </button>
        {themeMenuOpen ? <ThemeMenu theme={theme} accent={accent} density={density} onTheme={onTheme} onAccent={onAccent} onDensity={onDensity} /> : null}
      </div>

      <Button variant="primary" onClick={onRunSync} icon={<Zap size={14} style={{ animation: syncing ? "pulse 0.9s infinite" : undefined }} />}>
        <span className="scan-label">{syncing ? "Escaneando..." : "Escanear ahora"}</span>
      </Button>
    </header>
  );
}
