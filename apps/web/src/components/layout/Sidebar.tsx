import { ChevronDown, LogOut, X } from "lucide-react";
import { routes } from "../../app/routes";
import type { ViewId } from "../../types/theme";
import type { Profile } from "../../types/profile";
import logoBlack from "../../assets/brand/logo_black.png";
import logoWhite from "../../assets/brand/logo_white.png";

interface SidebarProps {
  activeView: ViewId;
  counts: { nuevas: number; connected: number };
  activeProfile: Profile;
  hasRunning: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId) => void;
}

export function Sidebar({ activeView, counts, activeProfile, hasRunning, isOpen, onClose, onNavigate }: SidebarProps) {
  return (
    <>
      {isOpen ? <button className="nav-backdrop" aria-label="Cerrar navegacion" onClick={onClose} /> : null}
      <aside className={`sidebar ${isOpen ? "is-open" : ""}`}>
        <div className="sidebar__brand">
          <div className="brand-logo">
            <img className="brand-logo__image logo--light" src={logoWhite} alt="SinFro" />
            <img className="brand-logo__image logo--dark" src={logoBlack} alt="SinFro" />
          </div>
          <div style={{ flex: 1, lineHeight: 1.1 }}>
            <div className="brand-title">Sinfron</div>
            <div className="mono faint" style={{ fontSize: 10.5, marginTop: 2 }}>job radar · v0.2</div>
          </div>
          <button className="icon-button" onClick={onClose} style={{ width: 28, height: 28 }} aria-label="Cerrar menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <div className="section-kicker nav-kicker">Espacio de trabajo</div>
          {routes.map((route) => {
            const Icon = route.icon;
            const active = activeView === route.id;
            return (
              <button
                key={route.id}
                className={`nav-item ${active ? "is-active" : ""}`}
                onClick={() => {
                  onNavigate(route.id);
                  onClose();
                }}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span style={{ flex: 1 }}>{route.label}</span>
                {route.id === "inbox" ? <span className="pill-count is-accent">{counts.nuevas}</span> : null}
                {route.id === "settings" ? <span className="pill-count">{counts.connected}/10</span> : null}
                {route.id === "jobs" && hasRunning ? <span className="status-dot is-running" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="plan-card">
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Plan Free</span>
            <span className="pill-count">1 perfil</span>
          </div>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, marginBottom: 10 }}>Monitoreo multi-perfil y analisis profundo ilimitado en Pro.</div>
          <button className="ghost-button" style={{ width: "100%", padding: 7, color: "var(--accent)", background: "transparent" }}>Mejorar a Pro</button>
        </div>

        <div className="sidebar__user">
          <button className="user-button">
            <div className="avatar">{activeProfile.initials}</div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeProfile.name}</div>
              <div className="mono faint" style={{ fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeProfile.email}</div>
            </div>
            <ChevronDown size={14} color="var(--faint)" />
          </button>
          <button className="danger-button" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            <LogOut size={14} /> Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}
