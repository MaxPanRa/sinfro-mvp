import type { CSSProperties, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { AccentId, Density, ThemeId, ViewId } from "../../types/theme";
import type { Profile } from "../../types/profile";

interface AppShellProps {
  children: ReactNode;
  view: ViewId;
  subtitle: string;
  density: Density;
  theme: ThemeId;
  accent: AccentId;
  navOpen: boolean;
  syncing: boolean;
  themeMenuOpen: boolean;
  counts: { nuevas: number; connected: number };
  activeProfile: Profile;
  hasRunning: boolean;
  onNavigate: (view: ViewId) => void;
  onCloseNav: () => void;
  onToggleNav: () => void;
  onDensity: (density: Density) => void;
  onRunSync: () => void;
  onToggleThemeMenu: () => void;
  onTheme: (theme: ThemeId) => void;
  onAccent: (accent: AccentId) => void;
}

export function AppShell(props: AppShellProps) {
  return (
    <div className={`app-shell ${props.density === "compacta" || props.density === "super" ? "compact" : ""} ${props.density === "super" ? "super" : ""}`} data-theme={props.theme} style={accentVars(props.accent)} data-accent={props.accent}>
      <Sidebar
        activeView={props.view}
        counts={props.counts}
        activeProfile={props.activeProfile}
        hasRunning={props.hasRunning}
        isOpen={props.navOpen}
        onClose={props.onCloseNav}
        onNavigate={props.onNavigate}
      />
      <div className="main-shell">
        <TopBar
          view={props.view}
          subtitle={props.subtitle}
          density={props.density}
          syncing={props.syncing}
          theme={props.theme}
          accent={props.accent}
          themeMenuOpen={props.themeMenuOpen}
          onToggleNav={props.onToggleNav}
          onDensity={props.onDensity}
          onRunSync={props.onRunSync}
          onToggleThemeMenu={props.onToggleThemeMenu}
          onTheme={props.onTheme}
          onAccent={props.onAccent}
        />
        {props.syncing ? <div className="sync-progress" /> : null}
        <main className="content-shell">{props.children}</main>
      </div>
    </div>
  );
}

function accentVars(accent: string): CSSProperties {
  const color = accent.startsWith("#") ? accent : "#10A37F";
  const rgb = hexToRgb(color);
  if (!rgb) return {};
  const rgba = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  return {
    "--accent": color,
    "--accentH": color,
    "--accentW1": rgba(0.1),
    "--accentW2": rgba(0.13),
    "--accentW3": rgba(0.25),
    "--accentW4": rgba(0.28),
    "--accentGlow": rgba(0.4),
  } as CSSProperties;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
