import { Uebung } from "../types/Uebung";
import { escapeHtml } from "../utils/html";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";
import type { LeitungBestaetigung, LiveSyncState } from "../types/LiveStatus";
import { formatCountdown, parseHHMMtoMs } from "../utils/xzeit";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";

interface PdfPage {
    getViewport: (options: { scale: number; rotation?: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
    rotate?: number;
}

interface PdfJsModule {
    getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<{ getPage: (n: number) => Promise<PdfPage> }> };
    GlobalWorkerOptions: { workerSrc: string };
}

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = async (): Promise<PdfJsModule> => {
    if (!pdfJsPromise) {
        const pdfUrl = new URL("pdfjs/pdf.min.js", import.meta.url).toString();
        const workerUrl = new URL("pdfjs/pdf.worker.min.js", import.meta.url).toString();
        pdfJsPromise = import(/* @vite-ignore */ pdfUrl).then(mod => {
            const pdf = mod as PdfJsModule;
            pdf.GlobalWorkerOptions.workerSrc = workerUrl;
            return pdf;
        }).catch((err: unknown) => {
            // Ein Fehlschlag (z. B. kurz kein Netz) darf nicht bis zum
            // Neuladen haften bleiben: beim nächsten Blättern neu versuchen.
            pdfJsPromise = null;
            throw err;
        });
    }
    return pdfJsPromise;
};

/** Platzhalter im Vordruck-Fenster, wenn die Vorschau nicht gezeichnet werden kann. */
const VORSCHAU_FEHLER_ID = "teilnehmerPdfFehler";

/**
 * Standzeit der abgehenden Zeile: Verzug (380 ms) plus Dauer (--takt-kurz,
 * 180 ms) der Abgangsanimation aus Abschnitt 10.2 der CSS, aufgerundet.
 */
const ABGANG_MS = 600;

/**
 * Tippsperre nach einem Statuswechsel. Ein Doppeltipp liegt bei 100–300 ms
 * (gemessen im THW-Review 2026-10-04); eine Sekunde fängt auch Handschuh-
 * und Wackeltipps ab, ohne beim Abhaken des nächsten Spruchs zu bremsen.
 */
export const STATUS_SPERRE_MS = 1000;

/** So lange bleibt der Rückgängig-Hinweis nach einem Statuswechsel stehen. */
export const RUECKGAENGIG_MS = 8000;

/** Aktion, die eine Statusschaltfläche auslöst. */
type StatusAktion = "absetzen" | "zuruecknehmen";

/** Kopfzeile ohne doppeltes „Sprechfunkübung: Sprechfunkübung …“. */
export function teilnehmerTitel(name: string | undefined): string {
    const n = (name || "").trim() || "–";
    return /übung/i.test(n) ? n : `Sprechfunkübung: ${n}`;
}

/** Datum für Menschen (TT.MM.JJJJ) statt Datum-Zeit-Gruppe. */
function formatDatumKurz(datum: Date | string | undefined): string {
    if (!datum) {
        return "–";
    }
    const d = datum instanceof Date ? datum : new Date(datum);
    if (Number.isNaN(d.getTime())) {
        return "–";
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Uhrzeit HH:MM eines ISO-Zeitstempels, leer bei fehlendem/ungültigem Wert. */
function formatUhrzeit(iso: string | undefined): string {
    if (!iso) {
        return "";
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Eingabetypen, bei denen Tastendrücke keine Texteingabe sind (Space toggelt dort z. B. nur).
const NON_TEXT_INPUT_TYPES = new Set([
    "checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"
]);

/** Anzeigezustand der Fokus-Karte im getakteten Modus. */
interface FokusZustand {
    kind: "keineBasis" | "fertig" | "faellig" | "warten";
    aktuelle?: Nachricht & { xZeitSlot: number };
    weitereFaellig: number;
    offen: number;
    countdownMs: number;
    /** Zuletzt abgesetzte Meldung, damit sie sich zurücknehmen lässt. */
    zuletztAbgesetzt?: number;
}

export class TeilnehmerView {
    /** Merker, um die Fokus-Karte nur bei Zustandswechseln neu zu rendern. */
    private lastFokusSignature = "";
    /** Zeitpunkt des letzten Statuswechsels je Nachricht (Tippsperre). */
    private letzteAenderung = new Map<number, number>();
    /**
     * Zeitpunkt des letzten Statuswechsels überhaupt. Fokus-Karte und
     * Vordruck wechseln danach auf den nächsten Spruch — ein zweiter Tipp
     * dort träfe sonst einen anderen Spruch.
     */
    private letzteKontextAenderung = 0;
    private rueckgaengigTimer: ReturnType<typeof setTimeout> | null = null;
    private rueckgaengigSeit = 0;
    private rueckgaengigAktion: (() => void) | null = null;

    /** true, wenn für diese Nachricht gerade die Tippsperre läuft. */
    public istGesperrt(id: number, jetzt = Date.now()): boolean {
        const zuletzt = this.letzteAenderung.get(id);
        return zuletzt !== undefined && jetzt - zuletzt < STATUS_SPERRE_MS;
    }

    /** true, solange nach irgendeinem Statuswechsel die Kontextsperre läuft. */
    public istKontextGesperrt(jetzt = Date.now()): boolean {
        return jetzt - this.letzteKontextAenderung < STATUS_SPERRE_MS;
    }

    /**
     * Merkt einen Statuswechsel für die Tippsperre. `kontext` sperrt zusätzlich
     * Fokus-Karte und Vordruck, die danach auf einen anderen Spruch springen;
     * in der Liste bleibt jeder Spruch an seinem Platz, dort genügt die Sperre
     * je Nachricht.
     */
    public merkeAenderung(id: number, kontext = true, jetzt = Date.now()): void {
        this.letzteAenderung.set(id, jetzt);
        if (kontext) {
            this.letzteKontextAenderung = jetzt;
        }
    }

    private isTypingTarget(target: HTMLElement | null): boolean {
        if (!target) {
            return false;
        }
        if (target.isContentEditable) {
            return true;
        }
        if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
            return true;
        }
        if (target.tagName !== "INPUT") {
            return false;
        }
        const type = (target as HTMLInputElement).type?.toLowerCase() || "text";
        return !NON_TEXT_INPUT_TYPES.has(type);
    }

    public renderJoinForm(prefilledUebungCode = "", prefilledTeilnehmerCode = "", hinweis = ""): void {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }
        // Codes sind Großbuchstaben und Ziffern: Großschreib-Tastatur, keine
        // Autokorrektur, die aus "MNTA" ein Wort macht.
        const codeAttrs = "autocapitalize=\"characters\" autocorrect=\"off\" autocomplete=\"off\" spellcheck=\"false\"";
        container.innerHTML = `
            <div class="card mb-4 teilnehmer-zugang">
                <div class="card-header">
                    <h3 class="card-title mb-0">Teilnehmer-Zugang</h3>
                </div>
                <div class="card-body">
                    <p class="text-muted mb-3" id="teilnehmerJoinHinweis">${hinweis ? escapeHtml(hinweis) : "Gib Übungscode und Teilnehmercode ein. Beide stehen in der Nachricht oder auf dem Zettel der Übungsleitung."}</p>
                    <p id="teilnehmerJoinError" class="alert alert-danger mb-3 d-none" role="alert"></p>
                    <form id="teilnehmerJoinForm" class="row g-3" autocomplete="off">
                        <div class="col-md-6">
                            <label class="form-label" for="joinUebungCode">Übungscode (6 Zeichen)</label>
                            <input class="form-control form-control-lg text-uppercase" id="joinUebungCode" maxlength="6" placeholder="z. B. K7M4Q2" ${codeAttrs} value="${escapeHtml(prefilledUebungCode)}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="joinTeilnehmerCode">Teilnehmercode (4 Zeichen)</label>
                            <input class="form-control form-control-lg text-uppercase" id="joinTeilnehmerCode" maxlength="4" placeholder="z. B. 9F3K" ${codeAttrs} value="${escapeHtml(prefilledTeilnehmerCode)}">
                        </div>
                        <div class="col-12">
                            <button type="submit" class="btn btn-primary btn-lg teilnehmer-zugang-knopf" id="joinSubmitBtn">
                                <i class="fas fa-right-to-bracket"></i> Zugang öffnen
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    /**
     * Fehlerseite mit Ausweg: statt einer Sackgasse steht das Code-Formular
     * mit der Meldung darüber, vorbelegt mit dem, was schon bekannt ist.
     */
    public renderZugangsFehler(meldung: string, uebungCode = "", teilnehmerCode = ""): void {
        this.renderJoinForm(uebungCode, teilnehmerCode,
            "Prüfe die Codes und öffne den Zugang neu. Die Ziffer 0 und der Buchstabe O sowie 1 und I werden leicht verwechselt. Klappt es nicht, frag die Übungsleitung nach deinen Codes.");
        this.showJoinError(meldung);
    }

    public bindJoinForm(onSubmit: (uebungCode: string, teilnehmerCode: string) => void): void {
        const form = document.getElementById("teilnehmerJoinForm") as HTMLFormElement | null;
        if (!form) {
            return;
        }
        const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const uebungInput = document.getElementById("joinUebungCode") as HTMLInputElement | null;
        const teilnehmerInput = document.getElementById("joinTeilnehmerCode") as HTMLInputElement | null;

        const applySanitize = (input: HTMLInputElement | null) => {
            if (!input) {
                return;
            }
            input.addEventListener("input", () => {
                input.value = sanitize(input.value);
            });
        };
        applySanitize(uebungInput);
        applySanitize(teilnehmerInput);

        form.addEventListener("submit", event => {
            event.preventDefault();
            onSubmit(
                sanitize(uebungInput?.value || ""),
                sanitize(teilnehmerInput?.value || "")
            );
        });
    }

    public showJoinError(message: string): void {
        const errorEl = document.getElementById("teilnehmerJoinError");
        if (!errorEl) {
            return;
        }
        errorEl.textContent = message;
        errorEl.classList.remove("d-none");
    }

    public renderHeader(uebung: Uebung, teilnehmer: string) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }

        const safeName = escapeHtml(teilnehmerTitel(uebung.name));
        const safeTeilnehmer = escapeHtml(teilnehmer);
        const safeDatum = escapeHtml(formatDatumKurz(uebung.datum));
        const safeRufgruppe = escapeHtml(uebung.rufgruppe || "–");
        const safeLeitung = escapeHtml(uebung.leitung || "–");

        // Kompakter Kopf: auf dem Handy soll der erste Spruch ohne Scrollen
        // sichtbar sein. Seltene Aktionen (ZIP, Zurücksetzen) stehen am Ende.
        const headerHtml = `
            <div class="card mb-3 teilnehmer-kopf">
                <div class="card-body">
                    <div class="teilnehmer-kopf-zeile">
                        <h3 class="card-title mb-0">${safeName}</h3>
                        <span id="teilnehmerLiveSyncBadge" class="badge bg-secondary" aria-live="polite" title="Verbindung zur Übungsleitung">Sync: –</span>
                    </div>
                    <dl class="teilnehmer-kopf-daten">
                        <div><dt>Ich</dt><dd>${safeTeilnehmer}</dd></div>
                        <div><dt>Rufgruppe</dt><dd>${safeRufgruppe}</dd></div>
                        <div><dt>Übungsleitung</dt><dd>${safeLeitung}</dd></div>
                        <div class="teilnehmer-kopf-datum"><dt>Datum</dt><dd>${safeDatum}</dd></div>
                    </dl>
                </div>
            </div>

            <div class="teilnehmer-werkzeug mb-2">
                <h4 class="mb-0">Meine Funksprüche</h4>
                <div class="btn-group teilnehmer-ansicht" role="group" aria-label="Ansicht wählen">
                    <button class="btn btn-outline-primary active" type="button" data-doc-view="table">Liste</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="meldevordruck">Meldevordruck</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="nachrichtenvordruck">Nachrichtenvordruck</button>
                </div>
                <div class="form-check form-switch teilnehmer-schalter">
                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted">
                    <label class="form-check-label" for="toggle-hide-transmitted">Abgesetzte ausblenden <span id="teilnehmerAusgeblendet" class="text-muted small"></span></label>
                </div>
            </div>
            <div class="mb-2">
                <input type="search" class="form-control form-control-sm" id="teilnehmerSearchInput" placeholder="Nachrichten filtern (Nr, Empfänger, Text)">
            </div>

            ${uebung.spielModus === "xZeit" ? `
            <div class="card mb-2" id="xZeitBanner">
                <div class="card-body py-2">
                    <div class="d-flex flex-wrap align-items-center gap-3">
                        <strong class="text-nowrap">X-Zeit:</strong>
                        <input type="time" class="form-control form-control-sm" id="xZeitBasisInput" style="width:130px;">
                        <button class="btn btn-sm btn-outline-primary" id="btn-xzeit-jetzt" type="button">Jetzt starten</button>
                        <span id="xZeitCountdown" class="text-muted small ms-2"></span>
                        <div class="form-check form-switch ms-auto" title="Zeigt nur die aktuell fällige Meldung mit Countdown – künftige Meldungen bleiben verborgen.">
                            <input class="form-check-input" type="checkbox" id="toggle-fokus-modus">
                            <label class="form-check-label" for="toggle-fokus-modus">Fokus-Modus</label>
                        </div>
                    </div>
                </div>
            </div>
            <div id="teilnehmerFokusCard" class="d-none" data-testid="teilnehmer-fokus-card"></div>` : ""}

            <div id="teilnehmerTableView" class="table-responsive teilnehmer-liste">
                <table class="table table-hover align-middle">
                    <thead class="table-light" id="teilnehmerTableHead">
                        <tr>
                            <th>Nr.</th>
                            <th>Empfänger</th>
                            <th>Nachricht</th>
                            ${uebung.spielModus === "xZeit" ? "<th style=\"width: 90px;\">X-Zeit</th>" : ""}
                            <th style="width: 210px;">Status</th>
                            <th style="width: 120px;">Leitung</th>
                        </tr>
                    </thead>
                    <tbody id="teilnehmerNachrichtenBody"></tbody>
                </table>
            </div>

            <section class="card mt-4 teilnehmer-unterlagen" aria-labelledby="teilnehmerUnterlagenTitel">
                <div class="card-body">
                    <h4 class="h6" id="teilnehmerUnterlagenTitel">Unterlagen für den Notfall</h4>
                    <p class="small text-muted mb-2">Alle deine Vordrucke als ZIP-Datei. Lade sie vor der Übung herunter oder druck sie aus – fällt am Übungsort das Netz weg, hast du sie trotzdem.</p>
                    <button class="btn btn-outline-primary" id="btn-download-teilnehmer-zip" type="button">
                        <i class="fas fa-file-archive"></i> Alle meine Vordrucke herunterladen (ZIP)
                    </button>
                </div>
            </section>

            <details class="mt-4 teilnehmer-gefahr" id="teilnehmerGefahrBereich">
                <summary>Abhak-Stand komplett zurücksetzen</summary>
                <div class="teilnehmer-gefahr-inhalt">
                    <p class="small mb-2" id="teilnehmerResetHinweis">Setzt alle als abgesetzt markierten Funksprüche wieder auf „offen“. Einen einzelnen falsch markierten Spruch korrigierst du mit „Zurücknehmen“ in seiner Zeile.</p>
                    <button class="btn btn-outline-danger" id="btn-reset-teilnehmer-data" type="button">
                        <i class="fas fa-undo"></i> <span id="teilnehmerResetLabel">Abhak-Stand zurücksetzen</span>
                    </button>
                </div>
            </details>

            <div id="teilnehmerRueckgaengig" class="teilnehmer-rueckgaengig" role="status" aria-live="polite" hidden>
                <span id="teilnehmerRueckgaengigText"></span>
                <button type="button" class="btn btn-light" id="btn-teilnehmer-rueckgaengig">Rückgängig</button>
            </div>

            <div class="modal fade teilnehmer-doc-modal" id="teilnehmerDocModal" tabindex="-1" aria-hidden="true" aria-labelledby="teilnehmerDocTitel">
                <div class="modal-dialog modal-dialog-centered modal-xl modal-fullscreen-md-down">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="teilnehmerDocTitel">Vordruck</h5>
                            <button type="button" class="btn btn-outline-secondary teilnehmer-doc-schliessen" id="btn-doc-close" aria-label="Vordruck schließen">
                                <i class="fas fa-xmark"></i> Schließen
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="teilnehmer-doc-layout">
                                <div class="teilnehmer-doc-center">
                                    <div id="teilnehmerPdfView" class="teilnehmer-doc-container">
                                        <canvas id="teilnehmerPdfCanvas" class="teilnehmer-doc-canvas"></canvas>
                                    </div>
                                    <span id="teilnehmerDocPage" class="text-muted teilnehmer-doc-page" aria-live="polite"></span>
                                </div>
                                <div class="teilnehmer-doc-legend" aria-label="Tastenkürzel">
                                    <div><span class="badge bg-light text-dark">←/→</span> <span class="small text-muted">Blättern</span></div>
                                    <div><span class="badge bg-light text-dark">Leertaste</span> <span class="small text-muted">Abgesetzt / zurücknehmen</span></div>
                                    <div><span class="badge bg-light text-dark">Ü</span> <span class="small text-muted">Abgesetzte ausblenden</span></div>
                                    <div><span class="badge bg-light text-dark">M</span> <span class="small text-muted">Meldevordruck</span></div>
                                    <div><span class="badge bg-light text-dark">N</span> <span class="small text-muted">Nachrichtenvordruck</span></div>
                                    <div><span class="badge bg-light text-dark">Esc</span> <span class="small text-muted">Schließen</span></div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer teilnehmer-doc-aktionen">
                            <div class="teilnehmer-doc-status">
                                <span id="teilnehmerDocStatus" class="status-chip status-chip--pending">offen</span>
                                <div class="form-check form-switch teilnehmer-schalter mb-0">
                                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted-modal">
                                    <label class="form-check-label small" for="toggle-hide-transmitted-modal">Abgesetzte ausblenden</label>
                                </div>
                            </div>
                            <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-prev">
                                <i class="fas fa-chevron-left"></i> Zurück
                            </button>
                            <button class="btn btn-success teilnehmer-doc-absetzen" type="button" id="btn-doc-absetzen" data-aktion="absetzen">
                                ✓ Als abgesetzt markieren
                            </button>
                            <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-next">
                                Weiter <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Das Vordruck-Fenster wird beim Öffnen an <body> gehängt (siehe
        // togglePdfModal). Ein Rest aus einer früheren Ansicht muss weg, sonst
        // gäbe es die IDs doppelt.
        document.querySelectorAll("body > #teilnehmerDocModal").forEach(el => el.remove());
        container.innerHTML = headerHtml;
    }

    /**
     * Aktualisiert die Sync-Anzeige im Kopfbereich.
     * Zeigt an, ob der Status gerade wirklich bei der Übungsleitung ankommt.
     */
    public updateLiveSyncState(state: LiveSyncState): void {
        const badge = document.getElementById("teilnehmerLiveSyncBadge");
        if (!badge) {
            return;
        }
        const labels: Record<LiveSyncState, { text: string; css: string; title: string }> = {
            aus: { text: "Sync: aus", css: "bg-secondary", title: "Keine Verbindung zur Übungsleitung eingerichtet – deine Markierungen bleiben nur auf diesem Gerät." },
            verbinde: { text: "Sync: verbinde…", css: "bg-secondary", title: "Verbindung zur Übungsleitung wird aufgebaut." },
            live: { text: "Sync: live", css: "bg-success", title: "Verbunden – deine Markierungen gehen an die Übungsleitung." },
            offline: { text: "Sync: offline – wird nachgereicht", css: "bg-warning text-dark", title: "Keine Verbindung – deine Markierungen sind auf diesem Gerät gespeichert und werden gesendet, sobald wieder Netz da ist." },
            fehler: { text: "Sync: Fehler – wird nicht gesendet", css: "bg-danger", title: "Der Server lehnt die Übermittlung ab – deine Markierungen bleiben nur auf diesem Gerät. Melde den Stand per Funk." }
        };
        const label = labels[state];
        badge.className = `badge ${label.css}`;
        badge.textContent = label.text;
        badge.setAttribute("title", label.title);
    }

    /**
     * Beschriftet das Zurücksetzen nach seiner echten Reichweite: mit
     * Live-Verbindung wirkt es auch bei der Übungsleitung und auf anderen
     * Geräten, ohne nur auf diesem Gerät.
     */
    public setResetUmfang(live: boolean): void {
        const label = document.getElementById("teilnehmerResetLabel");
        const hinweis = document.getElementById("teilnehmerResetHinweis");
        if (label) {
            label.textContent = live
                ? "Abhak-Stand für alle zurücksetzen"
                : "Abhak-Stand auf diesem Gerät löschen";
        }
        if (hinweis) {
            hinweis.textContent = live
                ? "Setzt alle als abgesetzt markierten Funksprüche wieder auf „offen“ – auf diesem Gerät, auf deinen anderen Geräten und bei der Übungsleitung. Einen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile."
                : "Setzt alle als abgesetzt markierten Funksprüche auf diesem Gerät wieder auf „offen“. Einen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile.";
        }
    }

    /**
     * Zeigt nach einem Statuswechsel einen Hinweis mit „Rückgängig“. Er
     * bleibt einige Sekunden stehen; ein Tipp innerhalb der Tippsperre wird
     * ignoriert, damit ein Doppeltipp ihn nicht gleich auslöst.
     */
    public zeigeRueckgaengig(text: string, onUndo: () => void): void {
        const box = document.getElementById("teilnehmerRueckgaengig");
        const textEl = document.getElementById("teilnehmerRueckgaengigText");
        if (!box || !textEl) {
            return;
        }
        textEl.textContent = text;
        box.hidden = false;
        this.rueckgaengigAktion = onUndo;
        this.rueckgaengigSeit = Date.now();
        if (this.rueckgaengigTimer !== null) {
            clearTimeout(this.rueckgaengigTimer);
        }
        this.rueckgaengigTimer = globalThis.setTimeout(() => this.versteckeRueckgaengig(), RUECKGAENGIG_MS);
    }

    public versteckeRueckgaengig(): void {
        const box = document.getElementById("teilnehmerRueckgaengig");
        if (box) {
            box.hidden = true;
        }
        this.rueckgaengigAktion = null;
        if (this.rueckgaengigTimer !== null) {
            clearTimeout(this.rueckgaengigTimer);
            this.rueckgaengigTimer = null;
        }
    }

    private bindRueckgaengig(): void {
        document.getElementById("btn-teilnehmer-rueckgaengig")?.addEventListener("click", () => {
            if (Date.now() - this.rueckgaengigSeit < STATUS_SPERRE_MS) {
                return;
            }
            const aktion = this.rueckgaengigAktion;
            this.versteckeRueckgaengig();
            aktion?.();
        });
    }

    public renderNachrichten(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        optionen: {
            showXZeit?: boolean;
            xZeitBasis?: string;
            /** Bestätigungen der Übungsleitung, Key = Nachrichten-ID als String. */
            bestaetigungen?: Record<string, LeitungBestaetigung>;
            /**
             * ID der Nachricht, die diesen Aufruf ausgelöst hat, weil sie
             * gerade abgesetzt wurde. Ihre Zeile bekommt den Absetzstrich
             * (Abschnitt 10.2 der CSS). Bei aktivem "Abgesetzte ausblenden"
             * bleibt sie zusätzlich noch kurz stehen und geht danach ab —
             * sonst wäre sie weg, bevor die Quittung sichtbar war.
             */
            zuletztAbgesetzt?: number;
        } = {}
    ) {
        const showXZeit = optionen.showXZeit ?? false;
        const xZeitBasis = optionen.xZeitBasis;
        const bestaetigungen = optionen.bestaetigungen ?? {};
        const zuletztAbgesetzt = optionen.zuletztAbgesetzt;
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (!tbody) {
            return;
        }

        // Update Toggle State (if re-rendering, keep UI in sync with storage)
        const toggle = document.getElementById("toggle-hide-transmitted") as HTMLInputElement;
        if (toggle) {
            toggle.checked = storage.hideTransmitted;
        }
        const toggleModal = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement;
        if (toggleModal) {
            toggleModal.checked = storage.hideTransmitted;
        }

        const ausgeblendetHinweis = document.getElementById("teilnehmerAusgeblendet");
        if (ausgeblendetHinweis) {
            const anzahl = storage.hideTransmitted
                ? nachrichten.filter(n => storage.nachrichten[n.id]?.uebertragen).length
                : 0;
            ausgeblendetHinweis.textContent = anzahl > 0 ? `(${anzahl} ausgeblendet)` : "";
        }

        // Ohne X-Zeit gibt es keine Fälligkeit; der erste offene Spruch der
        // Liste ist dann der nächste.
        const naechsterId = nachrichten.find(n => !storage.nachrichten[n.id]?.uebertragen)?.id;

        const rows = nachrichten
            .filter(n => {
                const search = (document.getElementById("teilnehmerSearchInput") as HTMLInputElement | null)?.value?.trim().toLowerCase() ?? "";
                if (search) {
                    const haystack = `${n.id} ${n.empfaenger.join(" ")} ${n.nachricht}`.toLowerCase();
                    if (!haystack.includes(search)) {
                        return false;
                    }
                }
                if (storage.hideTransmitted) {
                    return !storage.nachrichten[n.id]?.uebertragen || n.id === zuletztAbgesetzt;
                }
                return true;
            })
            .map(n => {
                const status = storage.nachrichten[n.id];
                const isUebertragen = !!status?.uebertragen;
                const istAbgesetzt = isUebertragen && n.id === zuletztAbgesetzt;
                const istAbgang = istAbgesetzt && storage.hideTransmitted;
                const istNaechster = !isUebertragen && n.id === naechsterId;
                const bestaetigung = bestaetigungen[String(n.id)];
                const zeilenKlassen = [
                    isUebertragen ? "status-ok-row" : "status-pending-row",
                    istAbgesetzt ? "ist-abgesetzt" : "",
                    istAbgang ? "ist-abgang" : "",
                    istNaechster ? "ist-naechster" : ""
                ].filter(Boolean).join(" ");

                const hinweise = renderFuehrungsstellenHinweise(n);
                const xZeitCell = showXZeit
                    ? (n.xZeitSlot !== undefined
                        ? `<td class="teilnehmer-zelle-xzeit"><span class="${this.getXZeitBadgeClass(n.xZeitSlot, xZeitBasis, isUebertragen)}" data-xzeit-slot="${n.xZeitSlot}" data-n-id="${n.id}">${this.getXZeitBadgeLabel(n.xZeitSlot, xZeitBasis, isUebertragen)}</span></td>`
                        : "<td class=\"teilnehmer-zelle-xzeit\"></td>")
                    : "";

                return `
            <tr class="${zeilenKlassen}" data-n-id="${n.id}"${istAbgang ? " data-abgang=\"1\"" : ""}>
                <td class="teilnehmer-zelle-nr"><span class="teilnehmer-nr-label">Nr. </span>${n.id}</td>
                <td class="teilnehmer-zelle-empfaenger"><span class="teilnehmer-an-label">an </span>${escapeHtml(n.empfaenger.join(", "))}</td>
                <td class="teilnehmer-zelle-text">${this.renderArtBadge(n)}${hinweise.kopf}${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}${hinweise.fuss}</td>
                ${xZeitCell}
                <td class="teilnehmer-zelle-status">${this.renderStatusZelle(n.id, isUebertragen, status?.uebertragenUm, istNaechster)}</td>
                <td class="teilnehmer-zelle-leitung${bestaetigung?.abgesetztUm ? "" : " ist-leer"}">${this.renderBestaetigungCell(bestaetigung)}</td>
            </tr>
        `;
            }).join("");

        const colspan = showXZeit ? "6" : "5";
        const leerZeile = `<tr><td colspan="${colspan}" class="text-center text-muted">Keine Nachrichten vorhanden.</td></tr>`;
        tbody.innerHTML = rows || leerZeile;

        this.raeumeAbgangsZeile(tbody, leerZeile);
        this.renderFokusBereich(nachrichten, storage, showXZeit, xZeitBasis);
    }

    /**
     * Entfernt die abgehende Zeile, nachdem der Absetzstrich durch war. Der
     * Timer ist die Quelle der Wahrheit, nicht das animationend-Ereignis: bei
     * prefers-reduced-motion läuft keine Animation, die Zeile muss trotzdem
     * verschwinden.
     */
    private raeumeAbgangsZeile(tbody: HTMLElement, leerZeile: string): void {
        const zeile = tbody.querySelector<HTMLElement>("tr[data-abgang]");
        if (!zeile) {
            return;
        }
        globalThis.setTimeout(() => {
            if (!zeile.isConnected) {
                return;
            }
            const eigenesTbody = zeile.parentElement;
            zeile.remove();
            if (eigenesTbody && eigenesTbody.children.length === 0) {
                eigenesTbody.innerHTML = leerZeile;
            }
        }, ABGANG_MS);
    }

    /**
     * Fokus-Modus: blendet die Tabelle aus und zeigt nur die aktuell fällige
     * Meldung bzw. den Countdown bis zur nächsten. Künftige Meldungstexte
     * bleiben so bis zur Fälligkeit verborgen.
     */
    private renderFokusBereich(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        showXZeit: boolean,
        xZeitBasis: string | undefined
    ): void {
        const card = document.getElementById("teilnehmerFokusCard");
        if (!card) {
            return;
        }
        const aktiv = showXZeit && !!storage.fokusModus;

        const toggle = document.getElementById("toggle-fokus-modus") as HTMLInputElement | null;
        if (toggle) {
            toggle.checked = !!storage.fokusModus;
        }

        card.classList.toggle("d-none", !aktiv);
        const table = document.getElementById("teilnehmerTableView");
        if (table) {
            table.style.display = aktiv ? "none" : "";
        }
        const search = document.getElementById("teilnehmerSearchInput");
        if (search) {
            search.style.display = aktiv ? "none" : "";
        }

        this.lastFokusSignature = "";
        if (aktiv) {
            this.updateFokusCard(nachrichten, storage, xZeitBasis);
        }
    }

    /** Aktualisiert die Fokus-Karte; rendert nur bei Zustandswechsel neu. */
    public updateFokusCard(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        xZeitBasis: string | undefined
    ): void {
        const card = document.getElementById("teilnehmerFokusCard");
        if (!card || card.classList.contains("d-none")) {
            return;
        }
        const zustand = this.buildFokusZustand(nachrichten, storage, xZeitBasis);
        const signature = [zustand.kind, zustand.aktuelle?.id ?? "", zustand.weitereFaellig, zustand.offen, zustand.zuletztAbgesetzt ?? ""].join("|");
        if (signature !== this.lastFokusSignature) {
            card.innerHTML = this.renderFokusHtml(zustand);
            this.lastFokusSignature = signature;
        }
        if (zustand.kind === "warten") {
            const countdown = document.getElementById("fokusCountdown");
            if (countdown) {
                countdown.textContent = formatCountdown(zustand.countdownMs);
            }
        }
    }

    private buildFokusZustand(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        xZeitBasis: string | undefined
    ): FokusZustand {
        const zustand = this.buildFokusZustandOhneVerlauf(nachrichten, storage, xZeitBasis);
        const zuletzt = this.findeZuletztAbgesetzt(nachrichten, storage);
        return zuletzt !== undefined ? { ...zustand, zuletztAbgesetzt: zuletzt } : zustand;
    }

    /** Die zuletzt als abgesetzt markierte Nachricht (nach Zeitstempel). */
    private findeZuletztAbgesetzt(nachrichten: Nachricht[], storage: TeilnehmerStorage): number | undefined {
        let beste: { id: number; um: string } | undefined;
        for (const n of nachrichten) {
            const eintrag = storage.nachrichten[n.id];
            if (!eintrag?.uebertragen) {
                continue;
            }
            const um = eintrag.uebertragenUm ?? "";
            if (!beste || um > beste.um) {
                beste = { id: n.id, um };
            }
        }
        return beste?.id;
    }

    private buildFokusZustandOhneVerlauf(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        xZeitBasis: string | undefined
    ): FokusZustand {
        const offen = nachrichten
            .filter((n): n is Nachricht & { xZeitSlot: number } =>
                n.xZeitSlot !== undefined && !storage.nachrichten[n.id]?.uebertragen)
            .sort((a, b) => a.xZeitSlot - b.xZeitSlot);

        if (!offen.length) {
            return { kind: "fertig", weitereFaellig: 0, offen: 0, countdownMs: 0 };
        }

        const basisMs = xZeitBasis ? parseHHMMtoMs(xZeitBasis) : null;
        if (basisMs === null) {
            return { kind: "keineBasis", weitereFaellig: 0, offen: offen.length, countdownMs: 0 };
        }

        const now = Date.now();
        const faellig = offen.filter(n => basisMs + n.xZeitSlot * 60000 <= now);
        if (faellig.length && faellig[0]) {
            return {
                kind: "faellig",
                aktuelle: faellig[0],
                weitereFaellig: faellig.length - 1,
                offen: offen.length,
                countdownMs: 0
            };
        }

        const naechste = offen[0];
        if (!naechste) {
            return { kind: "fertig", weitereFaellig: 0, offen: 0, countdownMs: 0 };
        }
        return {
            kind: "warten",
            aktuelle: naechste,
            weitereFaellig: 0,
            offen: offen.length,
            countdownMs: basisMs + naechste.xZeitSlot * 60000 - now
        };
    }

    /** Zeile „Zuletzt abgesetzt: Meldung N – Zurücknehmen“ unter der Fokus-Karte. */
    private renderFokusZuletzt(zustand: FokusZustand): string {
        if (zustand.zuletztAbgesetzt === undefined) {
            return "";
        }
        const id = zustand.zuletztAbgesetzt;
        return `
                        <div class="teilnehmer-fokus-zuletzt">
                            <span class="small text-muted">Zuletzt abgesetzt: Meldung ${id}</span>
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-fokus-zuruecknehmen="${id}">Zurücknehmen</button>
                        </div>`;
    }

    private renderFokusHtml(zustand: FokusZustand): string {
        const zuletzt = this.renderFokusZuletzt(zustand);
        if (zustand.kind === "keineBasis") {
            return `
                <div class="card mb-3">
                    <div class="card-body text-center text-muted py-4">
                        Starte oben die X-Zeit („Jetzt starten“), um den Fokus-Modus zu nutzen.
                    </div>
                </div>`;
        }
        if (zustand.kind === "fertig") {
            return `
                <div class="card border-success mb-3">
                    <div class="card-body text-center py-4">
                        <span class="fs-5">✅ Alle Meldungen abgesetzt.</span>
                        ${zuletzt}
                    </div>
                </div>`;
        }
        if (zustand.kind === "warten" && zustand.aktuelle) {
            return `
                <div class="card mb-3">
                    <div class="card-body text-center py-4">
                        <div class="text-muted">Nächste Meldung in</div>
                        <div class="display-5 font-monospace" id="fokusCountdown">${formatCountdown(zustand.countdownMs)}</div>
                        <div class="text-muted small mt-1">X+${zustand.aktuelle.xZeitSlot} · noch ${zustand.offen} offen</div>
                        ${zuletzt}
                    </div>
                </div>`;
        }
        if (zustand.kind === "faellig" && zustand.aktuelle) {
            const n = zustand.aktuelle;
            const hinweise = renderFuehrungsstellenHinweise(n);
            const weitere = zustand.weitereFaellig > 0
                ? `<div class="text-warning-emphasis small mt-2">+${zustand.weitereFaellig} weitere Meldung(en) fällig</div>`
                : "";
            return `
                <div class="card border-primary mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <span class="badge bg-primary">Meldung ${n.id} fällig · X+${n.xZeitSlot}</span>
                            <span class="text-muted small">noch ${zustand.offen} offen</span>
                        </div>
                        <div class="text-muted small mt-2">an: ${escapeHtml(n.empfaenger.join(", "))}</div>
                        <div class="fs-5 mt-1 mb-3">${this.renderArtBadge(n)}${hinweise.kopf}${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}${hinweise.fuss}</div>
                        <button class="btn btn-success btn-lg w-100 teilnehmer-fokus-absetzen" data-fokus-uebertragen="${n.id}">
                            ✓ Als abgesetzt markieren
                        </button>
                        ${weitere}
                        ${zuletzt}
                    </div>
                </div>`;
        }
        return "";
    }

    public bindFokusEvents(
        onToggleFokus: (checked: boolean) => void,
        onUebertragen: (id: number) => void,
        onZuruecknehmen: (id: number) => void = () => undefined
    ): void {
        document.getElementById("toggle-fokus-modus")?.addEventListener("change", e => {
            onToggleFokus((e.target as HTMLInputElement).checked);
        });
        document.getElementById("teilnehmerFokusCard")?.addEventListener("click", e => {
            const ziel = e.target as HTMLElement;
            const btn = ziel.closest("[data-fokus-uebertragen]") as HTMLElement | null;
            const zurueck = ziel.closest("[data-fokus-zuruecknehmen]") as HTMLElement | null;
            if (!btn && !zurueck) {
                return;
            }
            // Nach dem Abhaken rückt die nächste fällige Meldung an dieselbe
            // Stelle: ein zweiter Tipp würde sonst sie gleich mit abhaken.
            if (this.istKontextGesperrt()) {
                return;
            }
            const id = Number(btn ? btn.dataset["fokusUebertragen"] : zurueck?.dataset["fokusZuruecknehmen"]);
            if (!Number.isFinite(id)) {
                return;
            }
            this.merkeAenderung(id);
            if (btn) {
                onUebertragen(id);
            } else {
                onZuruecknehmen(id);
            }
        });
    }

    /**
     * Kennzeichnet die Übermittlungsart. Bleibt leer, wenn die Übung ohne
     * Kennzeichnung generiert wurde.
     */
    private renderArtBadge(nachricht: Nachricht): string {
        if (!nachricht.art) {
            return "";
        }
        return `<span class="${nachrichtenArtBadgeClass(nachricht.art)} me-2">${nachrichtenArtLabel(nachricht.art)}</span>`;
    }

    private renderBestaetigungCell(bestaetigung?: LeitungBestaetigung): string {
        if (!bestaetigung?.abgesetztUm) {
            return "<span class=\"text-muted small\">–</span>";
        }
        const uhrzeit = formatUhrzeit(bestaetigung.abgesetztUm);
        return `<span class="badge bg-success" title="Von der Übungsleitung bestätigt">Leitung: bestätigt${uhrzeit ? ` ${uhrzeit}` : ""}</span>`;
    }

    /**
     * Status und Aktion je Spruch. Bewusst getrennt: der Zustand ist eine
     * Anzeige, die Aktion ein großer Knopf. Das Zurücknehmen ist ein eigener,
     * kleiner Knopf an anderer Stelle — ein zweiter Tipp auf „abgesetzt“
     * trifft also nie die Gegenaktion.
     */
    private renderStatusZelle(id: number, isUebertragen: boolean, uebertragenUm: string | undefined, istNaechster: boolean): string {
        if (!isUebertragen) {
            return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--pending">offen</span>
                    ${istNaechster ? "<span class=\"teilnehmer-naechster-label\">als Nächstes</span>" : ""}
                </div>
                <button type="button" class="btn btn-success teilnehmer-absetzen" data-aktion="absetzen" data-id="${id}">
                    ✓ Als abgesetzt markieren
                </button>`;
        }
        const uhrzeit = formatUhrzeit(uebertragenUm);
        return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--ok">✓ abgesetzt${uhrzeit ? ` ${uhrzeit}` : ""}</span>
                    <button type="button" class="btn btn-outline-secondary btn-sm teilnehmer-zuruecknehmen" data-aktion="zuruecknehmen" data-id="${id}" aria-label="Spruch ${id} zurücknehmen (wieder offen)">
                        Zurücknehmen
                    </button>
                </div>`;
    }

    public bindEvents(
        onToggleUebertragen: (id: number, checked: boolean) => void,
        onToggleHide: (checked: boolean) => void,
        onReset: () => void,
        onDocViewChange: (mode: "table" | "meldevordruck" | "nachrichtenvordruck") => void,
        onDocPrev: () => void,
        onDocNext: () => void,
        onDocClose: () => void,
        onDocToggleCurrent: () => void,
        onDownloadZip: () => void,
        onSearch: () => void
    ) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }

        // Reset Button
        document.getElementById("btn-reset-teilnehmer-data")?.addEventListener("click", onReset);
        document.getElementById("btn-download-teilnehmer-zip")?.addEventListener("click", onDownloadZip);

        // Hide Toggle
        document.getElementById("toggle-hide-transmitted")?.addEventListener("change", e => {
            onToggleHide((e.target as HTMLInputElement).checked);
        });
        document.getElementById("toggle-hide-transmitted-modal")?.addEventListener("change", e => {
            onToggleHide((e.target as HTMLInputElement).checked);
        });
        document.getElementById("teilnehmerSearchInput")?.addEventListener("input", () => onSearch());

        document.querySelectorAll<HTMLButtonElement>("[data-doc-view]").forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.dataset["docView"] as "table" | "meldevordruck" | "nachrichtenvordruck" | undefined;
                if (mode) {
                    onDocViewChange(mode);
                }
            });
        });

