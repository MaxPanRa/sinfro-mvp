import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, ShieldOff } from "lucide-react";
import { apiClient, type AdminUser } from "../lib/apiClient";
import type { SubscriptionPlan } from "../types/subscription";
import { Button } from "../components/ui/Button";

export function AdminUsersView({ plans, currentUserId }: { plans: SubscriptionPlan[]; currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      setUsers(await apiClient.getAdminUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

        <div className="settings-group">
          <div className="sync-row is-head" style={{ gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.8fr 1fr" }}>
            <span>Usuario</span><span>Plan</span><span>Perfiles</span><span>Estado</span><span className="right">Acciones</span>
          </div>
          {loading ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Cargando usuarios...</span></div>
          ) : null}
          {!loading && !users.length ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Sin usuarios registrados</span></div>
          ) : null}
          {users.map((user) => (
            <div className="sync-row" key={user.id} style={{ gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.8fr 1fr" }}>
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
              <div className="mono" style={{ color: user.disabledProfiles ? "var(--warning)" : "var(--text2)", fontSize: 12 }}>
                {user.visibleProfiles} visibles / {user.disabledProfiles} ocultos
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
