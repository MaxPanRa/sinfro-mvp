import { Check, CreditCard } from "lucide-react";
import type { SubscriptionPlan, UserSubscription } from "../types/subscription";
import { Button } from "../components/ui/Button";

export function SubscriptionView({ plans, subscription }: { plans: SubscriptionPlan[]; subscription: UserSubscription | null }) {
  const activeCode = subscription?.plan.code;

  return (
    <div className="view">
      <div className="view-inner">
        <div className="view-title-row">
          <h2>Planes y suscripcion</h2>
          <span className="mono faint" style={{ fontSize: 12 }}>pagos reales pendientes</span>
        </div>

        <div className="surface-card" style={{ padding: "16px 18px", marginBottom: 22, borderRadius: 9, display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar"><CreditCard size={16} /></div>
          <div className="spacer">
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Plan actual: {subscription?.plan.name ?? "Free"}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Para acceder a planes con beneficios, contacta al equipo de SinFro.</div>
          </div>
          <span className="status-badge" style={{ color: "var(--accent)", background: "var(--accentW2)" }}>{subscription?.status ?? "active"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {plans.map((plan) => (
            <article key={plan.code} className="surface-card" style={{ padding: 18, borderRadius: 9, borderColor: plan.code === activeCode ? "var(--accent)" : "var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{plan.name}</h3>
                {plan.code === activeCode ? <span className="status-badge" style={{ color: "var(--accent)", background: "var(--accentW2)" }}>Actual</span> : null}
              </div>
              <div className="mono" style={{ color: "var(--accent)", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{plan.priceLabel}</div>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5 }}>{plan.description}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {plan.features.map((feature) => (
                  <span key={feature} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <Check size={14} color="var(--accent)" /> {feature}
                  </span>
                ))}
              </div>
              <Button disabled>{plan.code === activeCode ? "Plan activo" : "Elegir plan"}</Button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
