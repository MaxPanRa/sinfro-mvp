import { Lock } from "lucide-react";
import type { CredentialPayload, CredentialProvider } from "../types/credential";
import type { AiAssignment, AiProviderConfig } from "../lib/apiClient";
import { CredentialGroup } from "../components/settings/CredentialGroup";

interface SettingsViewProps {
  credentials: CredentialProvider[];
  aiProviders: AiProviderConfig[];
  onAiConfig: (provider: string, assignments: AiAssignment[]) => Promise<void>;
  onSaveCredential: (payload: CredentialPayload) => Promise<void>;
  onTestCredential: (id: string, payload?: Partial<CredentialPayload>) => Promise<{ maskedKey?: string } | void>;
  onConnectGoogle: () => Promise<void>;
  onDeleteCredential: (id: string) => Promise<void>;
}

const groupOrder = ["Correo", "Modelos de IA", "Busqueda & scraping", "Bolsas de empleo"];

export function SettingsView({ credentials, aiProviders, onAiConfig, onSaveCredential, onTestCredential, onConnectGoogle, onDeleteCredential }: SettingsViewProps) {
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
            aiProviders={group === "Modelos de IA" ? aiProviders : undefined}
            onAiConfig={onAiConfig}
            onSave={onSaveCredential}
            onTest={onTestCredential}
            onConnectGoogle={onConnectGoogle}
            onDelete={onDeleteCredential}
          />
        ))}
      </div>
    </div>
  );
}
