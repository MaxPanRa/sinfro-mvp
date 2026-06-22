import { AlertTriangle, Download, FileText, Loader2, Sparkles, Trash2, UserRound, X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Profile, ProfileDraft, ProfileSkill } from "../../types/profile";
import { apiClient } from "../../lib/apiClient";
import { initialsOf, skillColor } from "../../lib/formatters";
import { SKILL_CATALOG } from "../../lib/skillsCatalog";
import { LOCATION_CATALOG } from "../../lib/locationsCatalog";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface ProfileEditorModalProps {
  open: boolean;
  draft: ProfileDraft | null;
  usesAi: boolean;
  existing: boolean;
  onClose: () => void;
  onSave: (draft: ProfileDraft) => void;
  onDelete: (id: number) => void;
  onProfileUpdated?: (profile: Profile) => void;
}

export function ProfileEditorModal({ open, draft, usesAi, existing, onClose, onSave, onDelete, onProfileUpdated }: ProfileEditorModalProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newLevel, setNewLevel] = useState(7);
  const [localDraft, setLocalDraft] = useState<ProfileDraft | null>(draft);
  const [analyzing, setAnalyzing] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocalDraft(draft);
      setNewKeyword("");
      setNewSkill("");
      setNewLevel(7);
      setAnalyzing(false);
      setCvBusy(false);
      setCvError(null);
      setConfirmDelete(false);
    }
  }, [draft, open]);

  const handleCvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite re-subir el mismo archivo
    if (!file) return;
    setCvError(null);
    setAnalyzing(true);
    try {
      const profileId = localDraft?.id ?? 0;
      const saved = existing && profileId > 0 ? await apiClient.uploadProfileCv(profileId, file) : null;
      const result = saved ? saved.analysis : await apiClient.analyzeCv(file);
      if (saved) onProfileUpdated?.(saved.profile);
      setLocalDraft((prev) => {
        if (!prev) return prev;
        const existingSkills = new Set(prev.skills.map((skill) => skill.name.toLowerCase()));
        const mergedSkills = [...prev.skills, ...result.skills.filter((skill) => !existingSkills.has(skill.name.toLowerCase()))];
        const existingKeywords = new Set(prev.keywords.map((keyword) => keyword.toLowerCase()));
        const mergedKeywords = [...prev.keywords, ...result.keywords.filter((keyword) => !existingKeywords.has(keyword.toLowerCase()))];
        // Campos que solo trae el análisis con IA: se rellenan sin pisar lo que
        // el usuario ya haya escrito (merge, no overwrite).
        const fillIfEmpty = (current: string, incoming?: string) => (current.trim() ? current : (incoming || "").trim() || current);
        // El nivel de inglés sí lo deriva la IA del CV: lo aplicamos si lo dedujo.
        const english = englishOption(result.english) ?? prev.english;
        const engineLabel = result.engine && result.engine !== "local" ? `IA (${result.engine})` : "local";
        return {
          ...prev,
          name: fillIfEmpty(prev.name, result.name),
          role: fillIfEmpty(prev.role, result.role),
          email: fillIfEmpty(prev.email, result.email),
          location: fillIfEmpty(prev.location, result.location),
          english,
          salary: fillIfEmpty(prev.salary, result.salary),
          skills: mergedSkills,
          keywords: mergedKeywords,
          description: prev.description.trim() ? prev.description : result.summary,
          cvStatus: saved ? saved.profile.cvStatus : `${file.name} · analizado con ${engineLabel} (sin guardar)`,
          cvDocument: saved ? saved.document : prev.cvDocument,
        };
      });
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "No se pudo analizar el CV.");
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadCv = async () => {
    if (!localDraft?.cvDocument) return;
    setCvBusy(true);
    setCvError(null);
    try {
      await apiClient.downloadProfileCv(localDraft.id, localDraft.cvDocument.filename);
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "No se pudo descargar el CV.");
    } finally {
      setCvBusy(false);
    }
  };

  const deleteCv = async () => {
    if (!localDraft?.cvDocument) return;
    setCvBusy(true);
    setCvError(null);
    try {
      const result = await apiClient.deleteProfileCv(localDraft.id);
      onProfileUpdated?.(result.profile);
      setLocalDraft({ ...localDraft, cvStatus: result.profile.cvStatus, cvDocument: result.profile.cvDocument });
    } catch (error) {
      setCvError(error instanceof Error ? error.message : "No se pudo eliminar el CV.");
    } finally {
      setCvBusy(false);
    }
  };

  if (!localDraft) return null;

  const setField = (field: keyof ProfileDraft, value: string | boolean) => setLocalDraft({ ...localDraft, [field]: value });
  const addKeyword = () => {
    const value = newKeyword.trim().toLowerCase();
    if (!value || localDraft.keywords.includes(value)) return setNewKeyword("");
    setLocalDraft({ ...localDraft, keywords: [...localDraft.keywords, value] });
    setNewKeyword("");
  };
  const hasSkill = (name: string) => localDraft.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase());
  const addSkillNamed = (rawName: string) => {
    const value = rawName.trim();
    if (!value) return setNewSkill("");
    // Si coincide con el catálogo, normaliza al nombre canónico; si no, tal cual.
    const canonical = SKILL_CATALOG.find((skill) => skill.toLowerCase() === value.toLowerCase()) ?? value;
    if (hasSkill(canonical)) return setNewSkill("");
    setLocalDraft({ ...localDraft, skills: [...localDraft.skills, { name: canonical, level: newLevel }] });
    setNewSkill("");
  };
  const addSkill = () => addSkillNamed(newSkill);
  const setSkillLevel = (name: string, level: number) =>
    setLocalDraft({ ...localDraft, skills: localDraft.skills.map((skill) => (skill.name === name ? { ...skill, level } : skill)) });
  const removeSkill = (name: string) =>
    setLocalDraft({ ...localDraft, skills: localDraft.skills.filter((skill) => skill.name !== name) });

  const query = newSkill.trim().toLowerCase();
  const skillSuggestions = query.length >= 1
    ? SKILL_CATALOG.filter((skill) => skill.toLowerCase().includes(query) && !hasSkill(skill)).slice(0, 6)
    : [];

  return (
    <Modal open={open} onClose={onClose}>
      <section className="modal-panel">
        <div className="modal-header">
          <div className="avatar" style={{ width: 34, height: 34, borderRadius: 8 }}><UserRound size={17} /></div>
          <div className="spacer">
            <h3 style={{ margin: 0, fontSize: 16 }}>Editar perfil</h3>
            <div className="faint" style={{ fontSize: 11.5 }}>{usesAi ? "Se usa para evaluar cada vacante con IA" : "Se usa para evaluar cada vacante semánticamente"}</div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 20 }}>
            <span className="label">Empieza por tu CV</span>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px", background: "var(--bg)", border: "1px dashed var(--bdStrong)", borderRadius: 8 }}>
              <div className="avatar"><FileText size={16} /></div>
              <div className="spacer">
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{localDraft.cvStatus}</div>
                <div className="faint" style={{ fontSize: 11 }}>
                  {existing ? "Sube tu CV (PDF/DOCX): se guarda cifrado y autollena nombre, correo, ubicación, skills, salario estimado y resumen." : "Sube tu CV (PDF/DOCX): se analiza para autollenar. Guarda el perfil antes de conservar el archivo."}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" hidden onChange={handleCvFile} />
              <Button
                icon={analyzing ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                disabled={analyzing}
                onClick={() => fileInputRef.current?.click()}
              >
                {analyzing ? "Analizando..." : "Subir y analizar"}
              </Button>
              {existing && localDraft.cvDocument ? (
                <>
                  <Button icon={<Download size={13} />} disabled={cvBusy || analyzing} onClick={downloadCv}>Descargar</Button>
                  <Button variant="danger" icon={<Trash2 size={13} />} disabled={cvBusy || analyzing} onClick={deleteCv}>Eliminar CV</Button>
                </>
              ) : null}
            </div>
            {cvError ? <div style={{ marginTop: 7, fontSize: 11.5, color: "var(--danger)" }}>{cvError}</div> : null}
          </div>

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

          <div className="form-grid" style={{ marginBottom: 22, alignItems: "start" }}>
            <div className="form-cell">
              <span className="label">Ubicacion deseada</span>
              <LocationField value={localDraft.location} onChange={(value) => setField("location", value)} />
            </div>
            <div className="form-cell">
              <span className="label">Salario deseado (mensual)</span>
              <SalaryField value={localDraft.salary} onChange={(value) => setField("salary", value)} />
            </div>
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
            suggestions={skillSuggestions}
            onPick={addSkillNamed}
          >
            {localDraft.skills.map((skill) => (
              <SkillChip key={skill.name} skill={skill} onLevel={(level) => setSkillLevel(skill.name, level)} onRemove={() => removeSkill(skill.name)} />
            ))}
          </EditableChips>

          <label className="form-block" style={{ display: "block", marginTop: 20 }}>
            <span className="label">Descripcion del perfil</span>
            <textarea className="textarea" value={localDraft.description} onChange={(event) => setField("description", event.target.value)} placeholder={usesAi ? "Resumen profesional que la IA usara para evaluar compatibilidad..." : "Resumen profesional que se usara para evaluar compatibilidad semanticamente..."} />
          </label>
        </div>

        {confirmDelete ? (
          <div className="modal-footer" style={{ flexDirection: "column", alignItems: "stretch", gap: 12, background: "rgba(229,72,77,0.07)", borderTop: "1px solid var(--danger)" }}>
            <div style={{ display: "flex", gap: 11 }}>
              <AlertTriangle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>¿Eliminar el perfil "{localDraft.name || "Sin nombre"}"?</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
                  Esta acción <strong>también borra TODAS tus vacantes</strong> (nuevas, vistas, aplicadas y descartadas). Es permanente y <strong>no se puede deshacer</strong>.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => onDelete(localDraft.id)}>Sí, eliminar perfil y vacantes</Button>
            </div>
          </div>
        ) : (
          <div className="modal-footer">
            {existing ? (
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>Eliminar</Button>
            ) : null}
            <button className="switch-button" onClick={() => setField("active", !localDraft.active)}>
              <span className={`switch ${localDraft.active ? "is-on" : ""}`} />
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>Marcar como perfil activo</span>
            </button>
            <div className="spacer" />
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" icon={<Check size={15} />} onClick={() => onSave({ ...localDraft, initials: localDraft.initials || initialsOf(localDraft.name || "Perfil") })}>Guardar perfil</Button>
          </div>
        )}
      </section>
    </Modal>
  );
}

