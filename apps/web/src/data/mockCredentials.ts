import type { CredentialProvider } from "../types/credential";

export const mockCredentials: CredentialProvider[] = [
  { id: "openai", group: "Modelos de IA", name: "OpenAI", glyph: "AI", iconColor: "var(--accent)", status: "connected", maskedKey: "sk-····a93f", lastTest: "test hace 3 h" },
  { id: "anthropic", group: "Modelos de IA", name: "Claude / Anthropic", glyph: "CL", iconColor: "#F2B84B", status: "connected", maskedKey: "sk-ant-····b21x", lastTest: "test hace 3 h" },
  { id: "gemini", group: "Modelos de IA", name: "Gemini", glyph: "GE", iconColor: "#4EA7F5", status: "disconnected", maskedKey: "— sin credencial —", lastTest: "nunca probado" },
  { id: "opencode-go", group: "Modelos de IA", name: "OpenCode Go", glyph: "OC", iconColor: "var(--text2)", status: "disconnected", maskedKey: "— sin credencial —", lastTest: "nunca probado" },
  { id: "serpapi", group: "Busqueda & scraping", name: "SerpAPI", glyph: "SE", iconColor: "#4EA7F5", status: "connected", maskedKey: "····77ad", lastTest: "test hace 5 min" },
  { id: "apify", group: "Busqueda & scraping", name: "Apify", glyph: "AP", iconColor: "var(--accent)", status: "connected", maskedKey: "apify_····c0", lastTest: "test hace 12 min" },
  { id: "adzuna", group: "Bolsas de empleo", name: "Adzuna", glyph: "AD", iconColor: "var(--accent)", status: "connected", maskedKey: "app····e1", lastTest: "test hace 1 h" },
  { id: "jooble", group: "Bolsas de empleo", name: "Jooble", glyph: "JO", iconColor: "#E5484D", status: "disconnected", maskedKey: "— sin credencial —", lastTest: "nunca probado" },
];
