import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, ShieldOff, Sparkles, X } from "lucide-react";
import { apiClient, type AdminUser, type AiProviderConfig } from "../lib/apiClient";
import { modelOptionText } from "../lib/modelInfo";
import type { SubscriptionPlan } from "../types/subscription";
import { Button } from "../components/ui/Button";

const TASK_OPTIONS: { value: string; label: string }[] = [
  { value: "cv_read", label: "Lectura de CV" },
  { value: "cv_vs_job", label: "Análisis CV vs vacante" },
];
const taskLabel = (task: string) => TASK_OPTIONS.find((option) => option.value === task)?.label ?? task;

export function AdminUsersView({ plans, currentUserId }: { plans: SubscriptionPlan[]; currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Asignación de IA por el admin a uno o más usuarios.
  const [assignable, setAssignable] = useState<AiProviderConfig[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [tasks, setTasks] = useState<Set<string>>(new Set(["cv_read", "cv_vs_job"]));
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [list, ai] = await Promise.all([apiClient.getAdminUsers(), apiClient.getAssignableAi().catch(() => [])]);
      setUsers(list);
      setAssignable(ai);
      if (ai.length && !ai.some((item) => item.provider === provider)) {
        setProvider(ai[0].provider);
        setModel(ai[0].defaultModel || ai[0].models[0] || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProvider = useMemo(() => assignable.find((item) => item.provider === provider), [assignable, provider]);
  const providerModels = activeProvider ? (activeProvider.models.includes(model) || !model ? activeProvider.models : [model, ...activeProvider.models]) : [];

  const patchUser = async (id: number, action: () => Promise<AdminUser>) => {
    setBusyId(id);
    setError("");
    try {
      const updated = await action();
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario.");
    } finally {
      setBusyId(null);
    }
  };

  const mergeUpdated = (updatedUsers: AdminUser[]) => {
    const map = new Map(updatedUsers.map((user) => [user.id, user]));
    setUsers((current) => current.map((user) => map.get(user.id) ?? user));
  };

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTask = (task: string) => {
    setTasks((current) => {
      const next = new Set(current);
      if (next.has(task)) next.delete(task); else next.add(task);
      return next;
    });
  };

  const assign = async () => {
    if (!selected.size || !provider || !tasks.size) return;
    setAssigning(true);
    setError("");
    try {
      const updated = await apiClient.assignAdminAi({ userIds: [...selected], provider, model, tasks: [...tasks] });
      mergeUpdated(updated);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar la IA.");
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async (userId: number, task?: string) => {
    setBusyId(userId);
    setError("");
    try {
      const updated = await apiClient.unassignAdminAi({ userIds: [userId], tasks: task ? [task] : [] });
      mergeUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la IA.");
    } finally {
      setBusyId(null);
    }
  };

  const grid = "auto 1.4fr 0.9fr 1.1fr 0.8fr 1fr";

  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Usuarios</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>{users.length} cuentas</span>
          <div className="spacer" />
          <Button onClick={load} icon={loading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <RefreshCcw size={14} />}>Actualizar</Button>
        </div>

        {error ? <div className="notice is-error">{error}</div> : null}

        <div className="surface-card" style={{ padding: "14px 16px", marginBottom: 16, borderRadius: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
            <Sparkles size={15} color="var(--accent)" /> Asignar IA a usuarios seleccionados
          </div>
          {assignable.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <label className="ai-config-field" style={{ minWidth: 160 }}>
                <span className="faint">Proveedor (tu IA)</span>
                <select className="field select" value={provider} onChange={(event) => { setProvider(event.target.value); const next = assignable.find((item) => item.provider === event.target.value); setModel(next?.defaultModel || next?.models[0] || ""); }}>
                  {assignable.map((item) => <option key={item.provider} value={item.provider}>{item.name}</option>)}
                </select>
              </label>
              <label className="ai-config-field" style={{ minWidth: 200 }}>
                <span className="faint">Modelo</span>
                <select className="field select" value={model} onChange={(event) => setModel(event.target.value)}>
                  {providerModels.map((option) => <option key={option} value={option}>{modelOptionText(option)}</option>)}
                </select>
              </label>
              <div className="ai-config-field">
                <span className="faint">Tareas</span>
                <div style={{ display: "flex", gap: 12 }}>
                  {TASK_OPTIONS.map((option) => (
                    <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={tasks.has(option.value)} onChange={() => toggleTask(option.value)} /> {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <Button variant="primary" disabled={assigning || !selected.size || !tasks.size} onClick={assign} icon={assigning ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <Sparkles size={14} />}>
                Asignar a {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>Conecta al menos una IA (Conexiones · BYOK) para poder asignarla a tus usuarios.</div>
          )}
        </div>

        <div className="settings-group">
          <div className="sync-row is-head" style={{ gridTemplateColumns: grid }}>
            <span></span><span>Usuario</span><span>Plan</span><span>IA asignada</span><span>Estado</span><span className="right">Acciones</span>
          </div>
          {loading ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Cargando usuarios...</span></div>
          ) : null}
          {!loading && !users.length ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Sin usuarios registrados</span></div>
          ) : null}
          {users.map((user) => (
            <div className="sync-row" key={user.id} style={{ gridTemplateColumns: grid }}>
              <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelected(user.id)} aria-label={`Seleccionar ${user.email}`} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div className="mono faint" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              </div>
              <select
                className="field select"
                value={user.planCode}
                disabled={busyId === user.id}
                onChange={(event) => void patchUser(user.id, () => apiClient.updateAdminUserPlan(user.id, event.target.value))}
              >
                {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
              </select>
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {user.aiAssignments.length ? user.aiAssignments.map((item) => (
                  <span key={item.task} className="status-badge" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)", background: "var(--accentW2)", fontSize: 11 }}>
                    {taskLabel(item.task)}: {modelOptionText(item.model)}
                    <button type="button" aria-label="Quitar" onClick={() => void unassign(user.id, item.task)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", display: "inline-flex" }}><X size={12} /></button>
                  </span>
                )) : <span className="faint" style={{ fontSize: 11.5 }}>—</span>}
              </div>
              <span className="status-badge" style={{ color: user.isActive ? "var(--accent)" : "var(--danger)", background: user.isActive ? "var(--accentW2)" : "rgba(229,72,77,0.10)" }}>
                {user.isActive ? "Activo" : "Desactivado"}
              </span>
              <div className="right">
                <Button
                  variant={user.isActive ? "danger" : "ghost"}
                  disabled={busyId === user.id || user.id === currentUserId}
                  onClick={() => void patchUser(user.id, () => apiClient.updateAdminUserStatus(user.id, !user.isActive))}
                  icon={busyId === user.id ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <ShieldOff size={14} />}
                >
                  {user.isActive ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
