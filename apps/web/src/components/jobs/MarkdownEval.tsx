import { useEffect, useState } from "react";
import {
  AlertTriangle, BookOpen, Building2, Check, Clock, Code2, Compass, CreditCard,
  FileText, Gavel, Laptop, Rocket, ShieldAlert, Sparkles, Target, TrendingUp, Trophy, Users,
  type LucideIcon,
} from "lucide-react";

// Evaluación en Markdown → CARDS con jerarquía, íconos y barras animadas.
// Modo "deep": Calificación (barras) vs Veredicto arriba, Fuertes (verde) vs
// Débiles (amarillo), Riesgos vs Probabilidad, y el resto.

type Block =
  | { type: "sub"; text: string }
  | { type: "bullet"; label?: string; text: string }
  | { type: "p"; text: string };

interface Card { title: string; blocks: Block[] }

const clean = (text: string) => text.replace(/\*\*/g, "").replace(/`/g, "").trim();

function splitLabel(text: string): { label?: string; text: string } {
  const match = text.match(/^([^:]{2,40}):\s*(.*)$/);
  if (match) return { label: match[1].trim(), text: (match[2] || "").trim() };
  return { text };
}

function parse(markdown: string): Card[] {
  const cards: Card[] = [];
  let current: Card | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) { current = { title: clean(line.slice(3)), blocks: [] }; cards.push(current); continue; }
    if (line.startsWith("# ")) continue;
    if (!current) { current = { title: "Resumen", blocks: [] }; cards.push(current); }
    if (line.startsWith("### ")) current.blocks.push({ type: "sub", text: clean(line.slice(4)) });
    else if (line.startsWith("- ") || line.startsWith("* ")) current.blocks.push({ type: "bullet", ...splitLabel(clean(line.slice(2))) });
    else current.blocks.push({ type: "p", text: clean(line) });
  }
  return cards.filter((card) => card.blocks.length > 0);
}

function subgroup(card: Card, keyword: string): Block[] {
  const out: Block[] = [];
  let active = false;
  for (const block of card.blocks) {
    if (block.type === "sub") { active = block.text.toLowerCase().includes(keyword); continue; }
    if (active) out.push(block);
  }
  return out;
}

const statColor = (pct: number) => (pct >= 70 ? "var(--accent)" : pct >= 40 ? "#F2B84B" : "var(--danger)");

function iconFor(title: string): LucideIcon {
  const t = title.toLowerCase();
  if (t.includes("resumen")) return FileText;
  if (t.includes("empresa")) return Building2;
  if (t.includes("modalidad")) return Laptop;
  if (t.includes("salario")) return CreditCard;
  if (t.includes("soft skill")) return Users;
  if (t.includes("hard skill")) return Code2;
  if (t.includes("match")) return Target;
  if (t.includes("riesgo")) return ShieldAlert;
  if (t.includes("tiempo")) return Clock;
  if (t.includes("probabilidad")) return TrendingUp;
  if (t.includes("veredicto")) return Gavel;
  if (t.includes("alineaci")) return Compass;
  if (t.includes("preparaci")) return BookOpen;
  if (t.includes("impacto")) return Rocket;
  if (t.includes("calificaci")) return Trophy;
  return Sparkles;
}

function valueColor(label: string | undefined, text: string): string | undefined {
  const value = text.trim().toLowerCase();
  const key = (label || "").toLowerCase();
  if (key.includes("riesgo")) {
    if (value.startsWith("alt")) return "var(--danger)";
    if (value.startsWith("med")) return "#F2B84B";
    if (value.startsWith("baj")) return "var(--accent)";
  }
  if (/^s[ií]\b/.test(value) && !value.includes("reserva")) return "var(--accent)";
  if (value.includes("con reserva")) return "#F2B84B";
  if (/^no\b/.test(value) || value === "no") return "var(--danger)";
  return undefined;
}

function AnimatedBar({ value, color, label, badge }: { value: number; color: string; label: string; badge: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
        <span className="muted">{label}</span>
        <span className="mono" style={{ color, fontWeight: 700 }}>{badge}</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${w}%`, background: color, transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }} /></div>
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {blocks.map((block, i) => {
        if (block.type === "sub") return <div key={i} style={{ fontSize: 12, fontWeight: 700, color: "var(--text1)", marginTop: i ? 8 : 0 }}>{block.text}</div>;
        if (block.type === "bullet") {
          const color = valueColor(block.label, block.text);
          return (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: "var(--text1)" }}>
              <span style={{ color: "var(--accent)", flexShrink: 0 }}>›</span>
              <span>{block.label ? <strong style={{ color: "var(--text)" }}>{block.label}: </strong> : null}<span style={color ? { color, fontWeight: 700 } : undefined}>{block.text}</span></span>
            </div>
          );
        }
        return <p key={i} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--text1)" }}>{block.text}</p>;
      })}
    </div>
  );
}

function CardHead({ icon: Icon, title, color }: { icon: LucideIcon; title: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
      <Icon size={15} /> {title}
    </div>
  );
}

function SectionCard({ card }: { card: Card }) {
  return (
    <div className="analysis-card">
      <CardHead icon={iconFor(card.title)} title={card.title} color="var(--text2)" />
      <Blocks blocks={card.blocks} />
    </div>
  );
}

