export type ProviderStatus = "connected" | "disconnected" | "testing" | "error";
export type ProviderGroup = "Correo" | "Modelos de IA" | "Busqueda & scraping" | "Bolsas de empleo";

export interface ApiUsage {
  provider: string;
  used: number;
  quotaLimit?: number | null;
  period: string; // month | rolling7 | none
  daysLeft?: number | null;
  label: string;
}

export interface CredentialProvider {
  id: string;
  group: ProviderGroup;
  name: string;
  glyph: string;
  iconColor: string;
  status: ProviderStatus;
  maskedKey?: string;
  lastTest?: string;
  adminManaged?: boolean;
  usage?: ApiUsage | null;
}

export interface CredentialPayload {
  providerId: string;
  apiKey: string;
  appId?: string;
  appKey?: string;
  phoneCode?: string;
  phoneNumber?: string;
}

export interface CredentialTestPayload {
  apiKey?: string;
  appId?: string;
  appKey?: string;
  phoneCode?: string;
  phoneNumber?: string;
}
