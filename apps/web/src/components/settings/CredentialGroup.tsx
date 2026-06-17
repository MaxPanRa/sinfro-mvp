import { useState } from "react";
import type { CredentialPayload, CredentialProvider } from "../../types/credential";
import { StatusPill } from "../ui/Badge";
import { Button } from "../ui/Button";

interface CredentialGroupProps {
  title: string;
  providers: CredentialProvider[];
  onSave: (payload: CredentialPayload) => Promise<void>;
  onTest: (id: string) => Promise<void>;
}

export function CredentialGroup({ title, providers, onSave, onTest }: CredentialGroupProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

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
                {isEditing ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input className="field mono" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Pega tu API key..." />
                    <Button variant="primary" onClick={async () => { await onSave({ providerId: provider.id, apiKey }); setEditingId(null); setApiKey(""); }}>Guardar</Button>
                  </div>
                ) : null}
              </div>
              <Button onClick={() => onTest(provider.id)}>Probar</Button>
              <Button onClick={() => { setEditingId(isEditing ? null : provider.id); setApiKey(""); }}>{connected ? "Borrar" : "Conectar"}</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
