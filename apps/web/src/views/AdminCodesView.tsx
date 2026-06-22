import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCcw, Ticket, UserPlus } from "lucide-react";
import { apiClient, type AdminCode, type AdminUser } from "../lib/apiClient";
import { Button } from "../components/ui/Button";

export function AdminCodesView() {
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Panel de asignación: código abierto, usuarios elegidos, correo y resultado.
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sendEmail, setSendEmail] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<string>("");

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [c, u] = await Promise.all([apiClient.getAdminCodes(), apiClient.getAdminUsers()]);
      setCodes(c);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar códigos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openAssign = (code: string) => {
    setOpenCode((current) => (current === code ? null : code));
    setSelected(new Set());
    setSendEmail(false);
    setResult("");
  };

  const toggleUser = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateCode = async (code: string, patch: { maxRedemptions?: number; active?: boolean }) => {
    try {
      const updated = await apiClient.updateAdminCode(code, patch);
      setCodes((current) => current.map((item) => (item.code === code ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el código.");
      void load();
    }
  };

  const setLocalMax = (code: string, value: number) =>
    setCodes((current) => current.map((item) => (item.code === code ? { ...item, maxRedemptions: value } : item)));

  const assign = async (code: string) => {
    if (!selected.size) return;
    setAssigning(true);
    setResult("");
    try {
      const res = await apiClient.assignAdminCode(code, [...selected], sendEmail);
      const parts = [`${res.assigned} usuario(s) asignados`];
      if (sendEmail) parts.push(`${res.emailed} correo(s) enviados`);
      if (res.skipped.length) parts.push(`omitidos: ${res.skipped.join("; ")}`);
      setResult(parts.join(" · "));
      await load();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "No se pudo asignar el código.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Códigos</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>asigna planes a usuarios existentes</span>
          <div className="spacer" />
          <Button onClick={load} icon={loading ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <RefreshCcw size={14} />}>Actualizar</Button>
        </div>

        {error ? <div className="notice is-error">{error}</div> : null}

        <div className="settings-group">
          <div className="sync-row is-head" style={{ gridTemplateColumns: "1.3fr 1fr 0.8fr 0.8fr 0.9fr" }}>
            <span>Código</span><span>Plan</span><span className="right">Canjes</span><span className="right">Estado</span><span className="right">Asignar</span>
          </div>
          {loading ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Cargando códigos...</span></div>
          ) : null}
          {!loading && !codes.length ? (
            <div className="sync-row" style={{ gridTemplateColumns: "1fr" }}><span className="muted">Sin códigos registrados</span></div>
          ) : null}
          {codes.map((code) => (
            <div key={code.code}>
              <div className="sync-row" style={{ gridTemplateColumns: "1.3fr 1fr 0.8fr 0.8fr 0.9fr" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <span className="avatar" style={{ width: 30, height: 30 }}><Ticket size={14} /></span>
                  <span className="mono" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{code.code}</span>
                </div>
                <span>{code.planCode}</span>
                <span className="right mono" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                  {code.redeemedCount} /
                  <input
                    className="field mono"
                    type="number"
                    min={code.redeemedCount}
                    value={code.maxRedemptions}
                    onChange={(event) => setLocalMax(code.code, Math.max(0, Number(event.target.value) || 0))}
                    onBlur={(event) => updateCode(code.code, { maxRedemptions: Math.max(0, Number(event.target.value) || 0) })}
                    style={{ width: 56, padding: "3px 6px", textAlign: "center" }}
                  />
                </span>
                <span className="right">
                  <button
                    className="status-badge"
                    onClick={() => updateCode(code.code, { active: !code.active })}
                    title="Clic para activar/desactivar"
                    style={{ cursor: "pointer", border: 0, color: code.active ? "var(--accent)" : "var(--danger)", background: code.active ? "var(--accentW2)" : "rgba(229,72,77,0.10)" }}
                  >
                    {code.active ? "Activo" : "Inactivo"}
                  </button>
                </span>
                <span className="right">
                  <Button disabled={!code.active} onClick={() => openAssign(code.code)} icon={<UserPlus size={14} />}>
                    {openCode === code.code ? "Cerrar" : "Asignar"}
                  </Button>
                </span>
              </div>

              {openCode === code.code ? (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--bdSoft)", background: "var(--bg)" }}>
                  <div className="section-kicker" style={{ marginBottom: 8 }}>Elige usuarios para el plan «{code.planCode}»</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto", marginBottom: 10 }}>
                    {users.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>Sin usuarios.</span> : null}
                    {users.map((user) => (
                      <label key={user.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 7px", borderRadius: 6, cursor: "pointer", fontSize: 12.5 }}>
                        <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleUser(user.id)} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong>{user.name}</strong> <span className="mono faint">{user.email}</span>
                        </span>
                        <span className="status-badge" style={{ color: "var(--text2)", background: "rgba(143,163,155,0.10)" }}>{user.planName}</span>
                      </label>
                    ))}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
                    <Mail size={14} color="var(--faint)" /> Enviar correo de aviso por SMTP a los usuarios seleccionados
                  </label>
                  {result ? <div className="notice" style={{ marginBottom: 10 }}>{result}</div> : null}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Button
                      variant="primary"
                      disabled={!selected.size || assigning}
                      onClick={() => void assign(code.code)}
                      icon={assigning ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <UserPlus size={14} />}
                    >
                      {assigning ? "Asignando..." : `Asignar a ${selected.size} usuario(s)`}
                    </Button>
                    <span className="muted" style={{ fontSize: 11.5 }}>El plan se aplica de inmediato a su cuenta.</span>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
