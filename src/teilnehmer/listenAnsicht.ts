import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import { filtereNachrichten, nachrichtZeileHtml } from "./nachrichtenMarkup";
import {
    ABGANG_MS,
    HALTEN_MS,
    KONTEXT_SPERRE_MS,
    setzeChecked,
    suchtext,
    zeilenKontext,
    type NachrichtenOptionen
} from "./ansichtHelfer";

interface Aufruf {
    nachrichten: Nachricht[];
    storage: TeilnehmerStorage;
    optionen: NachrichtenOptionen;
}

/**
 * Die Spruchliste (Tabelle bzw. Karten am Handy).
 *
 * Bei „Abgesetzte ausblenden“ bleibt ein eben abgesetzter Spruch
 * {@link HALTEN_MS} stehen – als Karte mit Statusfeld an der Stelle des
 * Knopfs. Erst danach geht er ab; ab dann ist die Liste kurz gesperrt, weil
 * der nächste Spruch an seine Stelle rückt (stress-test P1-1, 2026-10-05).
 * Die Haltezeit hängt an der Uhr, nicht am Neuzeichnen: der Live-Sync darf
 * beliebig oft neu zeichnen, ohne die Karte vorzeitig zu entfernen.
 */
export class TeilnehmerListe {
    private readonly gehalten = new Map<number, number>();
    private gesperrtBis = 0;
    private haltTimer: ReturnType<typeof setTimeout> | null = null;
    private sperrTimer: ReturnType<typeof setTimeout> | null = null;
    private letzterAufruf: Aufruf | null = null;

    /** true, solange nach dem Abgang einer Zeile die Liste gesperrt ist. */
    public istGesperrt(jetzt = Date.now()): boolean {
        return jetzt < this.gesperrtBis;
    }

    /** IDs, die gerade trotz „ausblenden“ noch stehen. */
    public gehalteneIds(): number[] {
        return Array.from(this.gehalten.keys());
    }

    public render(nachrichten: Nachricht[], storage: TeilnehmerStorage, optionen: NachrichtenOptionen = {}, jetzt = Date.now()): void {
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (!tbody) {
            return;
        }
        // Fürs Neuzeichnen nach Ablauf der Haltezeit: ohne Quittung, die
        // gehört nur zum auslösenden Aufruf.
        const ohneQuittung: NachrichtenOptionen = { ...optionen };
        delete ohneQuittung.zuletztAbgesetzt;
        this.letzterAufruf = { nachrichten, storage, optionen: ohneQuittung };
        this.syncAusblendSchalter(nachrichten, storage);
        const abgang = this.aktualisiereHalten(storage, optionen.zuletztAbgesetzt, jetzt);

        const ctx = zeilenKontext(nachrichten, storage, optionen, { gehalten: new Set(this.gehalten.keys()), abgang });
        const rows = filtereNachrichten(nachrichten, ctx, suchtext()).map(n => nachrichtZeileHtml(n, ctx)).join("");
        const colspan = ctx.showXZeit ? "6" : "5";
        const leerZeile = `<tr><td colspan="${colspan}" class="text-center text-muted">Keine Nachrichten vorhanden.</td></tr>`;
        tbody.innerHTML = rows || leerZeile;

        if (abgang.size > 0) {
            this.sperre(tbody, jetzt + ABGANG_MS + KONTEXT_SPERRE_MS, jetzt);
            this.raeumeAbgangsZeilen(tbody, leerZeile);
        }
        tbody.classList.toggle("ist-gesperrt", this.istGesperrt(jetzt));
        this.planeHalten(jetzt);
    }

    /**
     * Pflegt die Haltezeiten und liefert die IDs, deren Zeit um ist. Ohne
     * „ausblenden“ oder nach dem Zurücknehmen gibt es nichts zu halten.
     */
    private aktualisiereHalten(storage: TeilnehmerStorage, neu: number | undefined, jetzt: number): Set<number> {
        if (!storage.hideTransmitted) {
            this.gehalten.clear();
            return new Set();
        }
        if (neu !== undefined) {
            this.gehalten.set(neu, jetzt + HALTEN_MS);
        }
        const abgang = new Set<number>();
        for (const [id, bis] of this.gehalten) {
            if (!storage.nachrichten[id]?.uebertragen) {
                this.gehalten.delete(id);
            } else if (bis <= jetzt) {
                this.gehalten.delete(id);
                abgang.add(id);
            }
        }
        return abgang;
    }

    /** Zeichnet neu, sobald die früheste Haltezeit abläuft. */
    private planeHalten(jetzt: number): void {
        if (this.haltTimer !== null) {
            clearTimeout(this.haltTimer);
            this.haltTimer = null;
        }
        if (this.gehalten.size === 0) {
            return;
        }
        const naechste = Math.min(...this.gehalten.values());
        this.haltTimer = globalThis.setTimeout(() => {
            this.haltTimer = null;
            const aufruf = this.letzterAufruf;
            if (aufruf) {
                this.render(aufruf.nachrichten, aufruf.storage, aufruf.optionen);
            }
        }, Math.max(0, naechste - jetzt));
    }

    /** Sperrt die Liste sichtbar bis `bis`. */
    private sperre(tbody: HTMLElement, bis: number, jetzt: number): void {
        this.gesperrtBis = Math.max(this.gesperrtBis, bis);
        if (this.sperrTimer !== null) {
            clearTimeout(this.sperrTimer);
        }
        this.sperrTimer = globalThis.setTimeout(() => {
            this.sperrTimer = null;
            tbody.classList.remove("ist-gesperrt");
        }, Math.max(0, this.gesperrtBis - jetzt));
    }

    /** Hält beide „Abgesetzte ausblenden“-Schalter und den Zähler synchron zum Speicher. */
    private syncAusblendSchalter(nachrichten: Nachricht[], storage: TeilnehmerStorage): void {
        setzeChecked("toggle-hide-transmitted", storage.hideTransmitted);
        setzeChecked("toggle-hide-transmitted-modal", storage.hideTransmitted);

        const ausgeblendetHinweis = document.getElementById("teilnehmerAusgeblendet");
        if (ausgeblendetHinweis) {
            const anzahl = storage.hideTransmitted
                ? nachrichten.filter(n => storage.nachrichten[n.id]?.uebertragen).length
                : 0;
            ausgeblendetHinweis.textContent = anzahl > 0 ? `(${anzahl} ausgeblendet)` : "";
        }
    }

    /**
     * Entfernt die abgehenden Zeilen, nachdem sie verblasst sind. Der Timer
     * ist die Quelle der Wahrheit, nicht das animationend-Ereignis: bei
     * prefers-reduced-motion läuft keine Animation, die Zeile muss trotzdem
     * verschwinden.
     */
    private raeumeAbgangsZeilen(tbody: HTMLElement, leerZeile: string): void {
        const zeilen = Array.from(tbody.querySelectorAll<HTMLElement>("tr[data-abgang]"));
        if (zeilen.length === 0) {
            return;
        }
        globalThis.setTimeout(() => {
            for (const zeile of zeilen) {
                if (!zeile.isConnected) {
                    continue;
                }
                const eigenesTbody = zeile.parentElement;
                zeile.remove();
                if (eigenesTbody && eigenesTbody.children.length === 0) {
                    eigenesTbody.innerHTML = leerZeile;
                }
            }
        }, ABGANG_MS);
    }
}
