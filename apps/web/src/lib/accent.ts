import type { CSSProperties } from "react";

// Genera las variables CSS del acento a partir de un color hex. Incluye --onAccent,
// el color del texto/íconos sobre superficies con el acento (botones primarios, etc.),
// calculado por contraste para que se lea bien con cualquier acento, claro u oscuro.
export function accentVars(accent: string): CSSProperties {
  const color = accent.startsWith("#") ? accent : "#10A37F";
  const rgb = hexToRgb(color);
  if (!rgb) return {};
  const rgba = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  return {
    "--accent": color,
    "--accentH": color,
    "--accentW1": rgba(0.1),
    "--accentW2": rgba(0.13),
    "--accentW3": rgba(0.25),
    "--accentW4": rgba(0.28),
    "--accentGlow": rgba(0.4),
    "--onAccent": onAccentColor(rgb),
  } as CSSProperties;
}

// Elige texto claro u oscuro según la luminancia relativa (WCAG) del acento.
function onAccentColor(rgb: { r: number; g: number; b: number }) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  return luminance > 0.45 ? "#0B0B0B" : "#FFFFFF";
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
