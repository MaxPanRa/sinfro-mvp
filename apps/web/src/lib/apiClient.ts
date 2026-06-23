import { mockCredentials } from "../data/mockCredentials";
import { mockJobs } from "../data/mockJobs";
import { mockProfiles } from "../data/mockProfiles";
import { mockPlans, mockSubscription } from "../data/mockSubscriptions";
import type { CredentialPayload, CredentialProvider, CredentialTestPayload } from "../types/credential";
import type { Job } from "../types/job";
import type { CvDocument, Profile, ProfilePayload, ProfileSkill } from "../types/profile";
import type { SubscriptionPlan, UserSubscription } from "../types/subscription";
import type { SyncRun } from "../types/sync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "sinfro.authToken";

export interface UserSession {
  id: number;
  email: string;
  name: string;
  is_demo: boolean;
  is_active?: boolean;
  isAdmin?: boolean;
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

export interface CvAnalysis {
  skills: ProfileSkill[];
  keywords: string[];
  summary: string;
  charCount: number;
  engine?: string; // "local" o el id del proveedor de IA usado
  // Campos extra cuando el análisis lo hace una IA (engine != "local"):
  name?: string;
  role?: string;
  email?: string;
  location?: string;
  english?: string; // token MCER: A1..C2
  salary?: string;
  seniority?: string;
}

export interface CvUploadResult {
  document: CvDocument;
  analysis: CvAnalysis;
  profile: Profile;
}

export type AiTask = "" | "cv_read" | "cv_vs_job";

export interface AiAssignment {
  task: "cv_read" | "cv_vs_job";
  model: string;
  adminManaged?: boolean;
}

export interface AiProviderConfig {
  provider: string;
  name: string;
  connected: boolean;
  models: string[];
  defaultModel: string;
  assignments: AiAssignment[];
}

export interface JobEvaluation {
  jobId: number;
  score: number;
  reasons?: string[];
  gaps?: string[];
  engine?: string;
  mode?: string;        // "quick" | "deep"
  markdown?: string;    // evaluación enriquecida
  hasEvaluation?: boolean;
  needsSource?: boolean; // sin descripción: hay que visitar el sitio
  url?: string | null;
}

export interface JobTranslation {
  jobId: number;
  language: string;
  translatedDescription: string;
  engine: string;
}

export interface AdminAiAssignment {
  task: "cv_read" | "cv_vs_job";
  provider: string;
  model: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  planCode: string;
  planName: string;
  visibleProfiles: number;
  disabledProfiles: number;
  totalProfiles: number;
  createdAt?: string | null;
  aiAssignments: AdminAiAssignment[];
  apiGrants: string[];
}

export interface ApiUsageInfo {
  provider: string;
  used: number;
  quotaLimit?: number | null;
  period: string;
  daysLeft?: number | null;
  label: string;
}

export interface AdminLendable {
  provider: string;
  name: string;
  connected: boolean;
  usage?: ApiUsageInfo | null;
}

export interface AdminCode {
  code: string;
  planCode: string;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
}

export interface AdminAssignResult {
  assigned: number;
  emailed: number;
  skipped: string[];
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

  async getJobs(profileId?: number): Promise<Job[]> {
    const query = profileId ? `?profile_id=${profileId}` : "";
    return request<Job[]>(`/jobs${query}`, undefined, mockJobs);
  },

  async getJobById(id: number): Promise<Job | undefined> {
    return request<Job | undefined>(`/jobs/${id}`, undefined, mockJobs.find((job) => job.id === id));
  },

  async updateJobStatus(id: number, status: string, reason?: string): Promise<Job | undefined> {
    return request<Job | undefined>(`/jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }, undefined);
  },

  async getProfiles(): Promise<Profile[]> {
    return request<Profile[]>("/profiles", undefined, mockProfiles);
  },

  async createProfile(payload: ProfilePayload): Promise<Profile> {
    return request<Profile>("/profiles", { method: "POST", body: JSON.stringify(payload) });
  },

  async updateProfile(id: number, payload: ProfilePayload): Promise<Profile> {
    return request<Profile>(`/profiles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },

  async deleteProfile(id: number): Promise<{ ok: boolean; id: number; deletedJobs: number }> {
    return request(`/profiles/${id}`, { method: "DELETE" });
  },

  async analyzeCv(file: File): Promise<CvAnalysis> {
    const token = localStorage.getItem(TOKEN_KEY);
    const form = new FormData();
    form.append("file", file);
    // No fijamos Content-Type: el navegador agrega el boundary de multipart.
    const res = await fetch(`${API_URL}/cv/analyze`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { detail?: string };
        if (body.detail) message = body.detail;
      } catch {
        // Conserva el status como fallback.
      }
      throw new Error(message);
    }
    return await res.json() as CvAnalysis;
  },

  async uploadProfileCv(profileId: number, file: File): Promise<CvUploadResult> {
    const token = localStorage.getItem(TOKEN_KEY);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/profiles/${profileId}/cv`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { detail?: string };
        if (body.detail) message = body.detail;
      } catch {
        // Conserva el status como fallback.
      }
      throw new Error(message);
    }
    return await res.json() as CvUploadResult;
  },

  async downloadProfileCv(profileId: number, filename: string): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_URL}/profiles/${profileId}/cv/download`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { detail?: string };
        if (body.detail) message = body.detail;
      } catch {
        // Conserva el status como fallback.
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "cv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async deleteProfileCv(profileId: number): Promise<{ ok: boolean; profile: Profile }> {
    return request(`/profiles/${profileId}/cv`, { method: "DELETE" });
  },