        document.getElementById("btn-doc-prev")?.addEventListener("click", onDocPrev);
        document.getElementById("btn-doc-next")?.addEventListener("click", onDocNext);
        document.getElementById("btn-doc-close")?.addEventListener("click", onDocClose);
        // Bootstrap schließt das Fenster auch per Hintergrund-Tipp; der
        // Controller muss davon erfahren, sonst bleibt er im Vordruck-Modus.
        document.getElementById("teilnehmerDocModal")?.addEventListener("hidden.bs.modal", onDocClose);

        document.addEventListener("keydown", e => {
            const target = e.target as HTMLElement | null;

            // Wer tippt (z. B. im Suchfeld), darf keine Kürzel auslösen.
            if (this.isTypingTarget(target)) {
                return;
            }
            // Alle Kürzel gehören zum Vordruck-Modal und greifen nur, solange es offen ist.
            if (!document.getElementById("teilnehmerDocModal")?.classList.contains("show")) {
                return;
            }

            if (e.code === "Space") {
                // Auf Eingabefeldern (z. B. der Checkbox im Modal) bleibt Space die native Aktivierung.
                if (target?.tagName === "INPUT") {
                    return;
                }
                e.preventDefault();
                if (this.istKontextGesperrt()) {
                    return;
                }
                this.letzteKontextAenderung = Date.now();
                onDocToggleCurrent();
                return;
            }
            // `[` is a practical fallback on non-DE keyboard layouts (e.g. CI runners).
            if (e.key === "ü" || e.key === "Ü" || e.key === "[") {
                const toggle = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement | null;
                if (toggle) {
                    toggle.checked = !toggle.checked;
                    onToggleHide(toggle.checked);
                }
                return;
            }
            if (e.key === "m" || e.key === "M") {
                onDocViewChange("meldevordruck");
                return;
            }
            if (e.key === "n" || e.key === "N") {
                onDocViewChange("nachrichtenvordruck");
                return;
            }
            if (e.key === "Escape") {
                onDocClose();
                return;
            }
            if (e.key === "ArrowLeft") {
                onDocPrev();
                return;
            }
            if (e.key === "ArrowRight") {
                onDocNext();
            }
        });

