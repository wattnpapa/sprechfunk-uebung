import type { Nachricht } from "./Nachricht";

export interface Uebung {
  id: string;
  name: string;
  datum: Date;
  buildVersion: string;
  leitung: string;
  rufgruppe: string;
  teilnehmerListe: string[];
  nachrichten: Record<string, Nachricht[]>;
  createDate: Date;
}