  async getCredentials(): Promise<CredentialProvider[]> {
    return request<CredentialProvider[]>("/credentials", undefined, mockCredentials);
  },

  async getAiProviders(): Promise<AiProviderConfig[]> {
    return request<AiProviderConfig[]>("/ai/providers", undefined, []);
  },

  async updateAiConfig(payload: { provider: string; assignments: AiAssignment[] }): Promise<AiProviderConfig[]> {
    return request<AiProviderConfig[]>("/ai/config", { method: "PUT", body: JSON.stringify(payload) });
  },

  async evaluateJob(jobId: number, mode: "quick" | "deep" = "deep"): Promise<JobEvaluation> {
    return request<JobEvaluation>(`/jobs/${jobId}/evaluate?mode=${mode}`, { method: "POST" });
  },

  async getJobEvaluation(jobId: number): Promise<JobEvaluation> {
    return request<JobEvaluation>(`/jobs/${jobId}/evaluation`, undefined, { jobId, score: 0, hasEvaluation: false });
  },

  async generateCoverLetter(jobId: number, language: "es" | "en"): Promise<{ jobId: number; language: string; text: string; engine: string }> {
    return request(`/jobs/${jobId}/cover-letter`, { method: "POST", body: JSON.stringify({ language }) });
  },

  async translateJobDescription(jobId: number, language: string): Promise<JobTranslation> {
    return request<JobTranslation>(`/jobs/${jobId}/translate`, { method: "POST", body: JSON.stringify({ language }) });
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

  async deleteCredential(providerId: string): Promise<{ id: string; status: string }> {
    return request(`/credentials/${providerId}`, { method: "DELETE" }, { id: providerId, status: "disconnected" });
  },

  async testCredential(providerId: string, payload?: CredentialTestPayload): Promise<{ ok: boolean; providerId: string; message: string; maskedKey?: string }> {
    // Sin fallback: si el backend rechaza la prueba (key inválida, etc.) debe
    // propagarse el error para que la UI muestre el fallo real.
    return request(`/credentials/${providerId}/test`, { method: "POST", body: payload ? JSON.stringify(payload) : undefined });
  },

  async runSync(profileId?: number): Promise<SyncRun> {
    const query = profileId ? `?profile_id=${profileId}` : "";
    return request<SyncRun>(`/sync/run${query}`, { method: "POST" }, { id: Date.now(), source: "Manual scan", status: "running", found: "—", duration: "00:00", started: "ahora", createdAt: new Date().toISOString() });
  },

  async getSyncRuns(): Promise<SyncRun[]> {
    return request<SyncRun[]>("/sync/runs", undefined, []);
  },

  async recalculateJobs(profileId?: number): Promise<{ recalculated: number; scanned: number }> {
    const query = profileId ? `?profile_id=${profileId}` : "";
    return request<{ recalculated: number; scanned: number }>(`/jobs/recalculate${query}`, { method: "POST" }, { recalculated: 0, scanned: 0 });
  },

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return request<SubscriptionPlan[]>("/subscription/plans", undefined, mockPlans);
  },

  async getCurrentSubscription(): Promise<UserSubscription> {
    return request<UserSubscription>("/subscription/current", undefined, mockSubscription);
  },

  async redeemSubscriptionCode(code: string): Promise<UserSubscription> {
    return request<UserSubscription>("/subscription/redeem-code", { method: "POST", body: JSON.stringify({ code }) });
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/users");
  },

  async updateAdminUserPlan(userId: number, planCode: string): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}/plan`, { method: "PATCH", body: JSON.stringify({ planCode }) });
  },

  async updateAdminUserStatus(userId: number, isActive: boolean): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) });
  },

  async getAssignableAi(): Promise<AiProviderConfig[]> {
    return request<AiProviderConfig[]>("/admin/ai/assignable", undefined, []);
  },

  async assignAdminAi(payload: { userIds: number[]; provider: string; model: string; tasks: string[] }): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/ai/assign", { method: "POST", body: JSON.stringify(payload) });
  },

  async unassignAdminAi(payload: { userIds: number[]; tasks: string[] }): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/ai/unassign", { method: "POST", body: JSON.stringify(payload) });
  },

  async getLendableApis(): Promise<AdminLendable[]> {
    return request<AdminLendable[]>("/admin/api/lendable", undefined, []);
  },

  async lendApi(payload: { userIds: number[]; provider: string }): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/api/lend", { method: "POST", body: JSON.stringify(payload) });
  },

  async unlendApi(payload: { userIds: number[]; provider: string }): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/api/unlend", { method: "POST", body: JSON.stringify(payload) });
  },

  async updateApiUsage(payload: { provider: string; used?: number; quotaLimit?: number | null; period?: string; renewDays?: number; resetRenewal?: boolean }): Promise<AdminLendable> {
    return request<AdminLendable>("/admin/api/usage", { method: "PATCH", body: JSON.stringify(payload) });
  },

  async getMyApiUsage(): Promise<ApiUsageInfo[]> {
    return request<ApiUsageInfo[]>("/me/api-usage", undefined, []);
  },

  async getAdminCodes(): Promise<AdminCode[]> {
    return request<AdminCode[]>("/admin/codes");
  },

  async assignAdminCode(code: string, userIds: number[], sendEmail: boolean): Promise<AdminAssignResult> {
    return request<AdminAssignResult>(`/admin/codes/${encodeURIComponent(code)}/assign`, { method: "POST", body: JSON.stringify({ userIds, sendEmail }) });
  },

  async updateAdminCode(code: string, patch: { maxRedemptions?: number; active?: boolean }): Promise<AdminCode> {
    return request<AdminCode>(`/admin/codes/${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify(patch) });
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
