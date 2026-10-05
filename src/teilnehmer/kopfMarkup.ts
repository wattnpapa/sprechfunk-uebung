import { Uebung } from "../types/Uebung";
import { escapeHtml } from "../utils/html";
import { formatDatumKurz, teilnehmerTitel } from "./teilnehmerFormat";

const STANDARD_JOIN_HINWEIS = "Gib Übungscode und Teilnehmercode ein. Beide stehen in der Nachricht oder auf dem Zettel der Übungsleitung.";

/** Formular „Teilnehmer-Zugang“ mit Übungs- und Teilnehmercode. */
export function joinFormHtml(prefilledUebungCode: string, prefilledTeilnehmerCode: string, hinweis: string): string {
    // Codes sind Großbuchstaben und Ziffern: Großschreib-Tastatur, keine
    // Autokorrektur, die aus "MNTA" ein Wort macht.
    const codeAttrs = "autocapitalize=\"characters\" autocorrect=\"off\" autocomplete=\"off\" spellcheck=\"false\"";
    return `
            <div class="card mb-4 teilnehmer-zugang">
                <div class="card-header">
                    <h3 class="card-title mb-0">Teilnehmer-Zugang</h3>
                </div>
                <div class="card-body">
                    <p class="text-muted mb-3" id="teilnehmerJoinHinweis">${hinweis ? escapeHtml(hinweis) : STANDARD_JOIN_HINWEIS}</p>
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

function kopfKarteHtml(uebung: Uebung, teilnehmer: string): string {
    const safeName = escapeHtml(teilnehmerTitel(uebung.name));
    const safeTeilnehmer = escapeHtml(teilnehmer);
    const safeDatum = escapeHtml(formatDatumKurz(uebung.datum));
    const safeRufgruppe = escapeHtml(uebung.rufgruppe || "–");
    const safeLeitung = escapeHtml(uebung.leitung || "–");
    return `
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
`;
}

function werkzeugHtml(): string {
    return `
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
`;
}

function xZeitBannerHtml(): string {
    return `
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
            <div id="teilnehmerFokusCard" class="d-none" data-testid="teilnehmer-fokus-card"></div>`;
}

function tabelleHtml(xZeit: boolean): string {
    return `
            <div id="teilnehmerTableView" class="table-responsive teilnehmer-liste">
                <table class="table table-hover align-middle">
                    <thead class="table-light" id="teilnehmerTableHead">
                        <tr>
                            <th>Nr.</th>
                            <th>Empfänger</th>
                            <th>Nachricht</th>
                            ${xZeit ? "<th style=\"width: 90px;\">X-Zeit</th>" : ""}
                            <th style="width: 210px;">Status</th>
                            <th style="width: 120px;">Leitung</th>
                        </tr>
                    </thead>
                    <tbody id="teilnehmerNachrichtenBody"></tbody>
                </table>
            </div>
`;
}

function unterlagenUndGefahrHtml(): string {
    return `
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
`;
}

function vordruckModalKoerperHtml(): string {
    return `
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
                        </div>`;
}

function vordruckModalFussHtml(): string {
    return `
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
                        </div>`;
}

function vordruckModalHtml(): string {
    return `
            <div class="modal fade teilnehmer-doc-modal" id="teilnehmerDocModal" tabindex="-1" aria-hidden="true" aria-labelledby="teilnehmerDocTitel">
                <div class="modal-dialog modal-dialog-centered modal-xl modal-fullscreen-md-down">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="teilnehmerDocTitel">Vordruck</h5>
                            <button type="button" class="btn btn-outline-secondary teilnehmer-doc-schliessen" id="btn-doc-close" aria-label="Vordruck schließen">
                                <i class="fas fa-xmark"></i> Schließen
                            </button>
                        </div>${vordruckModalKoerperHtml()}${vordruckModalFussHtml()}
                    </div>
                </div>
            </div>
        `;
}

/**
 * Kompakter Kopf: auf dem Handy soll der erste Spruch ohne Scrollen
 * sichtbar sein. Seltene Aktionen (ZIP, Zurücksetzen) stehen am Ende.
 */
export function kopfHtml(uebung: Uebung, teilnehmer: string): string {
    const xZeit = uebung.spielModus === "xZeit";
    return [
        kopfKarteHtml(uebung, teilnehmer),
        werkzeugHtml(),
        xZeit ? xZeitBannerHtml() : "",
        tabelleHtml(xZeit),
        unterlagenUndGefahrHtml(),
        vordruckModalHtml()
    ].join("\n");
}
