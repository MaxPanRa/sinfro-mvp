import { useState } from "react";
import type { CredentialPayload, CredentialProvider } from "../../types/credential";
import { StatusPill } from "../ui/Badge";
import { Button } from "../ui/Button";

interface CredentialGroupProps {
  title: string;
  providers: CredentialProvider[];
  onSave: (payload: CredentialPayload) => Promise<void>;
  onTest: (id: string, payload?: Partial<CredentialPayload>) => Promise<{ maskedKey?: string } | void>;
  onConnectGoogle?: () => Promise<void>;
}

export function CredentialGroup({ title, providers, onSave, onTest, onConnectGoogle }: CredentialGroupProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [phoneCode, setPhoneCode] = useState("521");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappTested, setWhatsappTested] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="section-kicker" style={{ marginBottom: 11 }}>{title}</div>
      <div className="settings-group">
        {providers.map((provider) => {
          const connected = provider.status === "connected";
          const isEditing = editingId === provider.id;
          return (
            <div className="provider-row" key={provider.id}>
              <div className="provider-glyph" style={{ color: provider.iconColor }}>{provider.glyph}</div>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{provider.name}</span>
                  <StatusPill
                    label={connected ? "Conectado" : provider.status === "testing" ? "Probando" : "Sin conectar"}
                    color={connected ? "var(--accent)" : provider.status === "testing" ? "#4EA7F5" : "var(--text2)"}
                    background={connected ? "var(--accentW2)" : "rgba(143,163,155,0.10)"}
                    animated={provider.status === "testing"}
                  />
                </div>
                <div className="mono faint" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 11.5 }}>
                  <span style={{ color: connected ? "var(--text2)" : "var(--faint)" }}>{provider.maskedKey}</span>
                  <span>·</span>
                  <span>{provider.lastTest}</span>
                </div>
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
                {isEditing && provider.id !== "gmail" && provider.id !== "whatsapp" ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="field mono" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Pega tu API key..." />
                    <Button variant="primary" onClick={async () => { await onSave({ providerId: provider.id, apiKey }); setEditingId(null); setApiKey(""); }}>Guardar</Button>
                  </div>
                ) : null}
              </div>
              {provider.id === "gmail" ? (
                <Button variant={connected ? "ghost" : "primary"} onClick={onConnectGoogle}>{connected ? "Reconectar" : "Conectar Google"}</Button>
              ) : (
                <>
                  {provider.id !== "whatsapp" ? <Button onClick={() => onTest(provider.id)}>Probar</Button> : null}
                  <Button onClick={() => {
                    setEditingId(isEditing ? null : provider.id);
                    setApiKey("");
                    setPhoneNumber("");
                    setWhatsappTested(false);
                    setWhatsappMessage("");
                  }}>{connected ? "Actualizar" : "Conectar"}</Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
