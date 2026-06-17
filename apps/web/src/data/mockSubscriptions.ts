import type { SubscriptionPlan, UserSubscription } from "../types/subscription";

export const mockPlans: SubscriptionPlan[] = [
  { id: 1, code: "free", name: "Free", priceLabel: "$0", description: "1 perfil, escaneos manuales y BYOK basico.", features: ["1 perfil", "Sync manual", "BYOK local"] },
  { id: 2, code: "pro_byok", name: "Pro BYOK", priceLabel: "$12/mes", description: "Multi-perfil, analisis profundo y mas fuentes.", features: ["5 perfiles", "Sync programado", "Analisis profundo"] },
  { id: 3, code: "team_byok", name: "Team BYOK", priceLabel: "$39/mes", description: "Colaboracion para equipos pequenos.", features: ["Usuarios de equipo", "Roles", "Historial compartido"] },
];

export const mockSubscription: UserSubscription = {
  status: "active",
  plan: mockPlans[0],
};
