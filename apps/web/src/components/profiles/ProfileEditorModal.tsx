import { FileText, Sparkles, UserRound, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProfileDraft } from "../../types/profile";
import { initialsOf, skillColor } from "../../lib/formatters";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface ProfileEditorModalProps {
  open: boolean;
  draft: ProfileDraft | null;
  onClose: () => void;
  onSave: (draft: ProfileDraft) => void;
}

export function ProfileEditorModal({ open, draft, onClose, onSave }: ProfileEditorModalProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newLevel, setNewLevel] = useState(7);
  const [localDraft, setLocalDraft] = useState<ProfileDraft | null>(draft);

  useEffect(() => {
    if (open) {
      setLocalDraft(draft);
      setNewKeyword("");
      setNewSkill("");
      setNewLevel(7);
    }
  }, [draft, open]);

  if (!localDraft) return null;

  const setField = (field: keyof ProfileDraft, value: string | boolean) => setLocalDraft({ ...localDraft, [field]: value });
  const addKeyword = () => {
    const value = newKeyword.trim().toLowerCase();
    if (!value || localDraft.keywords.includes(value)) return setNewKeyword("");
    setLocalDraft({ ...localDraft, keywords: [...localDraft.keywords, value] });
    setNewKeyword("");
  };
  const addSkill = () => {
    const value = newSkill.trim();
    if (!value || localDraft.skills.some((skill) => skill.name.toLowerCase() === value.toLowerCase())) return setNewSkill("");
    setLocalDraft({ ...localDraft, skills: [...localDraft.skills, { name: value, level: newLevel }] });
    setNewSkill("");
  };

  return (
    <Modal open={open} onClose={onClose}>
      <section className="modal-panel">
        <div className="modal-header">
          <div className="avatar" style={{ width: 34, height: 34, borderRadius: 8 }}><UserRound size={17} /></div>
          <div className="spacer">
            <h3 style={{ margin: 0, fontSize: 16 }}>Editar perfil</h3>
            <div className="faint" style={{ fontSize: 11.5 }}>Se usa para evaluar cada vacante con IA</div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <label>
              <span className="label">Nombre del perfil</span>
              <input className="field" value={localDraft.name} onChange={(event) => setField("name", event.target.value)} placeholder="Ej. Max Panra" />
            </label>
            <label>
              <span className="label">Rol objetivo</span>
              <input className="field" value={localDraft.role} onChange={(event) => setField("role", event.target.value)} placeholder="Ej. Frontend / Fullstack" />
            </label>
          </div>

          <label className="form-block" style={{ display: "block", marginBottom: 18 }}>
            <span className="label">Correo de este perfil</span>
            <input className="field mono" value={localDraft.email} onChange={(event) => setField("email", event.target.value)} placeholder="correo@ejemplo.com" />
          </label>

          <div style={{ marginBottom: 20 }}>
            <span className="label">CV</span>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px", background: "var(--bg)", border: "1px dashed var(--bdStrong)", borderRadius: 8 }}>
              <div className="avatar"><FileText size={16} /></div>
              <div className="spacer">
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{localDraft.cvStatus}</div>
                <div className="faint" style={{ fontSize: 11 }}>Al cargarlo se autollenan skills y palabras clave con IA</div>
              </div>
              <Button icon={<Sparkles size={13} />}>Analizar CV</Button>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 20 }}>
            <label>
              <span className="label">Nivel de ingles</span>
              <select className="field select" value={localDraft.english} onChange={(event) => setField("english", event.target.value)}>
                <option>A2 · Basico</option><option>B1 · Intermedio</option><option>B2 · Avanzado</option><option>C1 · Fluido</option><option>C2 · Nativo</option>
              </select>
            </label>
            <label>
              <span className="label">Modalidad</span>
              <select className="field select" value={localDraft.modality} onChange={(event) => setField("modality", event.target.value)}>
                <option>Remoto</option><option>Remoto, Hibrido</option><option>Hibrido</option><option>Presencial</option>
              </select>
            </label>
          </div>

          <div className="form-grid" style={{ marginBottom: 22 }}>
            <label>
              <span className="label">Ubicacion deseada</span>
              <input className="field" value={localDraft.location} onChange={(event) => setField("location", event.target.value)} />
            </label>
            <label>
              <span className="label">Salario deseado</span>
              <input className="field mono" value={localDraft.salary} onChange={(event) => setField("salary", event.target.value)} />
            </label>
          </div>

          <EditableChips
            title={`Palabras clave · ${localDraft.keywords.length}`}
            empty="Sin palabras clave aun"
            value={newKeyword}
            placeholder="Escribe y presiona Enter..."
            onValue={setNewKeyword}
            onAdd={addKeyword}
            onEnter={addKeyword}
          >
            {localDraft.keywords.map((keyword) => (
              <span className="chip" key={keyword}>{keyword}<Remove onClick={() => setLocalDraft({ ...localDraft, keywords: localDraft.keywords.filter((item) => item !== keyword) })} /></span>
            ))}
          </EditableChips>

          <EditableChips
            title={`Skills & tecnologias · ${localDraft.skills.length}`}
            empty="Sin skills aun"
            value={newSkill}
            placeholder="Skill (ej. React)..."
            onValue={setNewSkill}
            onAdd={addSkill}
            onEnter={addSkill}
            level={newLevel}
            onLevel={setNewLevel}
          >
            {localDraft.skills.map((skill) => (
              <span className="chip skill-chip" key={skill.name}>{skill.name}<span className="level" style={{ background: skillColor(skill.level) }}>{skill.level}</span><Remove onClick={() => setLocalDraft({ ...localDraft, skills: localDraft.skills.filter((item) => item.name !== skill.name) })} /></span>
            ))}
          </EditableChips>

          <label className="form-block" style={{ display: "block", marginTop: 20 }}>
            <span className="label">Descripcion del perfil</span>
            <textarea className="textarea" value={localDraft.description} onChange={(event) => setField("description", event.target.value)} placeholder="Resumen profesional que la IA usara para evaluar compatibilidad..." />
          </label>
        </div>

        <div className="modal-footer">
          <button className="switch-button" onClick={() => setField("active", !localDraft.active)}>
            <span className={`switch ${localDraft.active ? "is-on" : ""}`} />
            <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>Marcar como perfil activo</span>
          </button>
          <div className="spacer" />
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<Check size={15} />} onClick={() => onSave({ ...localDraft, initials: localDraft.initials || initialsOf(localDraft.name || "Perfil") })}>Guardar perfil</Button>
        </div>
      </section>
    </Modal>
  );
}

function EditableChips({ title, empty, children, value, placeholder, onValue, onAdd, onEnter, level, onLevel }: { title: string; empty: string; children: React.ReactNode; value: string; placeholder: string; onValue: (value: string) => void; onAdd: () => void; onEnter: () => void; level?: number; onLevel?: (value: number) => void }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div style={{ marginBottom: 20 }}>
      <span className="label">{title}</span>
      <div className="keyword-cloud" style={{ marginBottom: 9 }}>
        {hasChildren ? children : <span className="faint" style={{ fontSize: 11.5 }}>{empty}</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="field" value={value} placeholder={placeholder} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onEnter(); } }} />
        {typeof level === "number" && onLevel ? (
          <select className="field select" style={{ width: 118, flexShrink: 0 }} value={level} onChange={(event) => onLevel(Number(event.target.value))}>
            {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>Nivel {index + 1}</option>)}
          </select>
        ) : null}
        <Button onClick={onAdd}>Agregar</Button>
      </div>
    </div>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ border: 0, background: "transparent", color: "var(--faint)", cursor: "pointer", display: "flex", padding: 0 }}>
      <X size={12} />
    </button>
  );
}
