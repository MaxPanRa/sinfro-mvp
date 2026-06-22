// Etiquetas legibles para cada modelo de IA, para que un usuario cualquiera
// entienda qué elegir sin conocer los IDs técnicos. La clave es el id del modelo.
const MODEL_LABELS: Record<string, string> = {
  // --- OpenCode Go ---
  "deepseek-v4-flash": "Rápido y económico · ideal para leer CVs",
  "deepseek-v4-pro": "Más potente, razona mejor · más lento",
  "kimi-k2.7": "Equilibrado · contexto largo",
  "kimi-k2.6": "Equilibrado · contexto largo",
  "glm-5.2": "Generalista equilibrado",
  "glm-5.1": "Generalista equilibrado",
  "mimo-v2.5": "Ligero y veloz",
  "mimo-v2.5-pro": "Ligero · versión Pro",
  "minimax-m3": "Razonamiento avanzado · lento",
  "minimax-m2.7": "Razonamiento · lento",
  "minimax-m2.5": "Razonamiento · lento",
  "qwen3.7-max": "Máxima calidad · más lento",
  "qwen3.7-plus": "Alta calidad",
  "qwen3.6-plus": "Alta calidad",
  // --- OpenAI ---
  "gpt-4o-mini": "Rápido y barato",
  "gpt-4o": "Equilibrado",
  "gpt-4.1-mini": "Rápido",
  "gpt-4.1": "Potente",
  // --- Anthropic (Claude) ---
  "claude-haiku-4-5-20251001": "Rápido y barato",
  "claude-sonnet-4-6": "Equilibrado",
  "claude-opus-4-8": "Máxima calidad",
  // --- Gemini ---
  "gemini-2.0-flash": "Rápido",
  "gemini-2.0-pro": "Potente",
};

export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? "";
}

// Texto para la opción del <select>: "id · descripción" (o solo el id si no hay).
export function modelOptionText(id: string): string {
  const label = modelLabel(id);
  return label ? `${id} · ${label}` : id;
}
