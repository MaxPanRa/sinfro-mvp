export type ProviderStatus = "connected" | "disconnected" | "testing" | "error";
export type ProviderGroup = "Correo" | "Modelos de IA" | "Busqueda & scraping" | "Bolsas de empleo";

export interface CredentialProvider {
  id: string;
  group: ProviderGroup;
  name: string;
  glyph: string;
  iconColor: string;
  status: ProviderStatus;
  maskedKey?: string;
  lastTest?: string;
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
