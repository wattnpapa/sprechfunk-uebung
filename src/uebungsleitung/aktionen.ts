import type { FunkUebung } from "../models/FunkUebung";
import type { NachrichtenStatus, TeilnehmerStatus, UebungsleitungStorage } from "../types/Storage";
import { uiFeedback } from "../core/UiFeedback";
import type { EffektiverStatus } from "./auswertung";
import { anmeldeNachrichtKey, statusKey, uhrzeitZuIso } from "./lagebild";

/**
 * Nach „als abgesetzt markieren“ bleibt die Rücknahme dieser Zeile so lange
 * gesperrt – ein Doppeltipp darf die Markierung nicht still wieder aufheben.
 */
export const RUECKNAHME_SPERRE_MS = 1500;

/** Was die Aktionen vom Controller brauchen; Zustand wird bei jedem Aufruf frisch gelesen. */
export interface AktionenHost {
    storage(): UebungsleitungStorage | null;
    uebung(): FunkUebung | null;
    effektiverStatus(): EffektiverStatus;
    save(): void;
    debouncedSave(): void;
    renderTeilnehmer(): void;
    renderNachrichten(): void;
    zeigeRueckgaengig(meldung: string, onUndo: () => void): void;
    /**
     * Schließt eine noch stehende Rückgängig-Leiste: Sie bezöge sich nach einer
     * neuen Aktion auf die ältere (THW-Review 2026-10-05, error-recovery P3-2).
     */
    schliesseRueckgaengig(): void;
}

/**
 * Bedienhandlungen der Übungsleitung an Teilnehmern und Nachrichten. Jede
 * Änderung trägt einen Zeitstempel, damit der Live-Sync-Merge sie gewinnt.
 */
export class LeitungAktionen {
    /** Zeilen, deren Rücknahme nach dem Markieren kurz gesperrt ist (Key → bis). */
    private ruecknahmeGesperrtBis = new Map<string, number>();

    constructor(private host: AktionenHost) {}

    /** Gerade gesperrte Zeilen; abgelaufene Sperren werden dabei entfernt. */
    public gesperrteRuecknahmen(nowMs: number): Set<string> {
        const gesperrt = new Set<string>();
        this.ruecknahmeGesperrtBis.forEach((bis, key) => {
            if (bis > nowMs) {
                gesperrt.add(key);
            } else {
                this.ruecknahmeGesperrtBis.delete(key);
            }
        });
        return gesperrt;
    }

    private sperreRuecknahme(key: string): void {
        this.ruecknahmeGesperrtBis.set(key, Date.now() + RUECKNAHME_SPERRE_MS);
        // Nach Ablauf neu zeichnen, damit „zurücknehmen“ erscheint.
        setTimeout(() => this.host.renderNachrichten(), RUECKNAHME_SPERRE_MS + 50);
    }

    private istRuecknahmeGesperrt(key: string): boolean {
        return (this.ruecknahmeGesperrtBis.get(key) ?? 0) > Date.now();
    }

    private speichernUndZeichnen(teilnehmer: boolean): void {
        this.host.save();
        if (teilnehmer) {
            this.host.renderTeilnehmer();
        }
        this.host.renderNachrichten();
    }

    /** Holt den Teilnehmer-Eintrag und stempelt ihn für den Live-Sync-Merge. */
    private touchTeilnehmer(name: string): TeilnehmerStatus | null {
        const storage = this.host.storage();
        if (!storage) {
            return null;
        }
        const entry = storage.teilnehmer[name] || {};
        entry.geaendertUm = new Date().toISOString();
        storage.teilnehmer[name] = entry;
        return entry;
    }

    private anmeldeKey(name: string): string | null {
        const uebung = this.host.uebung();
        return uebung ? anmeldeNachrichtKey(uebung, name) : null;
    }

    /**
     * Ist `key` der Anmelde-Funkspruch, gilt der Teilnehmer ab `um` als
     * angemeldet – sofern er es noch nicht ist. Eine Zeitkorrektur von Hand
     * (`korrektur`) zieht die Anmeldezeit immer mit: Anmeldung und
     * Anmelde-Funkspruch sind ein Vorgang (THW-Review 2026-10-05, analog P2-1).
     */
    private meldeMitFunkspruchAn(storage: UebungsleitungStorage, ziel: { sender: string; key: string }, um: string, korrektur = false): void {
        const { sender, key } = ziel;
        if (key !== this.anmeldeKey(sender) || (!korrektur && storage.teilnehmer[sender]?.angemeldetUm)) {
            return;
        }
        const teilnehmer = this.touchTeilnehmer(sender);
        if (teilnehmer) {
            teilnehmer.angemeldetUm = um;
        }
        this.host.renderTeilnehmer();
    }

