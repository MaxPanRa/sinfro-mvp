import {
  Mail, MessageCircle, Sparkles, Brain, Gem, Terminal, Search, Bot,
  Briefcase, Globe, KeyRound, type LucideIcon,
} from "lucide-react";

// Lucide no trae logos de marca, así que usamos íconos semánticos/genéricos.
const PROVIDER_ICONS: Record<string, LucideIcon> = {
  gmail: Mail,
  whatsapp: MessageCircle,
  openai: Sparkles,
  anthropic: Brain,
  gemini: Gem,
  "opencode-go": Terminal,
  serpapi: Search,
  apify: Bot,
  adzuna: Briefcase,
  jooble: Globe,
};

export function providerIcon(id: string): LucideIcon {
  return PROVIDER_ICONS[id] ?? KeyRound;
}
