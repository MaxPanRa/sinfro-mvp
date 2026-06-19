import { useEffect, useMemo, useState } from "react";
import { mockCredentials } from "../data/mockCredentials";
import { mockJobs } from "../data/mockJobs";
import { mockProfiles } from "../data/mockProfiles";
import { mockSyncRuns } from "../data/mockSyncRuns";
import { apiClient, type UserSession } from "../lib/apiClient";
import { initialsOf } from "../lib/formatters";
import type { CredentialPayload, CredentialProvider, CredentialTestPayload } from "../types/credential";
import type { DetailTab, Job, JobFilter, JobSort } from "../types/job";
import type { Profile, ProfileDraft } from "../types/profile";
import type { SubscriptionPlan, UserSubscription } from "../types/subscription";
import type { SyncRun } from "../types/sync";
import type { AccentId, Density, ThemeId, ViewId } from "../types/theme";
import { AppShell } from "../components/layout/AppShell";
import { DashboardView } from "../views/DashboardView";
import { ProfilesView } from "../views/ProfilesView";
import { SettingsView } from "../views/SettingsView";
import { SubscriptionView } from "../views/SubscriptionView";
import { SyncRunsView } from "../views/SyncRunsView";
import { AuthView } from "../views/AuthView";
import { OnboardingView } from "../views/OnboardingView";
import "../styles/app.css";

const storedTheme = () => (localStorage.getItem("sinfron.theme") as ThemeId | null) ?? "esmeralda";
const storedAccent = () => (localStorage.getItem("sinfron.accent") as AccentId | null) ?? "#10A37F";