function EditableChips({ title, empty, children, value, placeholder, onValue, onAdd, onEnter, level, onLevel, suggestions = [], onPick }: { title: string; empty: string; children: React.ReactNode; value: string; placeholder: string; onValue: (value: string) => void; onAdd: () => void; onEnter: () => void; level?: number; onLevel?: (value: number) => void; suggestions?: string[]; onPick?: (value: string) => void }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div style={{ marginBottom: 20 }}>
      <span className="label">{title}</span>
      <div className="keyword-cloud" style={{ marginBottom: 9 }}>
        {hasChildren ? children : <span className="faint" style={{ fontSize: 11.5 }}>{empty}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <input className="field" value={value} placeholder={placeholder} onChange={(event) => onValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onEnter(); } }} />
        {typeof level === "number" && onLevel ? (
          <select className="field select" style={{ width: 118, flexShrink: 0 }} value={level} onChange={(event) => onLevel(Number(event.target.value))}>
            {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>Nivel {index + 1}</option>)}
          </select>
        ) : null}
        <Button onClick={onAdd}>Agregar</Button>
        {onPick && suggestions.length > 0 ? (
          <div className="skill-suggestions">
            {suggestions.map((item) => (
              <button type="button" key={item} className="skill-suggestion" onMouseDown={(event) => { event.preventDefault(); onPick(item); }}>{item}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LocationField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [input, setInput] = useState("");
  const locations = value.split(",").map((item) => item.trim()).filter(Boolean);

  const has = (name: string) => locations.some((item) => item.toLowerCase() === name.toLowerCase());
  const commit = (next: string[]) => onChange(next.join(", "));

  const add = (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return setInput("");
    // Si coincide con el catálogo, normaliza al nombre canónico; si no, tal cual.
    const canonical = LOCATION_CATALOG.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    if (!has(canonical)) commit([...locations, canonical]);
    setInput("");
  };
  const remove = (name: string) => commit(locations.filter((item) => item !== name));

  const query = input.trim().toLowerCase();
  const suggestions = query.length >= 1
    ? LOCATION_CATALOG.filter((item) => item.toLowerCase().includes(query) && !has(item)).slice(0, 6)
    : [];

  return (
    <div>
      <div className="keyword-cloud" style={{ marginBottom: 9 }}>
        {locations.length > 0
          ? locations.map((item) => (
              <span className="chip" key={item}>{item}<Remove onClick={() => remove(item)} /></span>
            ))
          : <span className="faint" style={{ fontSize: 11.5 }}>Sin ubicaciones aun</span>}
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <input
          className="field"
          value={input}
          placeholder="Ciudad, estado o pais..."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(input); } }}
        />
        <Button onClick={() => add(input)}>Agregar</Button>
        {suggestions.length > 0 ? (
          <div className="skill-suggestions">
            {suggestions.map((item) => (
              <button type="button" key={item} className="skill-suggestion" onMouseDown={(event) => { event.preventDefault(); add(item); }}>{item}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CURRENCIES = ["USD", "MXN", "EUR", "CAD"];

// Opciones del select de inglés (deben coincidir con el <select> de arriba).
const ENGLISH_BY_LEVEL: Record<string, string> = {
  A1: "A2 · Basico", A2: "A2 · Basico",
  B1: "B1 · Intermedio", B2: "B2 · Avanzado",
  C1: "C1 · Fluido", C2: "C2 · Nativo",
};

// Mapea un nivel MCER (A1..C2) que devuelve la IA a la opción del select; undefined si no aplica.
function englishOption(level?: string): string | undefined {
  const token = (level || "").match(/[ABC][12]/i)?.[0]?.toUpperCase();
  return token ? ENGLISH_BY_LEVEL[token] : undefined;
}

// Solo dígitos (hasta 9), agrupados con coma de miles para mostrar.
const onlyDigits = (raw: string) => raw.replace(/\D/g, "").slice(0, 9);
const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Lee un string de salario tolerando ruido ("$", segundo "$", "/mes", "k").
// Toma los dos primeros números y la primera moneda conocida que aparezca.
function parseSalary(value: string): { min: string; max: string; currency: string } {
  const inThousands = /\d\s*k\b/i.test(value); // formato viejo "4-6k"
  const numbers = (value.match(/\d[\d,]*/g) ?? []).map(onlyDigits).filter(Boolean);
  const scale = (digits: string) => (inThousands && digits ? `${digits}000`.slice(0, 9) : digits);
  const currency = (value.match(/\b(USD|MXN|EUR|CAD)\b/i)?.[1] ?? "").toUpperCase();
  return {
    min: scale(numbers[0] ?? ""),
    max: scale(numbers[1] ?? ""),
    currency: CURRENCIES.includes(currency) ? currency : "USD",
  };
}

function SalaryField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { min, max, currency } = parseSalary(value);

  const compose = (nextMin: string, nextMax: string, nextCurrency: string) => {
    // Si no hay ningún monto, dejamos el campo vacío (sin salario deseado).
    if (!nextMin && !nextMax) return onChange("");
    onChange(`$${withCommas(nextMin)} - ${withCommas(nextMax)} ${nextCurrency}/mes`);
  };
  // Al salir del campo: si ambos montos existen y el mínimo supera al máximo,
  // los intercambia para que el rango quede siempre ordenado.
  const reorder = () => {
    if (min && max && Number(min) > Number(max)) compose(max, min, currency);
  };

  return (
    <div>
      <div className="currency-row">
        {CURRENCIES.map((code) => (
          <button
            type="button"
            key={code}
            className={`chip currency-chip ${code === currency ? "is-active" : ""}`}
            onClick={() => compose(min, max, code)}
          >
            {code}
          </button>
        ))}
      </div>
      <div className="salary-mask">
        <span className="cur">$</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={withCommas(min)}
          onChange={(event) => compose(onlyDigits(event.target.value), max, currency)}
          onBlur={reorder}
          aria-label="Salario mínimo mensual"
        />
        <span className="sep">–</span>
        <input
          inputMode="numeric"
          placeholder="0"
          value={withCommas(max)}
          onChange={(event) => compose(min, onlyDigits(event.target.value), currency)}
          onBlur={reorder}
          aria-label="Salario máximo mensual"
        />
        <span className="cur">{currency}</span>
        <span className="per">/ mes</span>
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

function SkillChip({ skill, onLevel, onRemove }: { skill: ProfileSkill; onLevel: (level: number) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const levelRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const open = () => {
    const rect = levelRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom, left: rect.right });
    setEditing(true);
  };

  useEffect(() => {
    if (editing && popRef.current) {
      gsap.fromTo(popRef.current, { scale: 0.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.26, ease: "back.out(2)" });
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const close = (event: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(event.target as Node)) setEditing(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [editing]);

  return (
    <span className="chip skill-chip" style={{ position: "relative", cursor: "pointer" }} onClick={open} title="Clic para cambiar el nivel">
      {skill.name}
      <span ref={levelRef} className="level" style={{ background: skillColor(skill.level) }}>{skill.level}</span>
      <button onClick={(event) => { event.stopPropagation(); onRemove(); }} style={{ border: 0, background: "transparent", color: "var(--faint)", cursor: "pointer", display: "flex", padding: 0 }}>
        <X size={12} />
      </button>
      {editing && coords ? (
        <div style={{ position: "absolute",right:0,top:0, zIndex: 200, transform: "translate(25%,25%)", maxWidth:160 }} onClick={(event) => event.stopPropagation()}>
          <div ref={popRef} className="skill-level-pop">
            <div className="skill-level-pop__title">Nivel · {skill.name}</div>
            <div className="skill-level-pop__grid">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`skill-level-num ${value === skill.level ? "is-active" : ""}`}
                  onClick={() => { onLevel(value); setEditing(false); }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
