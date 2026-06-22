import { useLayoutEffect, useRef, useState } from "react";
import type { ViewId } from "../../types/theme";
import { Button } from "../ui/Button";

// Intervalo de escaneo (config por entorno); fallback 60 min si no está definido.
const SCAN_INTERVAL = (import.meta.env as Record<string, string | undefined>).VITE_SCAN_INTERVAL_MIN || "60";

// Colocación del pop-up por paso: pantalla completa, esquinas/centros, o anclado
// a un elemento de interés (data-tour) por debajo o a un lado.
type Placement =
  | { kind: "center" | "top" | "bottom" }
  | { kind: "anchor"; selector: string; side: "below" | "right" };

interface Step {
  view: ViewId;
  title: string;
  body: string;
  placement: Placement;
}

const STEPS: Step[] = [
  {
    view: "perfiles",
    title: "¡Bienvenido a Sinfron!",
    body: "Encuentra tu trabajo sin frontera alguna. Sinfron es tu radar de empleos: reúne vacantes de muchas fuentes, las evalúa contra tu CV con IA y te muestra las más compatibles, para que apliques sin perder tiempo.",
    placement: { kind: "center" },
  },
  {
    view: "subscription",
    title: "Elige tu plan",
    body: "Existen 4 planes: Free, Friends & Family, Pro BYOK y Team BYOK. Cada plan incluye todas las ventajas del anterior y suma más: más perfiles, más escaneos al día, análisis profundo y fuentes adicionales.",
    placement: { kind: "anchor", selector: "[data-tour='subscriptions']", side: "below" },
  },
  {
    view: "settings",
    title: "Conecta tus aplicaciones",
    body: `Aquí conectas tus apps para recibir notificaciones gratis (Gmail, WhatsApp). En cada escaneo (cada ${SCAN_INTERVAL} minutos) buscamos vacantes nuevas. También conectas tus modelos de Inteligencia Artificial para analizar tu CV y hacer chequeos de compatibilidad CV vs vacante con porcentajes.`,
    placement: { kind: "bottom" },
  },
  {
    view: "settings",
    title: "Más fuentes de búsqueda",
    body: "También puedes agregar otros buscadores: crea cuentas gratuitas en estas bolsas de trabajo y pega sus llaves aquí para tener más opciones de búsqueda. Recuerda que tienes cierto número de escaneos manuales, y se hacen escaneos periódicos para mantener tu bandeja lo más actualizada posible.",
    placement: { kind: "top" },
  },
  {
    view: "perfiles",
    title: "Crea tu primer perfil",
    body: "Ahora mismo debes crear tu primer perfil para poder utilizar la aplicación. Sube tu currículum y, mediante reglas semánticas, se autocompletará la mayor información posible; llena la que falte para obtener mejores resultados.",
    placement: { kind: "anchor", selector: "[data-tour='new-profile']", side: "below" },
  },
];

interface OnboardingTutorialProps {
  step: number;
  onNavigate: (view: ViewId) => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export function OnboardingTutorial({ step, onNavigate, onNext, onSkip, onFinish }: OnboardingTutorialProps) {
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const isLast = step >= STEPS.length - 1;
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Navega a la sección y, si el paso está anclado, calcula la posición del card
  // junto al elemento de interés (reintenta unos frames mientras la vista monta).
  useLayoutEffect(() => {
    onNavigate(current.view);
    if (current.placement.kind !== "anchor") {
      setCoords(null);
      return;
    }
    const placement = current.placement;
    let frame = 0;
    let tries = 0;
    const place = () => {
      const target = document.querySelector(placement.selector);
      const card = cardRef.current;
      if (!target || !card) {
        if (tries++ < 12) frame = requestAnimationFrame(place);
        return;
      }
      const rect = target.getBoundingClientRect();
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      let top: number;
      let left: number;
      if (placement.side === "right") {
        left = rect.right + 14;
        top = rect.top;
      } else {
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2 - cardW / 2;
      }
      const margin = 12;
      left = Math.max(margin, Math.min(left, window.innerWidth - cardW - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - cardH - margin));
      setCoords({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const isAnchor = current.placement.kind === "anchor";
  const overlayAlign =
    current.placement.kind === "top" ? "flex-start" : current.placement.kind === "bottom" ? "flex-end" : "center";
  const cardStyle = isAnchor
    ? { position: "absolute" as const, top: coords?.top ?? 0, left: coords?.left ?? 0, visibility: coords ? ("visible" as const) : ("hidden" as const) }
    : undefined;

  return (
    <div className="tutorial-overlay" style={{ alignItems: isAnchor ? "flex-start" : overlayAlign }}>
      <div className="tutorial-card" ref={cardRef} style={cardStyle}>
        <div className="tutorial-dots">
          {STEPS.map((_, index) => (
            <span key={index} className={`tutorial-dot ${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-body">{current.body}</p>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={onSkip}>Saltar explicación</button>
          <div className="spacer" />
          {isLast ? (
            <Button variant="primary" onClick={onFinish}>Terminar</Button>
          ) : (
            <Button variant="primary" onClick={onNext}>Continuar ({step + 1}/{STEPS.length})</Button>
          )}
        </div>
      </div>
    </div>
  );
}