const emptyProfile: Profile = {
  id: 0,
  initials: "SF",
  name: "Nuevo perfil",
  role: "Sin perfil activo",
  email: "",
  english: "Sin definir",
  location: "",
  modality: "Remoto",
  salary: "",
  cvStatus: "Sin CV cargado",
  description: "Crea tu primer perfil para comparar vacantes con tu CV.",
  keywords: [],
  skills: [],
};

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [view, setView] = useState<ViewId>("inbox");
  const [density, setDensity] = useState<Density>("comoda");
  const [theme, setThemeState] = useState<ThemeId>(storedTheme);
  const [accent, setAccentState] = useState<AccentId>(storedAccent);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [profiles, setProfiles] = useState<Profile[]>(mockProfiles);
  const [credentials, setCredentials] = useState<CredentialProvider[]>(mockCredentials);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>(mockSyncRuns);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<JobFilter>("todas");
  const [sort, setSort] = useState<JobSort>("score");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("analisis");
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(1);
  const [keywordsExpanded, setKeywordsExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? emptyProfile;
  const selectedJob = selectedId ? jobs.find((job) => job.id === selectedId) ?? null : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("verifyEmail");
    if (verificationToken) {
      setVerifyingEmail(true);
      apiClient.confirmEmail(verificationToken)
        .then((session) => {
          apiClient.setToken(session.accessToken);
          setUser(session.user);
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => setVerifyError("No se pudo confirmar el correo. Pide una nueva liga."))
        .finally(() => {
          setVerifyingEmail(false);
          setAuthReady(true);
        });
      return;
    }

    if (!apiClient.getToken()) {
      setAuthReady(true);
      return;
    }

    apiClient.getMe()
      .then(setUser)
      .catch(() => {
        apiClient.clearToken();
        setUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    apiClient.getJobs().then(setJobs).catch(() => undefined);
    apiClient.getProfiles().then((items) => {
      if (items.length) {
        setProfiles(items);
        setActiveProfileId(items[0].id);
      }
    }).catch(() => undefined);
    apiClient.getCredentials().then(setCredentials).catch(() => undefined);
    apiClient.getSyncRuns().then((items) => {
      if (items.length) setSyncRuns(items);
    }).catch(() => undefined);
    apiClient.getSubscriptionPlans().then(setPlans).catch(() => undefined);
    apiClient.getCurrentSubscription().then(setSubscription).catch(() => undefined);
    apiClient.getTheme().then((remoteTheme) => {
      setThemeState(remoteTheme.theme as ThemeId);
      setAccentState(remoteTheme.accent as AccentId);
      setDensity(remoteTheme.density as Density);
      localStorage.setItem("sinfron.theme", remoteTheme.theme);
      localStorage.setItem("sinfron.accent", remoteTheme.accent);
    }).catch(() => undefined);
  }, [user]);

  const counts = useMemo(() => ({
    total: jobs.length,
    nuevas: jobs.filter((job) => job.status === "nueva").length,
    alto: jobs.filter((job) => job.score >= 85).length,
    aplicadas: jobs.filter((job) => job.status === "aplicada").length,
    descartadas: jobs.filter((job) => job.status === "descartada").length,
    connected: credentials.filter((credential) => credential.status === "connected").length,
  }), [credentials, jobs]);

  const visibleJobs = useMemo(() => {
    let next = [...jobs];
    const query = search.trim().toLowerCase();
    if (query) {
      next = next.filter((job) => `${job.title} ${job.company} ${job.location} ${job.skills.join(" ")}`.toLowerCase().includes(query));
    }
    if (filter === "nuevas") next = next.filter((job) => job.status === "nueva");
    if (filter === "alto") next = next.filter((job) => job.score >= 85);
    if (filter === "aplicadas") next = next.filter((job) => job.status === "aplicada");
    if (filter === "descartadas") next = next.filter((job) => job.status === "descartada");
    if (sort === "score") next.sort((a, b) => b.score - a.score);
    return next;
  }, [filter, jobs, search, sort]);

  const subtitle = {
    inbox: `${counts.total} vacantes · ${counts.nuevas} nuevas`,
    perfiles: `${profiles.length} perfiles · 1 activo`,
    settings: `${credentials.length} proveedores`,
    jobs: "1018 totales hoy",
    subscription: subscription ? subscription.plan.name : "planes BYOK",
  }[view];

  const setTheme = (next: ThemeId) => {
    localStorage.setItem("sinfron.theme", next);
    setThemeState(next);
    void apiClient.saveTheme({ theme: next, accent, density });
  };

  const setAccent = (next: AccentId) => {
    localStorage.setItem("sinfron.accent", next);
    setAccentState(next);
    void apiClient.saveTheme({ theme, accent: next, density });
  };

  const updateDensity = (next: Density) => {
    setDensity(next);
    void apiClient.saveTheme({ theme, accent, density: next });
  };

  const selectJob = (id: number) => {
    setSelectedId(id);
    setDetailTab("analisis");
    setJobs((current) => current.map((job) => (job.id === id && job.status === "nueva" ? { ...job, status: "vista" } : job)));
  };

  const applySelected = () => {
    if (!selectedId) return;
    setJobs((current) => current.map((job) => (job.id === selectedId ? { ...job, status: "aplicada" } : job)));
  };

  const dismissSelected = () => {
    if (!selectedId) return;
    setJobs((current) => current.map((job) => (job.id === selectedId ? { ...job, status: "descartada" } : job)));
    window.setTimeout(() => setSelectedId(null), 220);
  };

  const analyzeSelected = () => {
    if (!selectedId || analyzing) return;
    setAnalyzing(true);
    window.setTimeout(() => {
      setJobs((current) => current.map((job) => (job.id === selectedId ? { ...job, scoreType: "IA", score: Math.min(99, job.score + (job.scoreType === "prelim" ? 4 : 0)) } : job)));
      setAnalyzing(false);
    }, 1500);
  };

  const runSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const run = await apiClient.runSync();
    setSyncRuns((current) => [run, ...current]);
    window.setTimeout(() => {
      setSyncing(false);
      setSyncRuns((current) => current.map((item) => (item.id === run.id ? { ...item, status: "success", found: 11, duration: "00:19" } : item)));
    }, 2600);
  };

  const openNewProfile = () => {
    setDraft({
      id: Date.now(),
      initials: "",
      name: "",
      role: "",
      email: "",
      english: "B1 · Intermedio",
      location: "",
      modality: "Remoto",
      salary: "",
      cvStatus: "Sin CV cargado",
      description: "",
      keywords: [],
      skills: [],
      active: false,
    });
    setEditorOpen(true);
  };

  const openEditProfile = () => {
    setDraft({ ...activeProfile, skills: activeProfile.skills.map((skill) => ({ ...skill })), keywords: [...activeProfile.keywords], active: true });
    setEditorOpen(true);
  };

  const saveProfile = (next: ProfileDraft) => {
    const profile: Profile = {
      ...next,
      initials: next.initials || initialsOf(next.name || "Perfil"),
      name: next.name.trim() || "Nuevo perfil",
    };
    const exists = profiles.some((item) => item.id === profile.id);
    setProfiles((current) => (exists ? current.map((item) => (item.id === profile.id ? profile : item)) : [...current, profile]));
    if (next.active || !exists) setActiveProfileId(profile.id);
    setEditorOpen(false);
  };

  const saveCredential = async (payload: CredentialPayload) => {
    const saved = await apiClient.saveCredential(payload);
    setCredentials((current) => current.map((credential) => (credential.id === payload.providerId ? saved : credential)));
  };

  const testCredential = async (id: string, payload?: CredentialTestPayload) => {
    setCredentials((current) => current.map((credential) => (credential.id === id ? { ...credential, status: "testing" } : credential)));
    const result = await apiClient.testCredential(id, payload);
    setCredentials((current) => current.map((credential) => (credential.id === id ? { ...credential, status: credential.maskedKey?.startsWith("sin ") ? "disconnected" : "connected", lastTest: result.message || "test ahora" } : credential)));
    return result;
  };

  const login = async (payload: { email: string; password: string }) => {
    const session = await apiClient.login(payload);
    apiClient.setToken(session.accessToken);
    setUser(session.user);
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    return apiClient.register(payload);
  };

  const completeOnboarding = async (payload: { theme: ThemeId; accent: string; density: Density }) => {
    await apiClient.completeOnboarding(payload);
    localStorage.setItem("sinfron.theme", payload.theme);
    localStorage.setItem("sinfron.accent", payload.accent);
    setThemeState(payload.theme);
    setAccentState(payload.accent);
    setDensity(payload.density);
    setUser((current) => current ? { ...current, onboarding_completed: true } : current);
  };

  const connectGoogle = async () => {
    const result = await apiClient.getGoogleAuthUrl();
    window.location.assign(result.authUrl);
  };

  if (!authReady || verifyingEmail) {
    return <AuthView verifying={verifyingEmail} verifyError={verifyError} onLogin={login} onRegister={register} />;
  }

  if (!user) {
    return <AuthView verifying={false} verifyError={verifyError} onLogin={login} onRegister={register} />;
  }

  if (!user.onboarding_completed) {
    return <OnboardingView initialTheme={theme} initialAccent={accent} initialDensity={density} onComplete={completeOnboarding} />;
  }

  return (
    <AppShell
      view={view}
      subtitle={subtitle}
      density={density}
      theme={theme}
      accent={accent}
      navOpen={navOpen}
      syncing={syncing}
      themeMenuOpen={themeMenuOpen}
      counts={{ nuevas: counts.nuevas, connected: counts.connected }}
      activeProfile={activeProfile}
      hasRunning={syncRuns.some((run) => run.status === "running") || syncing}
      onNavigate={setView}
      onCloseNav={() => setNavOpen(false)}
      onToggleNav={() => setNavOpen((open) => !open)}
      onDensity={updateDensity}
      onRunSync={runSync}
      onToggleThemeMenu={() => setThemeMenuOpen((open) => !open)}
      onTheme={setTheme}
      onAccent={setAccent}
    >
      {view === "inbox" ? (
        <DashboardView
          jobs={visibleJobs}
          activeProfile={activeProfile}
          search={search}
          filter={filter}
          sort={sort}
          selectedJob={selectedJob}
          detailTab={detailTab}
          analyzing={analyzing}
          keywordsExpanded={keywordsExpanded}
          counts={counts}
          onSearch={setSearch}
          onFilter={setFilter}
          onSort={setSort}
          onSelectJob={selectJob}
          onCloseDetail={() => setSelectedId(null)}
          onTab={setDetailTab}
          onApply={applySelected}
          onDismiss={dismissSelected}
          onAnalyze={analyzeSelected}
          onClearFilters={() => { setSearch(""); setFilter("todas"); }}
          onToggleKeywords={() => setKeywordsExpanded((open) => !open)}
        />
      ) : null}

      {view === "perfiles" ? (
        <ProfilesView
          profiles={profiles}
          activeId={activeProfileId}
          activeProfile={activeProfile}
          draft={draft}
          editorOpen={editorOpen}
          onSelect={setActiveProfileId}
          onNew={openNewProfile}
          onEdit={openEditProfile}
          onCloseEditor={() => setEditorOpen(false)}
          onSave={saveProfile}
        />
      ) : null}

      {view === "settings" ? <SettingsView credentials={credentials} onSaveCredential={saveCredential} onTestCredential={testCredential} onConnectGoogle={connectGoogle} /> : null}
      {view === "jobs" ? <SyncRunsView runs={syncRuns} nuevas={counts.nuevas} /> : null}
      {view === "subscription" ? <SubscriptionView plans={plans} subscription={subscription} /> : null}
    </AppShell>
  );
}