    private loescheAbgesetzt(key: string): void {
        const entry = this.host.storage()?.nachrichten[key];
        if (entry) {
            delete entry.abgesetztUm;
            delete entry.nachgetragen;
            // Zeitstempel bleibt gesetzt, damit das Zurücksetzen den Merge gewinnt.
            entry.statusGeaendertUm = new Date().toISOString();
        }
    }

    /**
     * „Anmeldung erhalten“ und der Anmelde-Funkspruch sind ein Vorgang: Wer
     * angemeldet wird, dessen Anmelde-Funkspruch gilt als abgesetzt.
     */
    public markAngemeldet(name: string): void {
        this.host.schliesseRueckgaengig();
        const entry = this.touchTeilnehmer(name);
        const storage = this.host.storage();
        if (!entry || !storage) {
            return;
        }
        const jetzt = new Date().toISOString();
        entry.angemeldetUm = jetzt;
        const key = this.anmeldeKey(name);
        if (key && !storage.nachrichten[key]?.abgesetztUm) {
            const status = storage.nachrichten[key] || {};
            status.abgesetztUm = jetzt;
            status.statusGeaendertUm = jetzt;
            delete status.nachgetragen;
            storage.nachrichten[key] = status;
            this.sperreRuecknahme(key);
        }
        this.speichernUndZeichnen(true);
    }

