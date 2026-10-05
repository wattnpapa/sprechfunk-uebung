import type { NachrichtenStatus, ReaktionBewertung } from "../types/Storage";
import type { AktionenHost } from "./aktionen";
import { statusKey } from "./lagebild";

/**
 * Entscheidungen der Leitung an einer Plan-Zeile, die über „abgesetzt“
 * hinausgehen: eine Einspielung bewusst auslassen (THW-Review 2026-10-05,
 * command P2-2) und die Reaktion der beübten Stelle bewerten (command P2-1).
 */
export class PlanAktionen {
    constructor(private host: AktionenHost) {}

    private stelleWiederHer(key: string, vorher: NachrichtenStatus | undefined): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        storage.nachrichten[key] = { ...(vorher ?? {}), statusGeaendertUm: new Date().toISOString() };
        this.host.save();
        this.host.renderNachrichten();
    }

    /** Auslassen geht nur bei nicht abgesetzten Zeilen, und nur, wenn sich etwas ändert. */
    private aenderbar(vorher: NachrichtenStatus | undefined, ausgelassen: boolean): boolean {
        if (Boolean(vorher?.ausgelassen) === ausgelassen) {
            return false;
        }
        return !(ausgelassen && vorher?.abgesetztUm);
    }

    private setzeAusgelassen(sender: string, nr: number, ausgelassen: boolean): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const vorher = storage.nachrichten[key] ? { ...storage.nachrichten[key] } : undefined;
        if (!this.aenderbar(vorher, ausgelassen)) {
            return;
        }
        this.host.schliesseRueckgaengig();
        const { ausgelassen: _alt, ...rest } = vorher ?? {};
        storage.nachrichten[key] = {
            ...rest,
            statusGeaendertUm: new Date().toISOString(),
            ...(ausgelassen ? { ausgelassen: true } : {})
        };
        this.host.save();
        this.host.renderNachrichten();
        const meldung = ausgelassen
            ? `${sender} Nr. ${nr} ausgelassen – zählt nicht mehr als überfällig.`
            : `${sender} Nr. ${nr} wieder offen.`;
        this.host.zeigeRueckgaengig(meldung, () => this.stelleWiederHer(key, vorher));
    }

    /** Bewusst nicht einspielen: zählt weder als offen noch als abgesetzt. */
    public auslassen(sender: string, nr: number): void {
        this.setzeAusgelassen(sender, nr, true);
    }

    public wiederOeffnen(sender: string, nr: number): void {
        this.setzeAusgelassen(sender, nr, false);
    }

    /** Setzt die Bewertung; ein zweiter Klick auf denselben Wert hebt sie auf. */
    public setzeReaktion(sender: string, nr: number, wert: ReaktionBewertung): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        this.host.schliesseRueckgaengig();
        const key = statusKey(sender, nr);
        const entry = storage.nachrichten[key] || {};
        if (entry.reaktion === wert) {
            delete entry.reaktion;
        } else {
            entry.reaktion = wert;
        }
        entry.reaktionGeaendertUm = new Date().toISOString();
        storage.nachrichten[key] = entry;
        this.host.save();
        this.host.renderNachrichten();
    }
}