        // Delegation für die Zeilen: „absetzen“ und „zurücknehmen“ sind zwei
        // getrennte Knöpfe. Nach einem Wechsel ist die Nachricht kurz gesperrt,
        // damit ein Doppeltipp den Wechsel nicht still wieder aufhebt.
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        tbody?.addEventListener("click", event => {
            const btn = (event.target as HTMLElement).closest("[data-aktion]") as HTMLElement | null;
            if (!btn) {
                return;
            }
            const id = Number(btn.dataset["id"]);
            const aktion = btn.dataset["aktion"] as StatusAktion | undefined;
            if (!Number.isFinite(id) || (aktion !== "absetzen" && aktion !== "zuruecknehmen")) {
                return;
            }
            if (this.istGesperrt(id)) {
                return;
            }
            this.merkeAenderung(id, false);
            onToggleUebertragen(id, aktion === "absetzen");
        });

        // Touch-Knopf im Vordruck: dieselbe Aktion wie die Leertaste. Nach dem
        // Wechsel kann der Vordruck auf den nächsten Spruch springen (bei
        // „Abgesetzte ausblenden“) — daher die Kontextsperre.
        document.getElementById("btn-doc-absetzen")?.addEventListener("click", () => {
            if (this.istKontextGesperrt()) {
                return;
            }
            this.letzteKontextAenderung = Date.now();
            onDocToggleCurrent();
        });

