/**
 * Verzögertes Löschen in der Übungsverwaltung.
 *
 * Nach der Rückfrage verschwindet die Zeile sofort, gelöscht wird aber erst
 * nach {@link LOESCH_VERZOEGERUNG_MS}. Bis dahin holt „Rückgängig“ die Übung
 * zurück, ohne dass Firestore etwas davon merkt (THW-Review 2026-10-05,
 * error-recovery P2-2, destructive-action Abgleich P1-1). Ein Papierkorb in
 * Firestore bräuchte ein neues Feld samt Regeln; das verzögerte Löschen kommt
 * ohne aus.
 *
 * Es ist immer höchstens eine Löschung offen. Eine zweite schließt die erste
 * sofort ab, ebenso das Verlassen der Seite: Ein Löschauftrag soll nicht
 * still liegen bleiben.
 */

export const LOESCH_VERZOEGERUNG_MS = 8000;

export interface OffeneLoeschung {
    id: string;
    name: string;
}

export class LoeschPuffer {
    private offen: OffeneLoeschung | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly loesche: (eintrag: OffeneLoeschung) => Promise<void>,
        private readonly verzoegerungMs = LOESCH_VERZOEGERUNG_MS
    ) {}

    public get ausstehendeId(): string | null {
        return this.offen?.id ?? null;
    }

    /** Merkt die Löschung vor; eine schon offene wird vorher ausgeführt. */
    public async plane(eintrag: OffeneLoeschung): Promise<void> {
        await this.abschliessen();
        this.offen = eintrag;
        this.timer = setTimeout(() => {
            void this.abschliessen();
        }, this.verzoegerungMs);
    }

    /** Bricht die offene Löschung ab; liefert sie zurück, `null` wenn keine offen war. */
    public rueckgaengig(): OffeneLoeschung | null {
        const eintrag = this.offen;
        this.stoppe();
        return eintrag;
    }

    /** Führt die offene Löschung sofort aus. */
    public async abschliessen(): Promise<void> {
        const eintrag = this.offen;
        this.stoppe();
        if (eintrag) {
            await this.loesche(eintrag);
        }
    }

    private stoppe(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.offen = null;
    }
}
