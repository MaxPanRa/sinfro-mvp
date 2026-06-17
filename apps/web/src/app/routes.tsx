import { Inbox, KeyRound, UserRound, RefreshCcw, CreditCard } from "lucide-react";
import type { ViewId } from "../types/theme";

export const routes: Array<{ id: ViewId; label: string; icon: typeof Inbox }> = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "perfiles", label: "Perfiles", icon: UserRound },
  { id: "jobs", label: "Sync Runs", icon: RefreshCcw },
  { id: "settings", label: "Conexiones", icon: KeyRound },
  { id: "subscription", label: "Suscripcion", icon: CreditCard },
];
