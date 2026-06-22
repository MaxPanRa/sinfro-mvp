// Determina si el plan del usuario usa evaluación con IA (Pro/Team BYOK).
// Free y Friends & Family usan evaluación semántica local (sin IA).
const AI_PLAN_CODES = new Set(["pro_byok", "team_byok"]);

export function planUsesAi(planCode?: string | null): boolean {
  return planCode ? AI_PLAN_CODES.has(planCode) : false;
}