    /**
     * Nimmt eine versehentlich gesetzte Anmeldung zurück – samt der Bestätigung
     * des Anmelde-Funkspruchs – und bietet ein Rückgängig an.
     */
    public anmeldungZuruecknehmen(name: string): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        this.host.schliesseRueckgaengig();
        const key = this.anmeldeKey(name);
        const vorherTeilnehmer: TeilnehmerStatus = { ...(storage.teilnehmer[name] ?? {}) };
        const vorherNachricht: NachrichtenStatus | undefined = key && storage.nachrichten[key]
            ? { ...storage.nachrichten[key] }
            : undefined;
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        delete entry.angemeldetUm;
        if (key) {
            this.loescheAbgesetzt(key);
        }
        this.speichernUndZeichnen(true);
        this.host.zeigeRueckgaengig(`Anmeldung von ${name} zurückgenommen.`, () => {
            const aktuell = this.host.storage();
            if (!aktuell) {
                return;
            }
            const jetzt = new Date().toISOString();
            aktuell.teilnehmer[name] = { ...vorherTeilnehmer, geaendertUm: jetzt };
            if (key && vorherNachricht) {
                aktuell.nachrichten[key] = { ...vorherNachricht, statusGeaendertUm: jetzt };
            }
            this.speichernUndZeichnen(true);
        });
    }

    public updateLoesungswort(name: string, val: string): void {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.loesungswortGesendet = val;
        this.host.debouncedSave();
    }

    public updateStaerke(name: string, idx: number, val: string): void {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.teilstaerken = entry.teilstaerken || [];
        entry.teilstaerken[idx] = val;
        this.host.debouncedSave();
    }

    public updateNotiz(name: string, val: string): void {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.notizen = val;
        this.host.debouncedSave();
    }

    public markNachrichtAbgesetzt(sender: string, nr: number): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const entry = storage.nachrichten[key] || {};
        if (entry.abgesetztUm) {
            // Doppelklick: schon abgesetzt, nichts umschalten.
            return;
        }
        this.host.schliesseRueckgaengig();
        const now = new Date().toISOString();
        entry.abgesetztUm = now;
        entry.statusGeaendertUm = now;
        delete entry.nachgetragen;
        delete entry.zeitVomTeilnehmer;
        delete entry.ausgelassen;
        storage.nachrichten[key] = entry;
        this.sperreRuecknahme(key);
        this.meldeMitFunkspruchAn(storage, { sender, key }, now);
        this.speichernUndZeichnen(false);
    }

    /** Hebt mit dem Anmelde-Funkspruch auch die Anmeldung auf bzw. stellt sie wieder her. */
    private setzeAngemeldet(sender: string, um: string | undefined): void {
        const teilnehmer = this.touchTeilnehmer(sender);
        if (teilnehmer) {
            if (um) {
                teilnehmer.angemeldetUm = um;
            } else {
                delete teilnehmer.angemeldetUm;
            }
        }
        this.host.renderTeilnehmer();
    }

    /**
     * Nimmt „abgesetzt“ zurück. Gesperrt direkt nach dem Markieren; danach mit
     * Rückgängig, das den ursprünglichen Zeitpunkt wiederherstellt.
     */
    public resetNachricht(sender: string, nr: number): void {
        const storage = this.host.storage();
        const key = statusKey(sender, nr);
        if (!storage || this.istRuecknahmeGesperrt(key)) {
            return;
        }
        this.host.schliesseRueckgaengig();
        const vorher: NachrichtenStatus | undefined = storage.nachrichten[key]
            ? { ...storage.nachrichten[key] }
            : undefined;
        this.loescheAbgesetzt(key);
        const vorherAngemeldet = key === this.anmeldeKey(sender) ? storage.teilnehmer[sender]?.angemeldetUm : undefined;
        if (vorherAngemeldet) {
            this.setzeAngemeldet(sender, undefined);
        }
        this.speichernUndZeichnen(false);
        if (!vorher?.abgesetztUm) {
            return;
        }
        this.host.zeigeRueckgaengig(`„Abgesetzt“ für ${sender} Nr. ${nr} zurückgenommen.`, () => {
            const aktuell = this.host.storage();
            if (!aktuell) {
                return;
            }
            aktuell.nachrichten[key] = { ...aktuell.nachrichten[key], ...vorher, statusGeaendertUm: new Date().toISOString() };
            if (vorherAngemeldet) {
                this.setzeAngemeldet(sender, vorherAngemeldet);
            }
            this.speichernUndZeichnen(false);
        });
    }

    /**
     * Papier-Nachtrag: setzt bzw. korrigiert die Absetzzeit von Hand (HH:MM).
     * Solche Zeiten sind gekennzeichnet und zählen nicht fürs Tempo.
     */
    public zeitNachtragen(sender: string, nr: number, hhmm: string): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const entry = storage.nachrichten[key] || {};
        const datum = this.host.uebung()?.datum;
        const iso = uhrzeitZuIso(hhmm, entry.abgesetztUm, new Date(), {
            ...(datum ? { uebungsDatum: new Date(datum) } : {}),
            ...(storage.xZeitBasis ? { basis: storage.xZeitBasis } : {})
        });
        if (!iso) {
            uiFeedback.error("Bitte die Uhrzeit als HH:MM eintragen, z. B. 19:05.");
            return;
        }
        this.host.schliesseRueckgaengig();
        entry.abgesetztUm = iso;
        entry.nachgetragen = true;
        delete entry.zeitVomTeilnehmer;
        delete entry.ausgelassen;
        entry.statusGeaendertUm = new Date().toISOString();
        storage.nachrichten[key] = entry;
        this.meldeMitFunkspruchAn(storage, { sender, key }, iso, true);
        this.speichernUndZeichnen(false);
    }

    /**
     * Übernimmt alle vom Teilnehmer gemeldeten, noch unbestätigten Nachrichten
     * mit dem Zeitpunkt der Teilnehmer-Meldung. Diese Zeit ist eine Tippzeit
     * und wird so gekennzeichnet (THW-Review 2026-10-05, analog P3-1).
     */
    public gemeldeteBestaetigen(): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        this.host.schliesseRueckgaengig();
        const jetzt = new Date().toISOString();
        let anzahl = 0;
        Object.entries(this.host.effektiverStatus()).forEach(([key, status]) => {
            if (!status.gemeldetUm || status.abgesetztUm) {
                return;
            }
            const entry = storage.nachrichten[key] || {};
            entry.abgesetztUm = status.gemeldetUm;
            entry.statusGeaendertUm = jetzt;
            entry.zeitVomTeilnehmer = true;
            delete entry.nachgetragen;
            delete entry.ausgelassen;
            storage.nachrichten[key] = entry;
            anzahl++;
        });
        if (!anzahl) {
            return;
        }
        this.speichernUndZeichnen(true);
        uiFeedback.success(`${anzahl} gemeldete Nachricht${anzahl === 1 ? "" : "en"} bestätigt – mit der Meldezeit des Teilnehmers. Papierzeiten trägst du über „Zeit ändern“ nach.`);
    }

    public persistNachrichtNotiz(sender: string, nr: number, val: string): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const entry = storage.nachrichten[key] || {};
        entry.notiz = val;
        entry.notizGeaendertUm = new Date().toISOString();
        storage.nachrichten[key] = entry;
        this.host.debouncedSave();
    }
}
