import { useState } from "react";
import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import type { Density, ThemeId } from "../types/theme";
import logoBlack from "../assets/brand/logo_black.png";
import logoWhite from "../assets/brand/logo_white.png";

const themes: Array<{ id: ThemeId; name: string; bg: string; surface: string }> = [
  { id: "esmeralda", name: "Esmeralda", bg: "#0B0F0E", surface: "#111816" },
  { id: "pizarra", name: "Pizarra", bg: "#0C0E11", surface: "#14171C" },
  { id: "carbon", name: "Carbon", bg: "#100E0C", surface: "#1A1713" },
  { id: "medianoche", name: "Medianoche", bg: "#000000", surface: "#0B0D0C" },
  { id: "claro", name: "Claro", bg: "#F4F6F5", surface: "#FFFFFF" },
];

const accents = ["#10A37F", "#14B8A6", "#84CC16", "#06B6D4", "#4EA7F5", "#F2B84B", "#E5484D", "#F97316"];

interface OnboardingViewProps {
  initialTheme: ThemeId;
  initialAccent: string;
  initialDensity: Density;
  onComplete: (payload: { theme: ThemeId; accent: string; density: Density }) => Promise<void>;
}

export function OnboardingView({ initialTheme, initialAccent, initialDensity, onComplete }: OnboardingViewProps) {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [accent, setAccent] = useState(initialAccent || "#10A37F");
  const [density, setDensity] = useState<Density>(initialDensity);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onComplete({ theme, accent, density });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-screen" data-theme={theme} style={{ "--accent": accent } as CSSProperties}>
      <div className="onboarding-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <img className="brand-logo__image logo--light" src={logoWhite} alt="SinFro" />
            <img className="brand-logo__image logo--dark" src={logoBlack} alt="SinFro" />
          </span>
          <div>
            <h1>Personaliza SinFro</h1>
            <p>Elige una base visual y tu color de acento.</p>
          </div>
        </div>

        <div className="onboarding-grid">
          {themes.map((item) => (
            <button key={item.id} className={`theme-card ${theme === item.id ? "is-active" : ""}`} onClick={() => setTheme(item.id)}>
              <span className="theme-preview">
                <span style={{ background: item.bg }} />
                <span style={{ background: item.surface }} />
                <span style={{ background: accent }} />
              </span>
              {item.name}
            </button>
          ))}
        </div>

        <div className="section-kicker">Color de acento</div>
        <div className="accent-row">
          {accents.map((color) => (
            <button key={color} className={`accent-dot ${accent.toLowerCase() === color.toLowerCase() ? "is-active" : ""}`} style={{ background: color }} onClick={() => setAccent(color)} />
          ))}
          <input className="color-input" type="color" value={accent.startsWith("#") ? accent : "#10A37F"} onChange={(event) => setAccent(event.target.value)} title="Color personalizado" />
        </div>

        <div className="auth-switch">
          <button type="button" className={density === "comoda" ? "is-active" : ""} onClick={() => setDensity("comoda")}>Comoda</button>
          <button type="button" className={density === "compacta" ? "is-active" : ""} onClick={() => setDensity("compacta")}>Compacta</button>
        </div>

        <Button variant="primary" icon={<Sparkles size={14} />} onClick={submit}>
          {saving ? "Guardando..." : "Entrar al dashboard"}
        </Button>
      </div>
    </div>
  );
}
