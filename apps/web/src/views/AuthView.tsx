import { useState } from "react";
import { CheckCircle2, LogIn, Mail, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import logoBlack from "../assets/brand/logo_black.png";
import logoWhite from "../assets/brand/logo_white.png";

interface AuthViewProps {
  verifying: boolean;
  verifyError: string | null;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegister: (payload: { name: string; email: string; password: string }) => Promise<{ message: string; devVerificationUrl?: string | null }>;
}

export function AuthView({ verifying, verifyError, onLogin, onRegister }: AuthViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevLink(null);
    if (password.length < 8) {
      setError("El password debe tener al menos 8 caracteres.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Los passwords no coinciden.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await onLogin({ email, password });
      } else {
        const result = await onRegister({ name, email, password });
        setMessage(result.message);
        setDevLink(result.devVerificationUrl ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la accion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen" data-theme="esmeralda" data-accent="esmeralda">
      <form className="auth-panel" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark">
            <img className="brand-logo__image logo--light" src={logoWhite} alt="SinFro" />
            <img className="brand-logo__image logo--dark" src={logoBlack} alt="SinFro" />
          </span>
          <div>
            <h1>SinFro</h1>
            <p>{mode === "login" ? "Entra a tu bandeja de vacantes." : "Crea tu usuario para empezar."}</p>
          </div>
        </div>

        <div className="auth-switch">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>Crear usuario</button>
        </div>

        {verifying ? <div className="notice">Confirmando correo...</div> : null}
        {verifyError ? <div className="notice is-error">{verifyError}</div> : null}

        {mode === "register" ? (
          <label className="auth-field">
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" />
          </label>
        ) : null}

        <label className="auth-field">
          Correo
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required />
        </label>

        <label className="auth-field">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 8 caracteres" required />
        </label>

        {mode === "register" ? (
          <label className="auth-field">
            Confirmar password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu password" required />
          </label>
        ) : null}

        <div className={`password-rule ${password.length >= 8 ? "is-ok" : ""}`}>
          <CheckCircle2 size={14} />
          Minimo 8 caracteres
        </div>

        {error ? <div className="notice is-error">{error}</div> : null}
        {message ? (
          <div className="notice">
            <Mail size={14} />
            <span>{message}</span>
          </div>
        ) : null}
        {devLink ? <a className="dev-link" href={devLink}>Abrir liga dev de confirmacion</a> : null}

        <Button type="submit" variant="primary" icon={mode === "login" ? <LogIn size={14} /> : <UserPlus size={14} />}>
          {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear y enviar correo"}
        </Button>
      </form>
    </div>
  );
}
