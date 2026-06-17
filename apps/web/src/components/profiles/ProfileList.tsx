import type { Profile } from "../../types/profile";

export function ProfileList({ profiles, activeId, onSelect }: { profiles: Profile[]; activeId: number; onSelect: (id: number) => void }) {
  return (
    <div className="profile-list">
      {profiles.map((profile) => (
        <button key={profile.id} className={`profile-card ${profile.id === activeId ? "is-active" : ""}`} onClick={() => onSelect(profile.id)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{profile.initials}</div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{profile.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{profile.role}</div>
            </div>
            {profile.id === activeId ? <span className="status-badge" style={{ color: "var(--accent)", background: "var(--accentW2)" }}>Activo</span> : null}
          </div>
          <div className="mono faint" style={{ display: "flex", gap: 14, fontSize: 11 }}>
            <span>{profile.skills.length} skills</span><span>·</span><span>{profile.cvStatus}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
