import type { Profile } from "../../types/profile";
import { skillColor } from "../../lib/formatters";
import { Button } from "../ui/Button";

export function ProfileDetail({ profile, onEdit }: { profile: Profile; onEdit: () => void }) {
  return (
    <section className="profile-detail">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
        <div className="avatar" style={{ width: 46, height: 46, borderRadius: 9, fontSize: 16, fontWeight: 700 }}>{profile.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{profile.name}</h3>
            <span className="status-badge" style={{ color: "var(--accent)", background: "var(--accentW2)" }}>Activo</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{profile.role} · {profile.email}</div>
        </div>
        <Button onClick={onEdit}>Editar</Button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <Stat title="Ingles" value={profile.english} />
        <Stat title="Ubicacion" value={`${profile.location} · ${profile.modality}`} />
        <Stat title="Salario" value={profile.salary} accent />
        <Stat title="CV" value={profile.cvStatus.replace(/^CV\s*/i, "") || profile.cvStatus} dot />
      </div>

      <div className="section-kicker" style={{ marginBottom: 12 }}>Skills detectadas en el CV</div>
      <div className="keyword-cloud" style={{ marginBottom: 24 }}>
        {profile.skills.map((skill) => (
          <span className="chip skill-chip" key={skill.name} style={{ fontSize: 12, padding: "4px 9px 4px 11px" }}>
            {skill.name}<span className="level" style={{ background: skillColor(skill.level), width: 17, height: 17, fontSize: 10.5 }}>{skill.level}</span>
          </span>
        ))}
      </div>

      <div className="section-kicker" style={{ marginBottom: 11 }}>Descripcion del perfil <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· se usa en cada evaluacion</span></div>
      <p style={{ margin: 0, padding: "14px 16px", background: "var(--bg)", border: "1px solid var(--bdSoft2)", borderRadius: 8, color: "var(--text1)", fontSize: 13, lineHeight: 1.65 }}>
        {profile.description}
      </p>
    </section>
  );
}

function Stat({ title, value, accent, dot }: { title: string; value: string; accent?: boolean; dot?: boolean }) {
  return (
    <div className="stat-card">
      <div className="section-kicker" style={{ marginBottom: 6, letterSpacing: "0.08em" }}>{title}</div>
      <div className={accent ? "mono" : ""} style={{ display: "flex", alignItems: "center", gap: 6, color: accent ? "var(--accent)" : "var(--text)", fontSize: 14, fontWeight: 600 }}>
        {dot ? <span className="status-dot" /> : null}
        {value}
      </div>
    </div>
  );
}
