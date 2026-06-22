import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { AccentId, Density, ThemeId, ViewId } from "../../types/theme";
import type { Profile } from "../../types/profile";
import { accentVars } from "../../lib/accent";

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
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  hasProfiles: boolean;
  planName: string;
  profilesUsed: number;
  profilesLimit: number;
  hasRunning: boolean;
  lastSync: { at: string; label: string } | null;
  onNavigate: (view: ViewId) => void;
  onCloseNav: () => void;
  onToggleNav: () => void;
  onDensity: (density: Density) => void;
  onRunSync: () => void;
  onToggleThemeMenu: () => void;
  onCloseThemeMenu: () => void;
  onTheme: (theme: ThemeId) => void;
  onAccent: (accent: AccentId) => void;
  onLogout: () => void;
  onHelp: () => void;
}

export function AppShell(props: AppShellProps) {
  return (
    <div className={`app-shell ${props.density === "compacta" || props.density === "super" ? "compact" : ""} ${props.density === "super" ? "super" : ""}`} data-theme={props.theme} style={accentVars(props.accent)} data-accent={props.accent}>
      <Sidebar
        activeView={props.view}
        counts={props.counts}
        activeProfile={props.activeProfile}
        userName={props.userName}
        userEmail={props.userEmail}
        isAdmin={props.isAdmin}
        hasProfiles={props.hasProfiles}
        planName={props.planName}
        profilesUsed={props.profilesUsed}
        profilesLimit={props.profilesLimit}
        hasRunning={props.hasRunning}
        isOpen={props.navOpen}
        onClose={props.onCloseNav}
        onNavigate={props.onNavigate}
        onLogout={props.onLogout}
        onHelp={props.onHelp}
      />
      <div className="main-shell">
        <TopBar
          view={props.view}
          density={props.density}
          syncing={props.syncing}
          lastSync={props.lastSync}
          theme={props.theme}
          accent={props.accent}
          navOpen={props.navOpen}
          themeMenuOpen={props.themeMenuOpen}
          onToggleNav={props.onToggleNav}
          onDensity={props.onDensity}
          onRunSync={props.onRunSync}
          onToggleThemeMenu={props.onToggleThemeMenu}
          onCloseThemeMenu={props.onCloseThemeMenu}
          onTheme={props.onTheme}
          onAccent={props.onAccent}
        />
        {props.syncing ? <div className="sync-progress" /> : null}
        <main className="content-shell">{props.children}</main>
      </div>
    </div>
  );
}