function ColoredCard({ title, color, icon, blocks }: { title: string; color: string; icon: LucideIcon; blocks: Block[] }) {
  return (
    <div className="analysis-card" style={{ borderLeft: `3px solid ${color}` }}>
      <CardHead icon={icon} title={title} color={color} />
      {blocks.length ? <Blocks blocks={blocks} /> : <div className="muted" style={{ fontSize: 12 }}>Sin elementos.</div>}
    </div>
  );
}

// Calificación con barras animadas: Compatibilidad IA, Score total y categorías.
function ScoreCard({ card }: { card: Card }) {
  let compatPct: number | null = null;
  let scorePct: number | null = null;
  const categories: { label: string; pct: number }[] = [];
  const rest: Block[] = [];
  for (const block of card.blocks) {
    const text = block.type === "bullet" && block.label ? `${block.label}: ${block.text}` : block.text;
    const lower = text.toLowerCase();
    if (lower.includes("compatibilidad")) { const m = text.match(/([0-9]{1,3})\s*%/); if (m) { compatPct = Math.min(100, +m[1]); continue; } }
    if (lower.includes("score total")) { const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/); if (m) { scorePct = Math.round(parseFloat(m[1]) * 10); continue; } }
    // Línea de categorías: "Empresa: 8/10 — Salario: 7/10 — ..."
    const cats = [...text.matchAll(/([A-Za-zÁÉÍÓÚáéíóúñ ]{3,20}?):\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/g)];
    if (cats.length >= 2) { for (const c of cats) categories.push({ label: c[1].trim(), pct: Math.round(parseFloat(c[2]) * 10) }); continue; }
    rest.push(block);
  }
  return (
    <div className="analysis-card" style={{ borderLeft: "3px solid var(--accent)" }}>
      <CardHead icon={Trophy} title={card.title} color="var(--accent)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: rest.length ? 12 : 0 }}>
        {compatPct !== null ? <AnimatedBar label="Compatibilidad IA" value={compatPct} color={statColor(compatPct)} badge={`${compatPct}%`} /> : null}
        {scorePct !== null ? <AnimatedBar label="Score total" value={scorePct} color={statColor(scorePct)} badge={`${(scorePct / 10).toFixed(1)}/10`} /> : null}
        {categories.map((cat, i) => <AnimatedBar key={i} label={cat.label} value={cat.pct} color={statColor(cat.pct)} badge={`${(cat.pct / 10).toFixed(0)}/10`} />)}
      </div>
      {rest.length ? <Blocks blocks={rest} /> : null}
    </div>
  );
}

// stretch evita huecos vacíos: las cards de una fila igualan altura.
const ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "stretch" };

export function MarkdownEval({ markdown, mode }: { markdown: string; mode?: string }) {
  const cards = parse(markdown);
  if (!cards.length) return <div className="muted" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{markdown}</div>;

  if (mode === "deep") {
    const find = (kw: string) => cards.find((card) => card.title.toLowerCase().includes(kw));
    const calif = find("calificaci");
    const veredicto = find("veredicto");
    const match = find("match con mi perfil") || find("match");
    const riesgos = find("riesgos");
    const probab = find("probabilidad");
    const fortalezas = match ? subgroup(match, "fortaleza") : [];
    const parciales = match ? subgroup(match, "parcial") : [];
    const brechas = match ? subgroup(match, "brecha") : [];
    const priority = [calif, veredicto, match, riesgos, probab].filter(Boolean) as Card[];
    const rest = cards.filter((card) => !priority.includes(card));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(calif || veredicto) ? (
          <div style={ROW}>
            {calif ? <ScoreCard card={calif} /> : null}
            {veredicto ? <ColoredCard title={veredicto.title} color="#4EA7F5" icon={Gavel} blocks={veredicto.blocks} /> : null}
          </div>
        ) : null}
        {match ? (
          <div style={ROW}>
            <ColoredCard title="Puntos fuertes" color="var(--accent)" icon={Check} blocks={fortalezas} />
            <ColoredCard title="Puntos a reforzar / brechas" color="#F2B84B" icon={AlertTriangle} blocks={brechas} />
          </div>
        ) : null}
        {parciales.length ? <div style={ROW}><ColoredCard title="Parcialmente cubiertas" color="#4EA7F5" icon={Check} blocks={parciales} /></div> : null}
        {(riesgos || probab) ? (
          <div style={ROW}>
            {riesgos ? <ColoredCard title={riesgos.title} color="var(--danger)" icon={ShieldAlert} blocks={riesgos.blocks} /> : null}
            {probab ? <ColoredCard title={probab.title} color="var(--accent)" icon={TrendingUp} blocks={probab.blocks} /> : null}
          </div>
        ) : null}
        {rest.length ? <div style={ROW}>{rest.map((card, i) => <SectionCard key={`${card.title}-${i}`} card={card} />)}</div> : null}
      </div>
    );
  }

  // Rápido: Calificación con barras + el resto en grid.
  const calif = cards.find((card) => card.title.toLowerCase().includes("calificaci"));
  const rest = cards.filter((card) => card !== calif);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {calif ? <div style={ROW}><ScoreCard card={calif} /></div> : null}
      <div style={ROW}>{rest.map((card, i) => <SectionCard key={`${card.title}-${i}`} card={card} />)}</div>
    </div>
  );
}
