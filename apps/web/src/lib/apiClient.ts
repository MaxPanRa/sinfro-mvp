import { mockCredentials } from "../data/mockCredentials";
import { mockJobs } from "../data/mockJobs";
import { mockProfiles } from "../data/mockProfiles";
import { mockPlans, mockSubscription } from "../data/mockSubscriptions";
import type { CredentialPayload, CredentialProvider } from "../types/credential";
import type { Job } from "../types/job";
import type { Profile } from "../types/profile";
import type { SubscriptionPlan, UserSubscription } from "../types/subscription";
import type { SyncRun } from "../types/sync";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

export const apiClient = {
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

  async testCredential(providerId: string): Promise<{ ok: boolean; providerId: string; message: string }> {
    return request(`/credentials/${providerId}/test`, { method: "POST" }, { ok: true, providerId, message: "Credential test passed" });
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
    return request("/me/theme", undefined, { theme: "esmeralda", accent: "esmeralda", density: "comoda" });
  },

  async saveTheme(payload: { theme: string; accent: string; density: string }) {
    return request("/me/theme", { method: "PUT", body: JSON.stringify(payload) }, payload);
  },
};

function maskKey(value: string) {
  const suffix = value.slice(-4) || "demo";
  if (value.startsWith("sk-ant")) return `sk-ant-····${suffix}`;
  if (value.startsWith("sk-")) return `sk-····${suffix}`;
  if (value.startsWith("apify")) return `apify_····${suffix}`;
  return `····${suffix}`;
}
