import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, HelpCircle, Lock, X } from "lucide-react";
import type { CredentialPayload, CredentialProvider } from "../../types/credential";
import type { AiAssignment, AiProviderConfig, AiTask } from "../../lib/apiClient";
import { providerIcon } from "../../lib/providerIcons";
import { modelLabel, modelOptionText } from "../../lib/modelInfo";
import { StatusPill } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface CredentialGroupProps {
  title: string;
  providers: CredentialProvider[];
  aiProviders?: AiProviderConfig[];
  onAiConfig?: (provider: string, assignments: AiAssignment[]) => Promise<void>;
  onSave: (payload: CredentialPayload) => Promise<void>;
  onTest: (id: string, payload?: Partial<CredentialPayload>) => Promise<{ maskedKey?: string } | void>;
  onConnectGoogle?: () => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const AI_TASK_OPTIONS: { value: AiTask; label: string }[] = [
  { value: "", label: "No usar" },
  { value: "cv_read", label: "Lectura de CV" },
  { value: "cv_vs_job", label: "Análisis CV vs vacante" },
];
const AI_TASKS: AiAssignment["task"][] = ["cv_read", "cv_vs_job"];

type CredentialHelpStep = {
  title: string;
  body: string;
  url?: string;
  urlLabel?: string;
  code?: string;
};

const CREDENTIAL_HELP: Record<string, { title: string; steps: CredentialHelpStep[] }> = {
  adzuna: {
    title: "Obtener credenciales de Adzuna",
    steps: [
      { title: "Abre Access Details", body: "Inicia sesión en Adzuna Developers y entra directo a la pantalla de credenciales.", url: "https://developer.adzuna.com/admin/access_details", urlLabel: "Abrir Adzuna Access Details" },
      { title: "Copia app_id", body: "En esa página copia el valor de app_id. Pégalo en el campo app_id de SinFro." },
      { title: "Copia app_key", body: "Copia también app_key. Pégalo en app_key, usa Probar y después Guardar." },
    ],
  },
  jooble: {
    title: "Solicitar API key de Jooble",
    steps: [
      { title: "Abre el formulario", body: "Jooble entrega la clave por solicitud. Abre la página oficial de Jooble REST API.", url: "https://es.jooble.org/api/about", urlLabel: "Abrir Jooble REST API" },
      { title: "Llena tus datos", body: "Completa nombre, puesto, correo, sitio web y teléfono. Si no tienes sitio definitivo, usa el dominio del proyecto o una URL profesional." },
      { title: "Revisa tu correo", body: "Jooble envía la clave de acceso por email. Cuando llegue, pégala en SinFro, prueba la conexión y guarda." },
    ],
  },
  serpapi: {
    title: "Obtener API key de SerpAPI",
    steps: [
      { title: "Abre el dashboard", body: "Inicia sesión en SerpAPI y entra al dashboard. Ahí aparece tu API key principal.", url: "https://serpapi.com/dashboard", urlLabel: "Abrir SerpAPI Dashboard" },
      { title: "Copia la API key", body: "Copia el valor de API Key sin espacios extras. SinFro la usará con el engine google_jobs." },
      { title: "Prueba y guarda", body: "Pega la key en SinFro, pulsa Probar para validar una búsqueda real y después Guardar." },
    ],
  },
  apify: {
    title: "Obtener token de Apify",
    steps: [
      { title: "Abre API & Integrations", body: "Entra a Settings > API & Integrations. La ruta directa abre la sección donde Apify muestra tus tokens.", url: "https://console.apify.com/settings/integrations", urlLabel: "Abrir Apify API & Integrations" },
      { title: "Copia un token personal", body: "En Personal API tokens, copia el token activo. No compartas ese valor fuera de SinFro." },
      { title: "Configura SinFro", body: "Pega el token directamente. Opcionalmente puedes usar JSON si quieres definir actores concretos.", code: "{\"token\":\"TU_TOKEN\",\"actors\":{\"indeed\":\"misceres/indeed-scraper\"},\"maxItems\":40}" },
    ],
  },
  whatsapp: {
    title: "Activar WhatsApp con CallMeBot",
    steps: [
      { title: "Guarda el contacto", body: "Agrega el bot +34 684 73 40 44 a tus contactos de teléfono. Puedes nombrarlo CallMeBot." },
      { title: "Envía el mensaje de activación", body: "Desde WhatsApp, envía exactamente este mensaje al contacto nuevo:", code: "I allow callmebot to send me messages" },
      { title: "Espera la API key", body: "El bot responderá algo como: API Activated for your phone number. Your APIKEY is XXXX. Si no llega en 2 minutos, intenta después de 24 horas." },
      { title: "Guarda en SinFro", body: "En SinFro elige tu lada, escribe tu teléfono sin espacios, pega la apikey, pulsa Probar y después Guardar." },
    ],
  },
};

export function CredentialGroup({ title, providers, aiProviders, onAiConfig, onSave, onTest, onConnectGoogle, onDelete }: CredentialGroupProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpProviderId, setHelpProviderId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [adzunaAppId, setAdzunaAppId] = useState("");
  const [adzunaAppKey, setAdzunaAppKey] = useState("");
  const [credentialMessage, setCredentialMessage] = useState("");
  const [credentialTested, setCredentialTested] = useState(false);
  const [phoneCode, setPhoneCode] = useState("521");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappTested, setWhatsappTested] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");

  const closeCredentialEditor = () => {
    setEditingId(null);
    setApiKey("");
    setAdzunaAppId("");
    setAdzunaAppKey("");
    setCredentialMessage("");
    setCredentialTested(false);
    setPhoneNumber("");
    setWhatsappTested(false);
    setWhatsappMessage("");
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="section-kicker" style={{ marginBottom: 11 }}>{title}</div>
      <div className="settings-group">
        {providers.map((provider) => {
          const connected = provider.status === "connected";
          const isEditing = editingId === provider.id;
          const aiConfig = aiProviders?.find((item) => item.provider === provider.id);
          const Icon = providerIcon(provider.id);
          return (
            <div className="provider-row" key={provider.id}>
              <div className="provider-glyph" style={{ color: provider.iconColor }}><Icon size={18} /></div>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{provider.name}</span>
                  {CREDENTIAL_HELP[provider.id] ? (
                    <button
                      className="credential-help-button"
                      type="button"
                      title={`Cómo obtener la credencial de ${provider.name}`}
                      aria-label={`Cómo obtener la credencial de ${provider.name}`}
                      onClick={() => setHelpProviderId(provider.id)}
                    >
                      <HelpCircle size={14} />
                    </button>
                  ) : null}
                  <StatusPill
                    label={connected ? "Conectado" : provider.status === "testing" ? "Probando" : provider.status === "error" ? "Error" : "Sin conectar"}
                    color={connected ? "var(--accent)" : provider.status === "testing" ? "#4EA7F5" : provider.status === "error" ? "var(--danger)" : "var(--text2)"}
                    background={connected ? "var(--accentW2)" : provider.status === "error" ? "rgba(229,72,77,0.10)" : "rgba(143,163,155,0.10)"}
                    animated={provider.status === "testing"}
                  />
                </div>
                <div className="mono faint" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 11.5 }}>
                  <span style={{ color: connected ? "var(--text2)" : "var(--faint)" }}>{provider.maskedKey}</span>
                  <span>·</span>
                  <span>{provider.lastTest}</span>
                </div>
                {aiConfig && onAiConfig && connected ? (
                  <AiTaskRows config={aiConfig} onChange={(assignments) => onAiConfig(provider.id, assignments)} />
                ) : null}
                {isEditing && provider.id === "whatsapp" ? (
                  <div className="whatsapp-connect">
                    <div className="whatsapp-grid">
                      <label>
                        Lada
                        <select className="field" value={phoneCode} onChange={(event) => { setPhoneCode(event.target.value); setWhatsappTested(false); }}>
                          <option value="521">Mexico +52</option>
                          <option value="1">USA/Canada +1</option>
                          <option value="34">Espana +34</option>
                          <option value="57">Colombia +57</option>
                          <option value="54">Argentina +54</option>
                          <option value="56">Chile +56</option>
                          <option value="51">Peru +51</option>
                        </select>
                      </label>
                      <label>
                        Telefono
                        <input className="field mono" inputMode="numeric" value={phoneNumber} onChange={(event) => { setPhoneNumber(onlyDigits(event.target.value)); setWhatsappTested(false); }} placeholder={phoneCode === "521" ? "10 digitos" : "numero"} />
                      </label>
                    </div>
                    <label>
                      API key
                      <input className="field mono" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setWhatsappTested(false); }} placeholder="CallMeBot apikey" />
                    </label>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      Para Mexico usa siempre 10 digitos. Primero prueba la conexion; despues podras guardar y los datos quedaran ocultos.
                    </div>
                    {whatsappMessage ? <div className={`notice ${whatsappTested ? "" : "is-error"}`}>{whatsappMessage}</div> : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <Button onClick={async () => {
                        const error = validateWhatsapp(phoneCode, phoneNumber, apiKey);
                        if (error) {
                          setWhatsappMessage(error);
                          setWhatsappTested(false);
                          return;
                        }
                        setWhatsappMessage("Probando conexion...");
                        try {
                          await onTest(provider.id, { providerId: provider.id, phoneCode, phoneNumber, apiKey });
                          setWhatsappTested(true);
                          setWhatsappMessage("Prueba enviada correctamente.");
                        } catch (error) {
                          setWhatsappTested(false);
                          setWhatsappMessage(error instanceof Error ? error.message : "No se pudo probar WhatsApp.");
                        }
                      }}>Probar</Button>
                      <Button variant="primary" disabled={!whatsappTested} onClick={async () => {
                        await onSave({ providerId: provider.id, phoneCode, phoneNumber, apiKey });
                        setEditingId(null);
                        setApiKey("");
                        setPhoneNumber("");
                        setWhatsappTested(false);
                        setWhatsappMessage("");
                      }}>Guardar</Button>
                    </div>
                  </div>
                ) : null}
                {isEditing && provider.id === "adzuna" ? (
                  <div className="credential-connect">
                    <div className="credential-grid">
                      <label>
                        app_id
                        <input className="field mono" value={adzunaAppId} onChange={(event) => { setAdzunaAppId(event.target.value); setCredentialTested(false); setCredentialMessage(""); }} placeholder="Adzuna app_id" />
                      </label>
                      <label>
                        app_key
                        <input className="field mono" value={adzunaAppKey} onChange={(event) => { setAdzunaAppKey(event.target.value); setCredentialTested(false); setCredentialMessage(""); }} placeholder="Adzuna app_key" />
                      </label>
                    </div>
                    {credentialMessage ? <div className={`notice ${credentialTested ? "" : "is-error"}`}>{credentialMessage}</div> : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <Button onClick={async () => {
                        if (!adzunaAppId.trim() || !adzunaAppKey.trim()) {
                          setCredentialTested(false);
                          setCredentialMessage("Adzuna requiere app_id y app_key.");
                          return;
                        }
                        setCredentialMessage("Probando Adzuna...");
                        try {
                          await onTest(provider.id, { providerId: provider.id, apiKey: `${adzunaAppId}:${adzunaAppKey}`, appId: adzunaAppId, appKey: adzunaAppKey });
                          setCredentialTested(true);
                          setCredentialMessage("Adzuna verificado correctamente.");
                        } catch (error) {
                          setCredentialTested(false);
                          setCredentialMessage(error instanceof Error ? error.message : "No se pudo probar Adzuna.");
                        }
                      }}>Probar</Button>
                      <Button variant="primary" disabled={!credentialTested} onClick={async () => {
                        await onSave({ providerId: provider.id, apiKey: `${adzunaAppId}:${adzunaAppKey}`, appId: adzunaAppId, appKey: adzunaAppKey });
                        closeCredentialEditor();
                      }}>Guardar</Button>
                    </div>
                  </div>
                ) : null}
                {isEditing && provider.id !== "gmail" && provider.id !== "whatsapp" && provider.id !== "adzuna" ? (
                  <div className="credential-connect">
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <input className="field mono" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setCredentialTested(false); setCredentialMessage(""); }} placeholder={credentialPlaceholder(provider.id)} />
                      <Button onClick={async () => {
                        if (!apiKey.trim()) {
                          setCredentialTested(false);
                          setCredentialMessage(`${provider.name} requiere credencial.`);
                          return;
                        }
                        setCredentialMessage(`Probando ${provider.name}...`);
                        try {
                          await onTest(provider.id, { providerId: provider.id, apiKey });
                          setCredentialTested(true);
                          setCredentialMessage(`${provider.name} verificado correctamente.`);
                        } catch (error) {
                          setCredentialTested(false);
                          setCredentialMessage(error instanceof Error ? error.message : `No se pudo probar ${provider.name}.`);
                        }
                      }}>Probar</Button>
                      <Button variant="primary" disabled={!credentialTested} onClick={async () => { await onSave({ providerId: provider.id, apiKey }); closeCredentialEditor(); }}>Guardar</Button>
                    </div>
                    {credentialMessage ? <div className={`notice ${credentialTested ? "" : "is-error"}`}>{credentialMessage}</div> : null}
                  </div>
                ) : null}
              </div>
              {provider.id === "gmail" ? (
                <>
                  <Button variant={connected ? "ghost" : "primary"} onClick={onConnectGoogle}>{connected ? "Reconectar" : "Conectar Google"}</Button>
                  {connected && onDelete ? (
                    <Button variant="danger" onClick={() => { if (window.confirm("¿Desconectar Gmail? Dejarás de recibir el correo de resumen de vacantes.")) void onDelete(provider.id).catch(() => undefined); }}>Desconectar</Button>
                  ) : null}
                </>
              ) : (
                <>
                  {provider.id !== "whatsapp" ? <Button onClick={() => { void onTest(provider.id).catch(() => undefined); }}>Probar</Button> : null}
                  <Button onClick={() => {
                    if (isEditing) {
                      closeCredentialEditor();
                      return;
                    }
                    closeCredentialEditor();
                    setEditingId(provider.id);
                  }}>{connected ? "Actualizar" : "Conectar"}</Button>
                  {connected && onDelete ? (
                    <Button variant="danger" onClick={() => { if (window.confirm(`¿Desconectar ${provider.name}?${provider.id === "whatsapp" ? " Dejarás de recibir notificaciones por WhatsApp." : ""}`)) void onDelete(provider.id).catch(() => undefined); }}>Desconectar</Button>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      <CredentialHelpModal providerId={helpProviderId} onClose={() => setHelpProviderId(null)} />
    </div>
  );
}

function CredentialHelpModal({ providerId, onClose }: { providerId: string | null; onClose: () => void }) {
  const help = providerId ? CREDENTIAL_HELP[providerId] : null;
  const [stepIndex, setStepIndex] = useState(0);
  if (!help) return null;
  const safeIndex = Math.min(stepIndex, help.steps.length - 1);
  const step = help.steps[safeIndex];
  const isLast = safeIndex === help.steps.length - 1;

  return (
    <Modal open={Boolean(help)} onClose={onClose}>
      <section className="modal-panel credential-help-modal">
        <div className="modal-header credential-help-header">
          <div>
            <div className="section-kicker">Ayuda de conexión</div>
            <h2>{help.title}</h2>
          </div>
          <button className="modal-close-button" type="button" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body credential-help-body">
          <div className="credential-help-progress">
            {help.steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === safeIndex ? "is-active" : ""}
                aria-label={`Paso ${index + 1}`}
                onClick={() => setStepIndex(index)}
              />
            ))}
          </div>
          <div className="credential-help-step">
            <div className="credential-help-step__count">Paso {safeIndex + 1} de {help.steps.length}</div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            {step.code ? <pre className="credential-help-code">{step.code}</pre> : null}
            {step.url ? (
              <a className="credential-help-link" href={step.url} target="_blank" rel="noreferrer">
                {step.urlLabel || "Abrir enlace"} <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
        <div className="modal-footer credential-help-footer">
          <Button disabled={safeIndex === 0} icon={<ChevronLeft size={15} />} onClick={() => setStepIndex(Math.max(0, safeIndex - 1))}>Anterior</Button>
          <Button
            variant={isLast ? "primary" : "ghost"}
            icon={isLast ? undefined : <ChevronRight size={15} />}
            onClick={() => {
              if (isLast) {
                setStepIndex(0);
                onClose();
                return;
              }
              setStepIndex(Math.min(help.steps.length - 1, safeIndex + 1));
            }}
          >
            {isLast ? "Terminar" : "Siguiente"}
          </Button>
        </div>
      </section>
    </Modal>
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function validateWhatsapp(phoneCode: string, phoneNumber: string, apiKey: string) {
  if (!apiKey.trim()) return "Agrega tu API key de CallMeBot.";
  if (!phoneNumber.trim()) return "Agrega tu telefono.";
  if ((phoneCode === "521" || phoneCode === "52") && phoneNumber.length !== 10) return "Mexico requiere exactamente 10 digitos.";
  if (phoneCode !== "521" && phoneCode !== "52" && (phoneNumber.length < 6 || phoneNumber.length > 15)) return "El telefono debe tener entre 6 y 15 digitos.";
  return "";
}

function credentialPlaceholder(providerId: string) {
  if (providerId === "jooble") return "API key de Jooble...";
  if (providerId === "serpapi") return "API key de SerpAPI...";
  if (providerId === "apify") return "Token de Apify o JSON con actores...";
  return "Pega tu API key...";
}

const taskLabel = (task: AiTask) => AI_TASK_OPTIONS.find((option) => option.value === task)?.label ?? task;

// Filas dinámicas (modelo + tarea) de un proveedor de IA. Un proveedor puede
// atender varias tareas con modelos distintos; cada tarea, una sola IA.
function AiTaskRows({ config, onChange }: { config: AiProviderConfig; onChange: (assignments: AiAssignment[]) => void }) {
  // Asignaciones puestas por el admin: solo se muestran, el usuario no las edita.
  const adminRows = config.assignments.filter((item) => item.adminManaged);
  const assigned = config.assignments.filter((item) => !item.adminManaged);
  // Tareas ocupadas: propias + las bloqueadas por el admin (no se pueden reusar).
  const usedTasks = new Set(config.assignments.map((item) => item.task));
  const lastModel = assigned.length ? assigned[assigned.length - 1].model : (config.defaultModel || config.models[0] || "");
  // Modelo de la fila nueva: por default el último usado; el usuario puede cambiarlo.
  const [newModel, setNewModel] = useState(lastModel);
  const remainingTasks = AI_TASKS.filter((task) => !usedTasks.has(task));

  // onChange envía solo las asignaciones PROPIAS; el backend conserva las del admin.
  const setRowTask = (index: number, task: AiTask) => {
    if (task === "") return onChange(assigned.filter((_, i) => i !== index));
    const next = assigned.map((item, i) => (i === index ? { ...item, task: task as AiAssignment["task"] } : item));
    onChange(next.filter((item, i, arr) => arr.findIndex((other) => other.task === item.task) === i));
  };
  const setRowModel = (index: number, model: string) => onChange(assigned.map((item, i) => (i === index ? { ...item, model } : item)));
  const addRow = (task: AiTask) => {
    if (task === "" || usedTasks.has(task)) return;
    onChange([...assigned, { task: task as AiAssignment["task"], model: newModel || lastModel }]);
  };

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      {adminRows.map((row) => (
        <div className="ai-config-row" key={`admin-${row.task}`} style={{ opacity: 0.92 }}>
          <label className="ai-config-field">
            <span className="faint">Modelo</span>
            <select className="field select" value={row.model} disabled>
              <option value={row.model}>{modelOptionText(row.model)}</option>
            </select>
          </label>
          <label className="ai-config-field">
            <span className="faint">Tarea</span>
            <select className="field select" value={row.task} disabled>
              {AI_TASK_OPTIONS.filter((option) => option.value === row.task).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      ))}
      {adminRows.length ? (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
          <Lock size={13} /> El administrador te asignó {adminRows.length === 1 ? "este modelo para esta tarea" : "estos modelos para estas tareas"}. No puedes cambiarlo.
        </div>
      ) : null}
      {assigned.map((row, index) => (
        <div className="ai-config-row" key={`${row.task}-${index}`}>
          <label className="ai-config-field">
            <span className="faint">Modelo</span>
            <ModelSelect models={config.models} value={row.model} onChange={(model) => setRowModel(index, model)} />
          </label>
          <label className="ai-config-field">
            <span className="faint">Tarea</span>
            <select className="field select" value={row.task} onChange={(event) => setRowTask(index, event.target.value as AiTask)}>
              {AI_TASK_OPTIONS
                .filter((option) => option.value === "" || option.value === row.task || !usedTasks.has(option.value))
                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      ))}
      {remainingTasks.length > 0 ? (
        <div className="ai-config-row">
          <label className="ai-config-field">
            <span className="faint">Modelo</span>
            <ModelSelect models={config.models} value={newModel} onChange={setNewModel} />
          </label>
          <label className="ai-config-field">
            <span className="faint">{assigned.length ? "Agregar otra tarea" : "Tarea"}</span>
            <select className="field select" value="" onChange={(event) => addRow(event.target.value as AiTask)}>
              <option value="">No usar</option>
              {remainingTasks.map((task) => <option key={task} value={task}>{taskLabel(task)}</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function ModelSelect({ models, value, onChange }: { models: string[]; value: string; onChange: (model: string) => void }) {
  const options = models.includes(value) ? models : [value, ...models];
  return (
    <>
      <select className="field select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((model) => <option key={model} value={model}>{modelOptionText(model)}</option>)}
      </select>
      {modelLabel(value) ? <span className="faint" style={{ fontSize: 10.5 }}>{modelLabel(value)}</span> : null}
    </>
  );
}
