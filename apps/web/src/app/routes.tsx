import { CreditCard, Inbox, KeyRound, RefreshCcw, Shield, Ticket, UserRound } from "lucide-react";
import type { ViewId } from "../types/theme";

export const routes: Array<{ id: ViewId; label: string; icon: typeof Inbox; adminOnly?: boolean }> = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "perfiles", label: "Perfiles", icon: UserRound },
  { id: "jobs", label: "Sync Runs", icon: RefreshCcw },
  { id: "settings", label: "Conexiones", icon: KeyRound },
  { id: "subscription", label: "Suscripcion", icon: CreditCard },
  { id: "admin_users", label: "Admin Usuarios", icon: Shield, adminOnly: true },
  { id: "admin_codes", label: "Admin Codigos", icon: Ticket, adminOnly: true },
];
