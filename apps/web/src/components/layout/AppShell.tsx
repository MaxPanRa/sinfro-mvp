import type { ReactNode } from "react";
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
    <div className={`app-shell ${props.density === "compacta" ? "compact" : ""}`} data-theme={props.theme} data-accent={props.accent}>
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
