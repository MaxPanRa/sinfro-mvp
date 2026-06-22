import { useEffect, useMemo, useState } from "react";
import { mockCredentials } from "../data/mockCredentials";
import { mockJobs } from "../data/mockJobs";
import { mockProfiles } from "../data/mockProfiles";
import { apiClient, type UserSession, type AiProviderConfig, type AiAssignment } from "../lib/apiClient";
import { initialsOf, buildSemanticAnalysis, displayJobScore } from "../lib/formatters";
import type { CredentialPayload, CredentialProvider, CredentialTestPayload } from "../types/credential";
import type { AnalysisMode, DetailTab, Job, JobFilter, JobSort } from "../types/job";
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
import { OnboardingTutorial } from "../components/onboarding/OnboardingTutorial";
import { AdminUsersView } from "../views/AdminUsersView";
import { AdminCodesView } from "../views/AdminCodesView";
import "../styles/app.css";

const storedTheme = () => (localStorage.getItem("sinfron.theme") as ThemeId | null) ?? "esmeralda";
const storedAccent = () => (localStorage.getItem("sinfron.accent") as AccentId | null) ?? "#10A37F";
// Marca (por usuario) de que ya vio el tutorial de bienvenida.
const tutorialSeenKey = (userId: number) => `sinfron.tutorialSeen.${userId}`;

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
  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<JobFilter>("todas");
  const [sort, setSort] = useState<JobSort>("fecha");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("analisis");
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(1);
  const [keywordsExpanded, setKeywordsExpanded] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  // Análisis ya hecho por vacante: "quick" | "deep". Deshabilita su(s) botón(es)
  // hasta que el usuario edite el perfil o cambie de perfil.
  const [analysisByJob, setAnalysisByJob] = useState<Record<number, "quick" | "deep">>({});
  // Evaluación enriquecida (Markdown) por vacante, para renderizar las cards de IA.
  const [evaluationByJob, setEvaluationByJob] = useState<Record<number, { mode: string; markdown: string }>>({});
  // Tutorial de bienvenida: aparece solo la primera vez (mientras no haya perfiles)
  // y se puede reabrir desde el botón "Ayuda". Una vez visto, no vuelve solo.
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(false);

  const hasProfiles = profiles.length > 0;
  const showTutorial = Boolean(user) && tutorialOpen;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? emptyProfile;
  const selectedJob = selectedId ? jobs.find((job) => job.id === selectedId) ?? null : null;
  // Solo decimos "con IA" si hay un proveedor asignado al analisis CV vs vacante.
  const usesAi = aiProviders.some((provider) => provider.connected && provider.assignments.some((item) => item.task === "cv_vs_job"));

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
    // El tutorial solo se muestra automáticamente si este usuario aún no lo vio.
    setProfilesLoaded(false);
    setTutorialStep(0);
    setTutorialOpen(false);
    setTutorialSeen(localStorage.getItem(tutorialSeenKey(user.id)) === "1");
    apiClient.getProfiles().then((items) => {
      // Usa los perfiles REALES de la cuenta (aunque vengan vacíos): así un usuario
      // sin perfiles ve su bandeja vacía y crea los suyos, en vez de ver mocks ajenos.
      setProfiles(items);
      if (items.length) {
        setActiveProfileId((items.find((item) => item.active) ?? items[0]).id);
      }
      setProfilesLoaded(true);
    }).catch(() => setProfilesLoaded(true));
    apiClient.getCredentials().then(setCredentials).catch(() => undefined);
    apiClient.getAiProviders().then(setAiProviders).catch(() => undefined);
    apiClient.getSyncRuns().then(setSyncRuns).catch(() => undefined);
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

  // Apertura automática del tutorial: solo la primera vez, si no tiene perfiles.
  useEffect(() => {
    if (profilesLoaded && !hasProfiles && !tutorialSeen) {
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  }, [profilesLoaded, hasProfiles, tutorialSeen]);

  // Bandeja por perfil: recarga las vacantes del perfil activo al cambiarlo.
  useEffect(() => {
    if (!user) return;
    apiClient.getJobs(activeProfileId).then(setJobs).catch(() => undefined);
    setSelectedId(null);
    setEvaluationByJob({});
  }, [user, activeProfileId]);

  // Auto-reload del inbox: sin push en tiempo real, refrescamos las vacantes del
  // perfil activo cada 5 minutos mientras el usuario está parado en la bandeja.
  useEffect(() => {
    if (!user || view !== "inbox") return;
    const id = window.setInterval(() => {
      apiClient.getJobs(activeProfileId).then(setJobs).catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [user, view, activeProfileId]);

  // El estado "ya analizada" (botones deshabilitados) solo se reinicia cuando el
  // usuario cambia la IA/modelo asignado a "Análisis CV vs vacante".
  const comparatorKey = aiProviders
    .flatMap((provider) => provider.assignments.map((item) => ({ provider: provider.provider, task: item.task, model: item.model })))
    .filter((item) => item.task === "cv_vs_job")
    .map((item) => `${item.provider}:${item.model}`)
    .join("|");
  useEffect(() => {
    setAnalysisByJob({});
  }, [comparatorKey]);

  const counts = useMemo(() => ({
    total: jobs.length,
    nuevas: jobs.filter((job) => job.status === "nueva").length,
    alto: jobs.filter((job) => displayJobScore(job, activeProfile) >= 85).length,
    aplicadas: jobs.filter((job) => job.status === "aplicada").length,
    descartadas: jobs.filter((job) => job.status === "descartada").length,
    connected: credentials.filter((credential) => credential.status === "connected").length,
  }), [activeProfile, credentials, jobs]);

  const visibleJobs = useMemo(() => {
    let next = [...jobs];
    const query = search.trim().toLowerCase();
    if (query) {
      next = next.filter((job) => `${job.title} ${job.company} ${job.location} ${job.skills.join(" ")}`.toLowerCase().includes(query));
    }
    if (filter === "nuevas") next = next.filter((job) => job.status === "nueva");
    if (filter === "alto") next = next.filter((job) => displayJobScore(job, activeProfile) >= 85);
    if (filter === "aplicadas") next = next.filter((job) => job.status === "aplicada");
    if (filter === "descartadas") next = next.filter((job) => job.status === "descartada");
    if (sort === "score") next.sort((a, b) => displayJobScore(b, activeProfile) - displayJobScore(a, activeProfile));
    // Fecha: más recientes primero. detectedAt es ISO (orden lexicográfico = cronológico).
    if (sort === "fecha") next.sort((a, b) => (b.detectedAt ?? "").localeCompare(a.detectedAt ?? ""));
    return next;
  }, [activeProfile, filter, jobs, search, sort]);

  const subtitle = {
    inbox: `${counts.total} vacantes · ${counts.nuevas} nuevas`,
    perfiles: `${profiles.length} perfiles · 1 activo`,
    settings: `${credentials.length} proveedores`,
    jobs: "1018 totales hoy",
    subscription: subscription ? subscription.plan.name : "planes BYOK",
    admin_users: "gestion de cuentas",
    admin_codes: "invitaciones F&F",
  }[view];
  const profilesLimit = Number(subscription?.plan.limits?.profiles_limit ?? 1) || 1;

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

  // El estado de cada vacante es por perfil y se persiste en el backend.
  const persistStatus = (id: number, status: Job["status"], reason?: string) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, status } : job)));
    void apiClient.updateJobStatus(id, status, reason).catch(() => undefined);
  };

  const selectJob = (id: number) => {
    setSelectedId(id);
    const job = jobs.find((item) => item.id === id);
    // Sin análisis aún: abre en el texto original de la vacante; si ya tiene
    // evaluación, abre en el análisis.
    setDetailTab(job && job.scoreType !== "prelim" ? "analisis" : "vacante");
    if (job && job.status === "nueva") persistStatus(id, "vista");
    // Si fue evaluada con IA y no tenemos el detalle en memoria, lo traemos.
    if (job && job.scoreType === "IA" && !evaluationByJob[id]) {
      apiClient.getJobEvaluation(id).then((evaluation) => {
        if (evaluation.hasEvaluation && evaluation.markdown) {
          setEvaluationByJob((current) => ({ ...current, [id]: { mode: evaluation.mode || "", markdown: evaluation.markdown || "" } }));
        }
      }).catch(() => undefined);
    }
  };

  const applySelected = () => {
    if (!selectedId) return;
    persistStatus(selectedId, "aplicada");
  };

  const unapplySelected = () => {
    if (!selectedId) return;
    persistStatus(selectedId, "vista");
  };

  const undiscardSelected = () => {
    if (!selectedId) return;
    persistStatus(selectedId, "vista");
  };

  const dismissSelected = (reason: string) => {
    if (!selectedId) return;
    persistStatus(selectedId, "descartada", reason);
    window.setTimeout(() => setSelectedId(null), 220);
  };

  const analyzeSelected = async (mode: AnalysisMode) => {
    if (!selectedId || analyzing) return;
    const jobId = selectedId;
    setAnalyzing(true);

    // Semántico (local): solo cuando NO hay IA asignada a comparación. Siempre
    // se puede re-ejecutar; sobreescribe el resultado semántico previo.
    if (mode === "semantic" || !usesAi) {
      window.setTimeout(() => {
        setJobs((current) => current.map((job) => (
          job.id === jobId ? { ...job, scoreType: "semantica", score: buildSemanticAnalysis(job, activeProfile).score } : job
        )));
        setDetailTab("analisis");
        setAnalyzing(false);
      }, 1200);
      return;
    }

    // Con IA: rápido (compacto) o profundo (exhaustivo). El profundo sobreescribe
    // al rápido. Al terminar, se marca la vacante para deshabilitar su(s) botón(es).
    const aiMode = mode as "quick" | "deep";
    try {
      const result = await apiClient.evaluateJob(jobId, aiMode);
      if (result.needsSource) {
        // Sin descripción: no inventamos; el panel muestra "visita el sitio".
        setDetailTab("analisis");
        return;
      }
      setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, scoreType: "IA", score: result.score } : job)));
      setAnalysisByJob((current) => ({ ...current, [jobId]: aiMode }));
      if (result.markdown) {
        setEvaluationByJob((current) => ({ ...current, [jobId]: { mode: result.mode || aiMode, markdown: result.markdown || "" } }));
      }
      setDetailTab("analisis");
    } catch (error) {
      console.error("Evaluación con IA falló:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const runSync = async () => {
    if (syncing) return;
    if (!profiles.length) {
      // Sin perfiles aún: nada que buscar. Llevamos al usuario a crear uno.
      setView("perfiles");
      return;
    }
    setSyncing(true);
    // Búsqueda propia del perfil activo (sus keywords) → alimenta su bandeja.
    let run: SyncRun;
    try {
      run = await apiClient.runSync(activeProfileId);
      setSyncRuns((current) => [run, ...current]);
    } catch (error) {
      setSyncRuns((current) => [{ id: Date.now(), source: "Manual scan", status: "failed", found: 0, duration: "00:00", started: "ahora", createdAt: new Date().toISOString(), error: error instanceof Error ? error.message : "No se pudo iniciar el escaneo" }, ...current]);
      setSyncing(false);
      return;
    }
    // Sondeamos el estado REAL del run hasta que el servicio de escaneo termine
    // (success/failed). Mientras tanto `syncing` sigue true → el botón queda
    // bloqueado y muestra "Escaneando". Al terminar, recargamos la bandeja para
    // que el inbox se actualice solo si el usuario está parado en él.
    const runId = run.id;
    const startedAt = Date.now();
    const maxWaitMs = 180000; // 3 min de seguridad por si el worker no responde
    const finish = () => {
      setSyncing(false);
      apiClient.getSyncRuns().then(setSyncRuns).catch(() => undefined);
      // Recargar jobs actualiza también los contadores (counts es un useMemo de jobs).
      apiClient.getJobs(activeProfileId).then(setJobs).catch(() => undefined);
    };
    const poll = async () => {
      try {
        const runs = await apiClient.getSyncRuns();
        setSyncRuns(runs);
        const current = runs.find((item) => item.id === runId);
        if (current && current.status !== "running" && current.status !== "pending") {
          finish();
          return;
        }
      } catch {
        // Error de red transitorio: seguimos sondeando hasta el límite.
      }
      if (Date.now() - startedAt > maxWaitMs) {
        finish();
        return;
      }
      window.setTimeout(poll, 2500);
    };
    window.setTimeout(poll, 2500);
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

  const saveProfile = async (next: ProfileDraft) => {
    const exists = profiles.some((item) => item.id === next.id);
    const localProfile: Profile = {
      ...next,
      initials: next.initials || initialsOf(next.name || "Perfil"),
      name: next.name.trim() || "Nuevo perfil",
    };
    const { id: _id, active: _active, ...rest } = localProfile;
    const payload = { ...rest, active: next.active };
    setEditorOpen(false);
    try {
      const saved = exists ? await apiClient.updateProfile(next.id, payload) : await apiClient.createProfile(payload);
      setProfiles((current) => (exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]));
      if (next.active || !exists) setActiveProfileId(saved.id);
    } catch {
      // Sin backend (modo mock): conserva el guardado local para no perder el trabajo.
      setProfiles((current) => (exists ? current.map((item) => (item.id === localProfile.id ? localProfile : item)) : [...current, localProfile]));
      if (next.active || !exists) setActiveProfileId(localProfile.id);
    }
  };

  const updateProfileInState = (profile: Profile) => {
    setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)));
    setDraft((current) => (current && current.id === profile.id ? { ...profile, active: current.active ?? Boolean(profile.active) } : current));
  };

  const deleteProfile = async (id: number) => {
    setEditorOpen(false);
    setSelectedId(null);
    try {
      await apiClient.deleteProfile(id);
      // El backend borró el perfil y todas las vacantes propias del usuario.
      const items = await apiClient.getProfiles();
      setProfiles(items);
      if (items.length) setActiveProfileId((items.find((item) => item.active) ?? items[0]).id);
      const freshJobs = await apiClient.getJobs();
      setJobs(freshJobs);
    } catch {
      // Sin backend: refleja el borrado localmente.
      setProfiles((current) => current.filter((profile) => profile.id !== id));
    }
  };

  const saveCredential = async (payload: CredentialPayload) => {
    const saved = await apiClient.saveCredential(payload);
    setCredentials((current) => current.map((credential) => (credential.id === payload.providerId ? saved : credential)));
    // Si es un proveedor de IA, refresca su config (queda "conectado" y habilita modelo/tarea).
    apiClient.getAiProviders().then(setAiProviders).catch(() => undefined);
  };

  const deleteCredential = async (id: string) => {
    await apiClient.deleteCredential(id);
    // Recargamos la lista para reflejar el estado real (gmail/whatsapp desconectados).
    apiClient.getCredentials().then(setCredentials).catch(() => undefined);
    apiClient.getAiProviders().then(setAiProviders).catch(() => undefined);
  };

  const updateAiConfig = async (provider: string, assignments: AiAssignment[]) => {
    const updated = await apiClient.updateAiConfig({ provider, assignments });
    setAiProviders(updated);
  };

  const testCredential = async (id: string, payload?: CredentialTestPayload) => {
    setCredentials((current) => current.map((credential) => (credential.id === id ? { ...credential, status: "testing" } : credential)));
    try {
      const result = await apiClient.testCredential(id, payload);
      setCredentials((current) => current.map((credential) => (credential.id === id ? { ...credential, status: credential.maskedKey?.startsWith("sin ") ? "disconnected" : "connected", lastTest: result.message || "test ahora" } : credential)));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "La prueba falló";
      setCredentials((current) => current.map((credential) => (credential.id === id ? { ...credential, status: "error", lastTest: message } : credential)));
      throw error; // para que el flujo de WhatsApp (que captura) muestre el error
    }
  };

  const login = async (payload: { email: string; password: string }) => {
    const session = await apiClient.login(payload);
    apiClient.setToken(session.accessToken);
    setUser(session.user);
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    return apiClient.register(payload);
  };

  const logout = () => {
    apiClient.clearToken();
    setUser(null);
    setView("inbox");
    setSelectedId(null);
    setNavOpen(false);
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


  const nextTutorial = () => setTutorialStep((step) => step + 1);
  const endTutorial = () => {
    setTutorialOpen(false);
    setTutorialStep(0);
    setTutorialSeen(true);
    if (user) localStorage.setItem(tutorialSeenKey(user.id), "1");
    setView("perfiles");
  };
  const openTutorial = () => {
    setTutorialStep(0);
    setTutorialOpen(true);
    setNavOpen(false);
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
    <>
    {showTutorial ? (
      <OnboardingTutorial step={tutorialStep} onNavigate={setView} onNext={nextTutorial} onSkip={endTutorial} onFinish={endTutorial} />
    ) : null}
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
      userName={user?.name ?? activeProfile.name}
      userEmail={user?.email ?? activeProfile.email}
      isAdmin={Boolean(user?.isAdmin)}
      hasProfiles={hasProfiles}
      planName={subscription?.plan.name ?? "Free"}
      profilesUsed={profiles.length}
      profilesLimit={profilesLimit}
      hasRunning={syncRuns.some((run) => run.status === "running") || syncing}
      lastSyncAt={syncRuns.find((run) => run.status === "success")?.createdAt ?? null}
      onNavigate={setView}
      onCloseNav={() => setNavOpen(false)}
      onToggleNav={() => setNavOpen((open) => !open)}
      onDensity={updateDensity}
      onRunSync={runSync}
      onToggleThemeMenu={() => setThemeMenuOpen((open) => !open)}
      onCloseThemeMenu={() => setThemeMenuOpen(false)}
      onTheme={setTheme}
      onAccent={setAccent}
      onLogout={logout}
      onHelp={openTutorial}
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
          usesAi={usesAi}
          analyzed={selectedJob ? analysisByJob[selectedJob.id] : undefined}
          evaluation={selectedJob ? evaluationByJob[selectedJob.id] : undefined}
          keywordsExpanded={keywordsExpanded}
          counts={counts}
          onSearch={setSearch}
          onFilter={setFilter}
          onSort={setSort}
          onSelectJob={selectJob}
          onCloseDetail={() => setSelectedId(null)}
          onTab={setDetailTab}
          onApply={applySelected}
          onUnapply={unapplySelected}
          onUndiscard={undiscardSelected}
          onDismiss={dismissSelected}
          onAnalyze={analyzeSelected}
          onClearFilters={() => { setSearch(""); setFilter("todas"); }}
          onToggleKeywords={() => setKeywordsExpanded((open) => !open)}
        />
      ) : null}

      {view === "perfiles" ? (
        <ProfilesView
          profiles={profiles}
          profilesLimit={profilesLimit}
          activeId={activeProfileId}
          activeProfile={activeProfile}
          draft={draft}
          editorOpen={editorOpen}
          usesAi={usesAi}
          onSelect={setActiveProfileId}
          onNew={openNewProfile}
          onEdit={openEditProfile}
          onCloseEditor={() => setEditorOpen(false)}
          onSave={saveProfile}
          onDelete={deleteProfile}
          onProfileUpdated={updateProfileInState}
        />
      ) : null}

      {view === "settings" ? <SettingsView credentials={credentials} aiProviders={aiProviders} onAiConfig={updateAiConfig} onSaveCredential={saveCredential} onTestCredential={testCredential} onConnectGoogle={connectGoogle} onDeleteCredential={deleteCredential} /> : null}
      {view === "jobs" ? <SyncRunsView runs={syncRuns} totalJobs={counts.total} nuevas={counts.nuevas} /> : null}
      {view === "subscription" ? <SubscriptionView plans={plans} subscription={subscription} /> : null}
      {view === "admin_users" && user?.isAdmin ? <AdminUsersView plans={plans} currentUserId={user.id} /> : null}
      {view === "admin_codes" && user?.isAdmin ? <AdminCodesView /> : null}
    </AppShell>
    </>
  );
}