        this.bindRueckgaengig();
    }

    public setDocMode(mode: "table" | "meldevordruck" | "nachrichtenvordruck") {
        const tableView = document.getElementById("teilnehmerTableView");
        const buttons = document.querySelectorAll<HTMLButtonElement>("[data-doc-view]");

        buttons.forEach(btn => {
            const isActive = btn.dataset["docView"] === mode;
            btn.classList.toggle("active", isActive);
        });

        const showPdf = mode !== "table";
        tableView?.classList.toggle("d-none", showPdf);
        this.togglePdfModal(showPdf);
    }

    /** Objekt-URL des Vordrucks für den Ausweg „PDF öffnen“, wird je Seite ersetzt. */
    private vorschauFallbackUrl: string | null = null;

    public async renderPdfPage(blob: Blob, page: number, totalPages: number) {
        const canvas = document.getElementById("teilnehmerPdfCanvas") as HTMLCanvasElement | null;
        const container = document.getElementById("teilnehmerPdfView");
        const label = document.getElementById("teilnehmerDocPage");
        const prevBtn = document.getElementById("btn-doc-prev") as HTMLButtonElement | null;
        const nextBtn = document.getElementById("btn-doc-next") as HTMLButtonElement | null;

        if (label) {
            label.textContent = `Seite ${page} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
        }

        if (!canvas || !container) {
            return;
        }
        try {
            // ensure layout is measured correctly after modal/render changes
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

            const pdfjs = await loadPdfJs();
            const buffer = await blob.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: buffer }).promise;
            const pdfPage = await pdf.getPage(1);

            const baseViewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
            const rect = container.getBoundingClientRect();
            const containerWidth = rect.width || container.clientWidth || baseViewport.width;
            const containerHeight = rect.height || container.clientHeight || baseViewport.height;
            const scale = Math.min(
                containerWidth / baseViewport.width,
                containerHeight / baseViewport.height
            );
            const dpr = window.devicePixelRatio || 1;
            const viewport = pdfPage.getViewport({ scale, rotation: 0 });
            const hiResViewport = pdfPage.getViewport({ scale: scale * dpr, rotation: 0 });

            canvas.width = Math.floor(hiResViewport.width);
            canvas.height = Math.floor(hiResViewport.height);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                await pdfPage.render({ canvasContext: ctx, viewport: hiResViewport }).promise;
            }
            this.zeigeVorschauFehler(container, canvas, null);
        } catch (err) {
            console.error("Vordruck-Vorschau fehlgeschlagen:", err);
            this.zeigeVorschauFehler(container, canvas, blob);
        }
    }

    /**
     * Zeigt statt eines leeren Rahmens eine Meldung mit Ausweg, wenn pdf.js
     * die Seite nicht zeichnen kann (alter Browser, kein Netz beim ersten
     * Laden). `blob === null` räumt die Meldung nach Erfolg wieder ab.
     */
    private zeigeVorschauFehler(container: HTMLElement, canvas: HTMLCanvasElement, blob: Blob | null): void {
        if (this.vorschauFallbackUrl) {
            URL.revokeObjectURL(this.vorschauFallbackUrl);
            this.vorschauFallbackUrl = null;
        }
        container.querySelector(`#${VORSCHAU_FEHLER_ID}`)?.remove();
        if (!blob) {
            canvas.classList.remove("d-none");
            return;
        }
        canvas.classList.add("d-none");
        this.vorschauFallbackUrl = URL.createObjectURL(blob);
        const hinweis = document.createElement("div");
        hinweis.id = VORSCHAU_FEHLER_ID;
        hinweis.className = "alert alert-warning m-3 teilnehmer-doc-fehler";
        hinweis.setAttribute("role", "alert");
        hinweis.innerHTML = `
            <p class="mb-2"><strong>Die Vorschau lässt sich hier nicht anzeigen.</strong></p>
            <p class="mb-3">Öffne den Vordruck als PDF oder arbeite mit der Tabelle weiter.
            Ohne Netz hilft auch der Ausdruck aus dem ZIP.</p>
            <a class="btn btn-primary" href="${this.vorschauFallbackUrl}" target="_blank" rel="noopener"
               data-testid="vordruck-pdf-oeffnen">Vordruck als PDF öffnen</a>`;
        container.appendChild(hinweis);
    }

    /**
     * Zustand des angezeigten Vordrucks: Statusanzeige und Touch-Knopf. Der
     * Knopf wechselt zwischen „Als abgesetzt markieren“ und „Zurücknehmen“;
     * ein Doppeltipp ist durch die Kontextsperre in bindEvents abgefangen.
     */
    public setDocTransmitted(isTransmitted: boolean, vorhanden = true) {
        const modal = document.getElementById("teilnehmerDocModal");
        modal?.classList.toggle("teilnehmer-doc-modal--done", isTransmitted);

        const status = document.getElementById("teilnehmerDocStatus");
        if (status) {
            status.className = `status-chip ${isTransmitted ? "status-chip--ok" : "status-chip--pending"}`;
            status.textContent = vorhanden ? (isTransmitted ? "✓ abgesetzt" : "offen") : "kein Spruch";
        }
        const btn = document.getElementById("btn-doc-absetzen") as HTMLButtonElement | null;
        if (btn) {
            btn.disabled = !vorhanden;
            btn.dataset["aktion"] = isTransmitted ? "zuruecknehmen" : "absetzen";
            btn.className = `btn ${isTransmitted ? "btn-outline-secondary" : "btn-success"} teilnehmer-doc-absetzen`;
            btn.textContent = isTransmitted ? "Zurücknehmen (wieder offen)" : "✓ Als abgesetzt markieren";
        }
    }

    public setXZeitBasisInputValue(value: string): void {
        const input = document.getElementById("xZeitBasisInput") as HTMLInputElement | null;
        if (input) {
            input.value = value;
        }
    }

    public bindXZeitEvents(
        onBasisChange: (value: string) => void,
        onJetzt: () => void
    ): void {
        document.getElementById("xZeitBasisInput")?.addEventListener("change", e => {
            onBasisChange((e.target as HTMLInputElement).value);
        });
        document.getElementById("btn-xzeit-jetzt")?.addEventListener("click", onJetzt);
    }

    public updateXZeitCountdown(nachrichten: Nachricht[], storage: TeilnehmerStorage, xZeitBasis: string): void {
        const countdown = document.getElementById("xZeitCountdown");
        if (countdown) {
            const next = this.getNextDueMessage(nachrichten, storage, xZeitBasis);
            if (next !== null) {
                countdown.textContent = `Nächste in ${formatCountdown(next)}`;
            } else {
                countdown.textContent = "Keine ausstehenden Nachrichten";
            }
        }

        this.updateFokusCard(nachrichten, storage, xZeitBasis);

        document.querySelectorAll<HTMLElement>("[data-xzeit-slot]").forEach(el => {
            const slot = Number(el.dataset["xzeitSlot"]);
            const nId = Number(el.dataset["nId"]);
            const transmitted = !!storage.nachrichten[nId]?.uebertragen;
            el.className = this.getXZeitBadgeClass(slot, xZeitBasis, transmitted);
            el.textContent = this.getXZeitBadgeLabel(slot, xZeitBasis, transmitted);
        });
    }

    private getNextDueMessage(nachrichten: Nachricht[], storage: TeilnehmerStorage, xZeitBasis: string): number | null {
        const basisMs = parseHHMMtoMs(xZeitBasis);
        if (basisMs === null) {
            return null;
        }
        const now = Date.now();
        let nearest: number | null = null;
        for (const n of nachrichten) {
            if (n.xZeitSlot === undefined) {
                continue;
            }
            if (storage.nachrichten[n.id]?.uebertragen) {
                continue;
            }
            const targetMs = basisMs + n.xZeitSlot * 60000;
            const diffMs = targetMs - now;
            if (diffMs > 0 && (nearest === null || diffMs < nearest)) {
                nearest = diffMs;
            }
        }
        return nearest;
    }

    private getXZeitBadgeClass(slot: number, xZeitBasis: string | undefined, transmitted: boolean): string {
        if (transmitted || !xZeitBasis) {
            return "badge bg-secondary";
        }
        const basisMs = parseHHMMtoMs(xZeitBasis);
        if (basisMs === null) {
            return "badge bg-secondary";
        }
        const diffMs = basisMs + slot * 60000 - Date.now();
        if (diffMs > 120000) {
            return "badge bg-success";
        }
        if (diffMs > 0) {
            return "badge bg-warning text-dark";
        }
        return "badge bg-danger";
    }

    private getXZeitBadgeLabel(slot: number, xZeitBasis: string | undefined, transmitted: boolean): string {
        if (transmitted || !xZeitBasis) {
            return `X+${slot}`;
        }
        const basisMs = parseHHMMtoMs(xZeitBasis);
        if (basisMs === null) {
            return `X+${slot}`;
        }
        const diffMs = basisMs + slot * 60000 - Date.now();
        if (diffMs <= 0) {
            return `X+${slot} !`;
        }
        if (diffMs <= 120000) {
            const mins = Math.floor(diffMs / 60000);
            const secs = Math.floor((diffMs % 60000) / 1000);
            return `X+${slot} ${mins}:${String(secs).padStart(2, "0")}`;
        }
        return `X+${slot}`;
    }

    private togglePdfModal(show: boolean) {
        const modalEl = document.getElementById("teilnehmerDocModal");
        if (!modalEl) {
            return;
        }
        // Innerhalb der Ansicht bildet ein Vorfahr einen eigenen Stapel- und
        // Positionierungskontext: das Fenster lag dann unter dem fixierten
        // App-Kopf und war am Handy nicht bildschirmfüllend.
        if (show && modalEl.parentElement !== document.body) {
            document.body.appendChild(modalEl);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bootstrapModal = (window as any).bootstrap?.Modal;
        if (bootstrapModal) {
            const instance = bootstrapModal.getOrCreateInstance(modalEl);
            if (show) {
                instance.show();
                window.setTimeout(() => {
                    (document.getElementById("btn-doc-close") as HTMLButtonElement | null)?.focus();
                }, 0);
            } else {
                instance.hide();
            }
            return;
        }
        modalEl.classList.toggle("show", show);
        modalEl.style.display = show ? "block" : "none";
        document.body.classList.toggle("modal-open", show);
        if (show) {
            window.setTimeout(() => {
                (document.getElementById("btn-doc-close") as HTMLButtonElement | null)?.focus();
            }, 0);
        }
    }
}
