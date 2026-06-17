import type { Profile } from "../../types/profile";
import { skillColor } from "../../lib/formatters";

export function ActiveProfilePanel({ profile, expanded, onToggle }: { profile: Profile; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <div className="panel-pad" style={{ paddingBottom: 14 }}>
        <div className="section-kicker" style={{ marginBottom: 10 }}>Perfil activo</div>
        <div className="active-profile-card">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
            <div className="avatar">{profile.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.name}</div>
              <div className="muted" style={{ fontSize: 11 }}>{profile.role}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 11 }} className="muted">
            <div><span className="faint">Ingles</span> · {profile.english}</div>
            <div><span className="faint">{profile.location}</span> · {profile.modality}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11, paddingTop: 11, borderTop: "1px solid var(--bdSoft)" }}>
            <span className="status-dot" />
            <span className="muted" style={{ fontSize: 11 }}>{profile.cvStatus} · <span style={{ color: "var(--text)" }}>{profile.skills.length} skills</span></span>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <div className="section-kicker">Contexto del perfil</div>
          <div className="spacer" />
          {expanded ? <button className="theme-option" style={{ width: "auto", padding: 0, fontSize: 10.5, color: "var(--text2)" }} onClick={onToggle}>ver menos</button> : null}
        </div>

        {!expanded ? (
          <div className="keyword-cloud">
            {profile.keywords.slice(0, 8).map((keyword) => <span className="chip" key={keyword}>{keyword}</span>)}
            {profile.keywords.length > 8 ? (
              <button className="chip" style={{ color: "var(--accent)", background: "var(--accentW1)", borderColor: "var(--accentW3)", cursor: "pointer", fontWeight: 600 }} onClick={onToggle}>
                +{profile.keywords.length - 8} ver todas
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div className="section-kicker" style={{ margin: "4px 0 7px", fontSize: 9.5 }}>Palabras clave · {profile.keywords.length}</div>
            <div className="keyword-cloud" style={{ marginBottom: 15 }}>
              {profile.keywords.map((keyword) => <span className="chip" key={keyword}>{keyword}</span>)}
            </div>
            <div className="section-kicker" style={{ margin: "0 0 7px", fontSize: 9.5 }}>Skills & tecnologias · {profile.skills.length}</div>
            <div className="keyword-cloud" style={{ marginBottom: 15 }}>
              {profile.skills.map((skill) => (
                <span className="chip skill-chip" key={skill.name}>{skill.name}<span className="level" style={{ background: skillColor(skill.level) }}>{skill.level}</span></span>
              ))}
            </div>
            <div className="section-kicker" style={{ margin: "0 0 7px", fontSize: 9.5 }}>Idiomas</div>
            <span className="chip">Ingles · {profile.english}</span>
          </div>
        )}
      </div>
    </>
  );
}
