import { ChevronDown, HelpCircle, LogOut, X } from "lucide-react";
import { useState } from "react";
import { routes } from "../../app/routes";
import type { ViewId } from "../../types/theme";
import type { Profile } from "../../types/profile";
import logoBlack from "../../assets/brand/logo_black.png";
import logoWhite from "../../assets/brand/logo_white.png";

interface SidebarProps {
  activeView: ViewId;
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
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  onHelp: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((word) => word[0]).join("") || "U").toUpperCase();
}

export function Sidebar({ activeView, counts, activeProfile, userName, userEmail, isAdmin, hasProfiles, planName, profilesUsed, profilesLimit, hasRunning, isOpen, onClose, onNavigate, onLogout, onHelp }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
          </div>
          <button className="icon-button nav-toggle" onClick={onClose} style={{ width: 28, height: 28 }} aria-label="Cerrar menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <div className="section-kicker nav-kicker">Espacio de trabajo</div>
          {routes.filter((route) => {
            // Sin perfiles, el usuario solo ve Perfiles, Suscripcion y Conexiones
            // (más rutas de admin si aplica); el resto aparece al crear su perfil.
            const allowedWithoutProfile = route.id === "perfiles" || route.id === "subscription" || route.id === "settings";
            if (!hasProfiles && !allowedWithoutProfile && !(route.adminOnly && isAdmin)) return false;
            return !route.adminOnly || isAdmin;
          }).map((route) => {
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
            <span style={{ fontSize: 11, fontWeight: 600 }}>Plan {planName}</span>
            <span className="pill-count">{profilesUsed}/{profilesLimit} {profilesLimit === 1 ? "perfil" : "perfiles"}</span>
          </div>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, marginBottom: 10 }}>
            {profilesUsed >= profilesLimit
              ? `Alcanzaste el máximo de ${profilesLimit} ${profilesLimit === 1 ? "perfil" : "perfiles"} de tu plan.`
              : `Puedes crear ${profilesLimit - profilesUsed} ${profilesLimit - profilesUsed === 1 ? "perfil más" : "perfiles más"} en tu plan.`}
          </div>
          <button className="ghost-button" style={{ width: "100%", padding: 7, color: "var(--accent)", background: "transparent" }} onClick={() => onNavigate("subscription")}>Ver planes</button>
        </div>

        <div className="sidebar__user">
          <button className="user-button" onClick={() => setUserMenuOpen((open) => !open)}>
            <div className="avatar">{initialsOf(userName)}</div>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
              <div className="mono faint" style={{ fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
              {activeProfile.id > 0 ? (
                <div className="faint" style={{ fontSize: 10.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Perfil activo: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{activeProfile.name}</span>
                </div>
              ) : null}
            </div>
            <ChevronDown size={14} color="var(--faint)" style={{ transition: "transform 0.15s", transform: userMenuOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {userMenuOpen ? (
            <div className="user-menu">
              <a className="user-menu__item" href="/privacidad" target="_blank" rel="noopener noreferrer">Politica de Privacidad</a>
              <a className="user-menu__item" href="/terminos" target="_blank" rel="noopener noreferrer">Condiciones del Servicio</a>
              <button className="user-menu__item" onClick={() => { setUserMenuOpen(false); onHelp(); }} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 12 }}>
                <HelpCircle size={13} /> Ayuda · ver tutorial
              </button>
            </div>
          ) : null}
          <button className="danger-button" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onLogout}>
            <LogOut size={14} /> Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}
