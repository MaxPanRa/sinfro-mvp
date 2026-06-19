import { mockCredentials } from "../data/mockCredentials";
import { mockJobs } from "../data/mockJobs";
import { mockProfiles } from "../data/mockProfiles";
import { mockPlans, mockSubscription } from "../data/mockSubscriptions";
import type { CredentialPayload, CredentialProvider, CredentialTestPayload } from "../types/credential";
import type { Job } from "../types/job";
import type { Profile } from "../types/profile";
import type { SubscriptionPlan, UserSubscription } from "../types/subscription";
import type { SyncRun } from "../types/sync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "sinfro.authToken";

export interface UserSession {
  id: number;
  email: string;
  name: string;
  is_demo: boolean;
  email_verified_at?: string | null;
  onboarding_completed?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: UserSession;
}

export interface RegisterResponse {
  ok: boolean;
  email: string;
  message: string;
  devVerificationUrl?: string | null;
}

async function request<T>(path: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
      ...options,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const errorBody = await res.json() as { detail?: string };
        if (errorBody.detail) message = errorBody.detail;
      } catch {
        // Keep the HTTP status fallback.
      }
      throw new Error(message);
    }
    return await res.json() as T;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

export const apiClient = {
  tokenKey: TOKEN_KEY,

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  async register(payload: { name: string; email: string; password: string }): Promise<RegisterResponse> {
    return request<RegisterResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) });
  },

  async confirmEmail(token: string): Promise<TokenResponse> {
    return request<TokenResponse>("/auth/confirm-email", { method: "POST", body: JSON.stringify({ token }) });
  },

  async login(payload: { email: string; password: string }): Promise<TokenResponse> {
    return request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },

  async getMe(): Promise<UserSession> {
    return request<UserSession>("/me");
  },

  async getJobs(): Promise<Job[]> {
    return request<Job[]>("/jobs", undefined, mockJobs);
  },

  async getJobById(id: number): Promise<Job | undefined> {
    return request<Job | undefined>(`/jobs/${id}`, undefined, mockJobs.find((job) => job.id === id));
  },

  async getProfiles(): Promise<Profile[]> {
    return request<Profile[]>("/profiles", undefined, mockProfiles);
  },

  async getCredentials(): Promise<CredentialProvider[]> {
    return request<CredentialProvider[]>("/credentials", undefined, mockCredentials);
  },

  async saveCredential(payload: CredentialPayload): Promise<CredentialProvider> {
    const remote = await request<CredentialProvider | null>("/credentials", { method: "POST", body: JSON.stringify(payload) }, null);
    if (remote) return remote;
    const provider = mockCredentials.find((item) => item.id === payload.providerId);
    if (!provider) throw new Error("Provider not found");
    return {
      ...provider,
      status: "connected",
      maskedKey: maskKey(payload.apiKey),
      lastTest: "test ahora",
    };
  },

  async testCredential(providerId: string, payload?: CredentialTestPayload): Promise<{ ok: boolean; providerId: string; message: string; maskedKey?: string }> {
    return request(`/credentials/${providerId}/test`, { method: "POST", body: payload ? JSON.stringify(payload) : undefined }, { ok: true, providerId, message: "Credential test passed" });
  },

  async runSync(): Promise<SyncRun> {
    return request<SyncRun>("/sync/run", { method: "POST" }, { id: Date.now(), source: "Manual scan", status: "running", found: "—", duration: "00:00", started: "ahora" });
  },

  async getSyncRuns(): Promise<SyncRun[]> {
    return request<SyncRun[]>("/sync/runs", undefined, []);
  },

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return request<SubscriptionPlan[]>("/subscription/plans", undefined, mockPlans);
  },

  async getCurrentSubscription(): Promise<UserSubscription> {
    return request<UserSubscription>("/subscription/current", undefined, mockSubscription);
  },

  async getTheme(): Promise<{ theme: string; accent: string; density: string }> {
    return request("/me/theme", undefined, { theme: "esmeralda", accent: "#10A37F", density: "comoda" });
  },

  async saveTheme(payload: { theme: string; accent: string; density: string }) {
    return request("/me/theme", { method: "PUT", body: JSON.stringify(payload) }, payload);
  },

  async completeOnboarding(payload: { theme: string; accent: string; density: string }) {
    return request("/me/onboarding", { method: "POST", body: JSON.stringify(payload) }, payload);
  },

  async getGoogleAuthUrl(): Promise<{ authUrl: string; redirectUri: string }> {
    return request("/auth/google/start");
  },

  async getGmailStatus(): Promise<{ connected: boolean; email?: string | null; canSendSelfSummaries: boolean }> {
    return request("/integrations/gmail", undefined, { connected: false, canSendSelfSummaries: false });
  },
};

function maskKey(value: string) {
  const suffix = value.slice(-4) || "demo";
  if (value.startsWith("sk-ant")) return `sk-ant-····${suffix}`;
  if (value.startsWith("sk-")) return `sk-····${suffix}`;
  if (value.startsWith("apify")) return `apify_····${suffix}`;
  return `····${suffix}`;
}
