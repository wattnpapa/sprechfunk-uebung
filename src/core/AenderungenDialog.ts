import type { Aenderung } from "./aenderungen";

/**
 * „Was ist neu“: zeigt den Änderungsverlauf (aenderungen.ts) im Bootstrap-Dialog
 * `#aenderungenModal`, den die Versionsnummer in der Fußzeile öffnet. Ein Monat
 * je Seite, neuester zuerst, mit einem zusammenfassenden Satz über den Tagen.
 *
 * Die Liste kommt erst beim ersten Öffnen per dynamischem Import, damit sie das
 * Startpaket nicht vergrößert.
 */

export interface AenderungenDaten {
    liste: readonly Aenderung[];
    monate: Readonly<Record<string, string>>;
}

type ElementBauer = <K extends keyof HTMLElementTagNameMap>(
    tag: K, klasse: string, text?: string
) => HTMLElementTagNameMap[K];

const MONATSNAMEN = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
];

/** „November 2026“ aus „2026-11“. */
export function monatsName(schluessel: string): string {
    const [jahr, monat] = schluessel.split("-");
    return `${MONATSNAMEN[Number(monat) - 1] ?? monat} ${jahr}`;
}

/** „25.11.2026“ aus „2026-11-25“. */
export function tagText(isoDatum: string): string {
    return isoDatum.split("-").reverse().join(".");
}

async function ladeAenderungen(): Promise<AenderungenDaten> {
    const modul = await import("./aenderungen");
    return { liste: modul.AENDERUNGEN, monate: modul.MONATE };
}

export class AenderungenDialog {
    private daten: AenderungenDaten | null = null;
    private seite = 0;
    private inhalt: HTMLElement | null = null;

    constructor(private readonly laden: () => Promise<AenderungenDaten> = ladeAenderungen) {}

    /** Hängt sich an den Dialog; ohne Dialog (Tests, fremde Seiten) passiert nichts. */
    public init(modal: HTMLElement | null): void {
        this.inhalt = modal?.querySelector<HTMLElement>("#aenderungenInhalt") ?? null;
        if (!modal || !this.inhalt) {
            return;
        }
        modal.addEventListener("show.bs.modal", () => {
            void this.oeffnen();
        });
    }

    /** Lädt die Liste beim ersten Mal und zeigt den neuesten Monat. */
    public async oeffnen(): Promise<void> {
        if (!this.inhalt) {
            return;
        }
        this.seite = 0;
        if (!this.daten) {
            try {
                this.daten = await this.laden();
            } catch {
                this.inhalt.textContent =
                    "Der Änderungsverlauf ließ sich nicht laden. Prüfe die Verbindung und öffne den Dialog erneut.";
                return;
            }
        }
        this.zeichne();
    }

    private blaettere(seite: number): void {
        this.seite = seite;
        this.zeichne();
        if (this.inhalt) {
            this.inhalt.scrollTop = 0;
        }
    }

    private zeichne(): void {
        const inhalt = this.inhalt;
        const daten = this.daten;
        if (!inhalt || !daten) {
            return;
        }
        const doc = inhalt.ownerDocument;
        const monate = [...new Set(daten.liste.map(a => a.datum.slice(0, 7)))];
        const monat = monate[this.seite];
        inhalt.replaceChildren();
        if (!monat) {
            inhalt.textContent = "Noch keine Einträge.";
            return;
        }

        const element: ElementBauer = (tag, klasse, text) => {
            const el = doc.createElement(tag);
            if (klasse) {
                el.className = klasse;
            }
            if (text !== undefined) {
                el.textContent = text;
            }
            return el;
        };

        if (monate.length > 1) {
            inhalt.append(this.leiste(element, monate.length));
        }
        inhalt.append(element("h3", "aenderungen-monat", monatsName(monat)));
        const kurz = daten.monate[monat];
        if (kurz) {
            inhalt.append(element("p", "aenderungen-kurz", kurz));
        }
        for (const eintrag of daten.liste.filter(a => a.datum.startsWith(monat))) {
            const abschnitt = element("section", "aenderung");
            abschnitt.append(element("h4", "aenderung-tag", tagText(eintrag.datum)));
            const liste = element("ul", "aenderung-punkte");
            for (const punkt of eintrag.punkte) {
                liste.append(element("li", "", punkt));
            }
            abschnitt.append(liste);
            inhalt.append(abschnitt);
        }
    }

    private leiste(element: ElementBauer, anzahl: number): HTMLElement {
        const nav = element("nav", "aenderungen-blaettern");
        nav.setAttribute("aria-label", "Monate blättern");
        const knopf = (text: string, ziel: number, gesperrt: boolean): HTMLButtonElement => {
            const b = element("button", "btn btn-sm btn-outline-secondary", text);
            b.type = "button";
            b.disabled = gesperrt;
            b.addEventListener("click", () => this.blaettere(ziel));
            return b;
        };
        const stand = element("span", "aenderungen-seite", `${this.seite + 1} von ${anzahl}`);
        stand.setAttribute("aria-live", "polite");
        nav.append(
            knopf("← Neuer", this.seite - 1, this.seite === 0),
            stand,
            knopf("Älter →", this.seite + 1, this.seite >= anzahl - 1)
        );
        return nav;
    }
}
