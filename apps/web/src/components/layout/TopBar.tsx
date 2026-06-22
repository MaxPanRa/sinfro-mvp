import { useEffect, useRef } from "react";
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
  admin_users: "Admin Usuarios",
  admin_codes: "Admin Codigos",
};

interface TopBarProps {
  view: ViewId;
  density: Density;
  syncing: boolean;
  theme: ThemeId;
  accent: AccentId;
  navOpen: boolean;
  themeMenuOpen: boolean;
  onToggleNav: () => void;
  onDensity: (density: Density) => void;
  onRunSync: () => void;
  onToggleThemeMenu: () => void;
  onCloseThemeMenu: () => void;
  onTheme: (theme: ThemeId) => void;
  onAccent: (accent: AccentId) => void;
}

export function TopBar({ view, density, syncing, theme, accent, navOpen, themeMenuOpen, onToggleNav, onDensity, onRunSync, onToggleThemeMenu, onCloseThemeMenu, onTheme, onAccent }: TopBarProps) {
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!themeMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) onCloseThemeMenu();
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [onCloseThemeMenu, themeMenuOpen]);

  return (
    <header className="topbar">
      {!navOpen ? (
        <button className="icon-button nav-toggle" onClick={onToggleNav} aria-label="Abrir navegacion">
          <Menu size={17} />
        </button>
      ) : null}
      <div className="topbar-title">
        <h1>{titles[view]}</h1>
      </div>
      <div className="spacer" />

      <div className="status-chip desktop-only">
        <span className={`status-dot ${syncing ? "is-running" : ""}`} />
        {syncing ? "Sincronizando..." : "Sync · hace 5 min"}
      </div>
      <div ref={themeMenuRef} style={{ position: "relative", flexShrink: 0 }}>
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
