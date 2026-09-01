import { Uebung } from "../types/Uebung";
import { formatNatoDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";
import type { LeitungBestaetigung, LiveSyncState } from "../types/LiveStatus";
import { formatCountdown, parseHHMMtoMs } from "../utils/xzeit";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";

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
        });
    }
    return pdfJsPromise;
};

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
}

export class TeilnehmerView {
    /** Merker, um die Fokus-Karte nur bei Zustandswechseln neu zu rendern. */
    private lastFokusSignature = "";

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

    public renderJoinForm(prefilledUebungCode = "", prefilledTeilnehmerCode = ""): void {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3 class="card-title mb-0">Teilnehmer-Zugang</h3>
                </div>
                <div class="card-body">
                    <p class="text-muted mb-3">Bitte Übungscode und Teilnehmercode eingeben.</p>
                    <form id="teilnehmerJoinForm" class="row g-3" autocomplete="off">
                        <div class="col-md-6">
                            <label class="form-label" for="joinUebungCode">Übungscode</label>
                            <input class="form-control text-uppercase" id="joinUebungCode" maxlength="6" placeholder="z. B. K7M4Q2" value="${escapeHtml(prefilledUebungCode)}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label" for="joinTeilnehmerCode">Teilnehmercode</label>
                            <input class="form-control text-uppercase" id="joinTeilnehmerCode" maxlength="4" placeholder="z. B. 9F3K" value="${escapeHtml(prefilledTeilnehmerCode)}">
                        </div>
                        <div class="col-12">
                            <button type="submit" class="btn btn-primary" id="joinSubmitBtn">
                                <i class="fas fa-right-to-bracket"></i> Zugang öffnen
                            </button>
                        </div>
                    </form>
                    <p id="teilnehmerJoinError" class="text-danger mt-3 mb-0 d-none" aria-live="polite"></p>
                </div>
            </div>
        `;
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

        const safeName = escapeHtml(uebung.name || "–");
        const safeTeilnehmer = escapeHtml(teilnehmer);
        const safeDatum = escapeHtml(formatNatoDate(uebung.datum));
        const safeRufgruppe = escapeHtml(uebung.rufgruppe || "–");
        const safeLeitung = escapeHtml(uebung.leitung || "–");

        // Header Card
        const headerHtml = `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h3 class="card-title mb-0">Sprechfunkübung: ${safeName}</h3>
                    <div class="d-flex gap-2 align-items-center">
                        <span id="teilnehmerLiveSyncBadge" class="badge bg-secondary" aria-live="polite" title="Status der Live-Übertragung an die Übungsleitung">Sync: –</span>
                        <button class="btn btn-sm btn-outline-light" id="btn-download-teilnehmer-zip">
                            <i class="fas fa-file-archive"></i> ZIP herunterladen
                        </button>
                        <button class="btn btn-sm btn-outline-light" id="btn-reset-teilnehmer-data">
                            <i class="fas fa-undo"></i> Lokale Daten löschen
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Eigener Funkrufname:</strong> ${safeTeilnehmer}</p>
                            <p><strong>Datum:</strong> ${safeDatum}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Rufgruppe:</strong> ${safeRufgruppe}</p>
                            <p><strong>Übungsleitung:</strong> ${safeLeitung}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <h4 class="mb-0">Meine Funksprüche</h4>
                <div class="btn-group" role="group" aria-label="Ansicht wählen">
                    <button class="btn btn-outline-primary active" type="button" data-doc-view="table">Tabelle</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="meldevordruck">Meldevordruck</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="nachrichtenvordruck">Nachrichtenvordruck</button>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted">
                    <label class="form-check-label" for="toggle-hide-transmitted">Übertragene ausblenden</label>
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

            <div id="teilnehmerTableView" class="table-responsive">
                <table class="table table-striped table-hover align-middle">
                    <thead class="table-light" id="teilnehmerTableHead">
                        <tr>
                            <th>Nr.</th>
                            <th>Empfänger</th>
                            <th>Nachricht</th>
                            ${uebung.spielModus === "xZeit" ? "<th style=\"width: 90px;\">X-Zeit</th>" : ""}
                            <th style="width: 150px;">Status</th>
                            <th style="width: 120px;">Leitung</th>
                        </tr>
                    </thead>
                    <tbody id="teilnehmerNachrichtenBody"></tbody>
                </table>
            </div>

            <div class="modal fade teilnehmer-doc-modal" id="teilnehmerDocModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Vordruck</h5>
                            <div class="form-check form-switch ms-3">
                                <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted-modal">
                                <label class="form-check-label small" for="toggle-hide-transmitted-modal">Übertragene ausblenden</label>
                            </div>
                            <button type="button" class="btn-close" id="btn-doc-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="teilnehmer-doc-layout">
                                <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-prev">
                                    <i class="fas fa-chevron-left"></i> Zurück
                                </button>
                                <div class="teilnehmer-doc-center">
                                    <div id="teilnehmerPdfView" class="teilnehmer-doc-container">
                                        <canvas id="teilnehmerPdfCanvas" class="teilnehmer-doc-canvas"></canvas>
                                    </div>
                                    <span id="teilnehmerDocPage" class="text-muted teilnehmer-doc-page" aria-live="polite"></span>
                                </div>
                                <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-next">
                                    Weiter <i class="fas fa-chevron-right"></i>
                                </button>
                                <div class="teilnehmer-doc-legend">
                                    <div><span class="badge bg-light text-dark">←/→</span> <span class="small text-muted">Blättern</span></div>
                                    <div><span class="badge bg-light text-dark">Space</span> <span class="small text-muted">Übertragen</span></div>
                                    <div><span class="badge bg-light text-dark">Ü</span> <span class="small text-muted">Übertragene ausblenden</span></div>
                                    <div><span class="badge bg-light text-dark">M</span> <span class="small text-muted">Meldevordruck</span></div>
                                    <div><span class="badge bg-light text-dark">N</span> <span class="small text-muted">Nachrichtenvordruck</span></div>
                                    <div><span class="badge bg-light text-dark">Esc</span> <span class="small text-muted">Schließen</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

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
            aus: { text: "Sync: aus", css: "bg-secondary", title: "Live-Übertragung deaktiviert – Status bleibt nur auf diesem Gerät." },
            verbinde: { text: "Sync: verbinde…", css: "bg-secondary", title: "Verbindung zur Übungsleitung wird aufgebaut." },
            live: { text: "Sync: live", css: "bg-success", title: "Status wird live an die Übungsleitung übertragen." },
            fehler: { text: "Sync: offline", css: "bg-warning text-dark", title: "Keine Verbindung – Status wird lokal gespeichert und später übertragen." }
        };
        const label = labels[state];
        badge.className = `badge ${label.css}`;
        badge.textContent = label.text;
        badge.setAttribute("title", label.title);
    }

    public renderNachrichten(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        optionen: {
            showXZeit?: boolean;
            xZeitBasis?: string;
            /** Bestätigungen der Übungsleitung, Key = Nachrichten-ID als String. */
            bestaetigungen?: Record<string, LeitungBestaetigung>;
        } = {}
    ) {
        const showXZeit = optionen.showXZeit ?? false;
        const xZeitBasis = optionen.xZeitBasis;
        const bestaetigungen = optionen.bestaetigungen ?? {};
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
                    return !storage.nachrichten[n.id]?.uebertragen;
                }
                return true;
            })
            .map(n => {
                const status = storage.nachrichten[n.id];
                const isUebertragen = !!status?.uebertragen;
                const toggleId = `toggle-uebertragen-${n.id}`;

                const xZeitCell = showXZeit
                    ? (n.xZeitSlot !== undefined
                        ? `<td><span class="${this.getXZeitBadgeClass(n.xZeitSlot, xZeitBasis, isUebertragen)}" data-xzeit-slot="${n.xZeitSlot}" data-n-id="${n.id}">${this.getXZeitBadgeLabel(n.xZeitSlot, xZeitBasis, isUebertragen)}</span></td>`
                        : "<td></td>")
                    : "";

                return `
            <tr class="${isUebertragen ? "status-ok-row" : "status-pending-row"}">
                <td>${n.id}</td>
                <td>${escapeHtml(n.empfaenger.join(", "))}</td>
                <td>${this.renderArtBadge(n)}${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}</td>
                ${xZeitCell}
                <td>
                    <div class="form-check form-switch d-flex align-items-center gap-2">
                        <button type="button"
                            class="status-chip ${isUebertragen ? "status-chip--ok" : "status-chip--pending"} btn-toggle-uebertragen-chip"
                            data-id="${n.id}"
                            data-checked="${isUebertragen ? "1" : "0"}">
                            ${isUebertragen ? "übertragen" : "offen"}
                        </button>
                        <input class="form-check-input btn-toggle-uebertragen" type="checkbox" 
                            id="${toggleId}"
                            data-id="${n.id}" ${isUebertragen ? "checked" : ""}>
                    </div>
                </td>
                <td>${this.renderBestaetigungCell(bestaetigungen[String(n.id)])}</td>
            </tr>
        `;
            }).join("");

        const colspan = showXZeit ? "6" : "5";
        tbody.innerHTML = rows || `<tr><td colspan="${colspan}" class="text-center text-muted">Keine Nachrichten vorhanden.</td></tr>`;

        this.renderFokusBereich(nachrichten, storage, showXZeit, xZeitBasis);
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
        const signature = [zustand.kind, zustand.aktuelle?.id ?? "", zustand.weitereFaellig, zustand.offen].join("|");
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

    private renderFokusHtml(zustand: FokusZustand): string {
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
                        <span class="fs-5">✅ Alle Meldungen übertragen.</span>
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
                    </div>
                </div>`;
        }
        if (zustand.kind === "faellig" && zustand.aktuelle) {
            const n = zustand.aktuelle;
            const weitere = zustand.weitereFaellig > 0
                ? `<div class="text-warning small mt-2">+${zustand.weitereFaellig} weitere Meldung(en) fällig</div>`
                : "";
            return `
                <div class="card border-primary mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <span class="badge bg-primary">Meldung ${n.id} fällig · X+${n.xZeitSlot}</span>
                            <span class="text-muted small">noch ${zustand.offen} offen</span>
                        </div>
                        <div class="text-muted small mt-2">an: ${escapeHtml(n.empfaenger.join(", "))}</div>
                        <p class="fs-5 mt-1 mb-3">${this.renderArtBadge(n)}${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}</p>
                        <button class="btn btn-success btn-lg w-100" data-fokus-uebertragen="${n.id}">
                            ✓ Als übertragen markieren
                        </button>
                        ${weitere}
                    </div>
                </div>`;
        }
        return "";
    }

    public bindFokusEvents(
        onToggleFokus: (checked: boolean) => void,
        onUebertragen: (id: number) => void
    ): void {
        document.getElementById("toggle-fokus-modus")?.addEventListener("change", e => {
            onToggleFokus((e.target as HTMLInputElement).checked);
        });
        document.getElementById("teilnehmerFokusCard")?.addEventListener("click", e => {
            const btn = (e.target as HTMLElement).closest("[data-fokus-uebertragen]") as HTMLElement | null;
            if (!btn) {
                return;
            }
            const id = Number(btn.dataset["fokusUebertragen"]);
            if (Number.isFinite(id)) {
                onUebertragen(id);
            }
        });
    }

    /** Zeigt an, ob die Übungsleitung den Spruch bereits als abgesetzt bestätigt hat. */
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
        return `<span class="badge bg-success" title="Von der Übungsleitung bestätigt">bestätigt ${formatNatoDate(bestaetigung.abgesetztUm)}</span>`;
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

        // Delegation for dynamic rows
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (tbody) {
            const handleToggleEvent = (event: Event) => {
                const target = event.target as HTMLInputElement;
                if (!target.classList.contains("btn-toggle-uebertragen")) {
                    return;
                }
                const id = Number(target.dataset["id"]);
                if (!Number.isFinite(id)) {
                    return;
                }
                onToggleUebertragen(id, target.checked);
            };
            tbody.addEventListener("change", handleToggleEvent);
            tbody.addEventListener("click", handleToggleEvent);
            tbody.addEventListener("click", event => {
                const target = event.target as HTMLElement;
                const chip = target.closest(".btn-toggle-uebertragen-chip") as HTMLElement | null;
                if (!chip) {
                    return;
                }
                const id = Number(chip.dataset["id"]);
                const checked = chip.dataset["checked"] === "1";
                if (!Number.isFinite(id)) {
                    return;
                }
                onToggleUebertragen(id, !checked);
            });
        }

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

    public async renderPdfPage(blob: Blob, page: number, totalPages: number) {
        const canvas = document.getElementById("teilnehmerPdfCanvas") as HTMLCanvasElement | null;
        const container = document.getElementById("teilnehmerPdfView");
        const label = document.getElementById("teilnehmerDocPage");
        const prevBtn = document.getElementById("btn-doc-prev") as HTMLButtonElement | null;
        const nextBtn = document.getElementById("btn-doc-next") as HTMLButtonElement | null;

        if (canvas && container) {
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
        }
        if (label) {
            label.textContent = `Seite ${page} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
        }
    }

    public setDocTransmitted(isTransmitted: boolean) {
        const modal = document.getElementById("teilnehmerDocModal");
        modal?.classList.toggle("teilnehmer-doc-modal--done", isTransmitted);
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
