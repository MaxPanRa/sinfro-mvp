import { Lock } from "lucide-react";
import type { CredentialPayload, CredentialProvider } from "../types/credential";
import { CredentialGroup } from "../components/settings/CredentialGroup";

interface SettingsViewProps {
  credentials: CredentialProvider[];
  onSaveCredential: (payload: CredentialPayload) => Promise<void>;
  onTestCredential: (id: string) => Promise<void>;
}

const groupOrder = ["Modelos de IA", "Busqueda & scraping", "Bolsas de empleo"];

export function SettingsView({ credentials, onSaveCredential, onTestCredential }: SettingsViewProps) {
  return (
    <div className="view">
      <div className="view-inner is-narrow">
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Conexiones · BYOK</h2>
        </div>
        <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 12.5 }}>
          <Lock size={14} color="var(--accent)" />
          Tus llaves se cifran localmente. Nunca mostramos la clave completa, solo una mascara y el estado del ultimo test.
        </div>
        {groupOrder.map((group) => (
          <CredentialGroup
            key={group}
            title={group}
            providers={credentials.filter((provider) => provider.group === group)}
            onSave={onSaveCredential}
            onTest={onTestCredential}
          />
        ))}
      </div>
    </div>
  );
}
