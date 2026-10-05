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

/**
 * Rückgängig im Vordruck: eine eigene Zeile über der Knopfleiste. Die
 * schwebende Leiste lag hier über „Weiter“ – wer nach dem Abhaken
 * weiterblättern wollte, traf „Rückgängig“ (glove-touch P1-1, 2026-10-05).
 */
function vordruckRueckgaengigHtml(): string {
    return `
                        <div id="teilnehmerDocRueckgaengig" class="teilnehmer-doc-rueckgaengig" role="status" aria-live="polite" hidden>
                            <span id="teilnehmerDocRueckgaengigText"></span>
                            <button type="button" class="btn btn-outline-secondary" id="btn-doc-rueckgaengig">Rückgängig</button>
                        </div>`;
}

/**
 * Knopfleiste. Ist der angezeigte Spruch abgesetzt, steht in der Mitte ein
 * Statusfeld ohne Funktion; „Zurücknehmen“ ist klein und sitzt in der
 * Statuszeile darüber (glove-touch P2-1, stress-test P2-2, 2026-10-05).
 */
function vordruckModalFussHtml(): string {
    return `
                        <div class="modal-footer teilnehmer-doc-aktionen">
                            <div class="teilnehmer-doc-status">
                                <span id="teilnehmerDocStatus" class="status-chip status-chip--pending">offen</span>
                                <div class="form-check form-switch teilnehmer-schalter mb-0">
                                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted-modal">
                                    <label class="form-check-label small" for="toggle-hide-transmitted-modal">Abgesetzte ausblenden</label>
                                </div>
                                <button type="button" class="btn btn-outline-secondary btn-sm teilnehmer-doc-zuruecknehmen" id="btn-doc-zuruecknehmen" hidden>
                                    Zurücknehmen
                                </button>
                            </div>
                            <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-prev">
                                <i class="fas fa-chevron-left"></i> Zurück
                            </button>
                            <button class="btn btn-primary teilnehmer-doc-absetzen" type="button" id="btn-doc-absetzen" data-aktion="absetzen">
                                Als abgesetzt markieren
                            </button>
                            <div class="teilnehmer-doc-erledigt" id="teilnehmerDocErledigt" hidden>✓ abgesetzt</div>
                            <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-next">
                                Weiter <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>`;
}

/** Vordruck-Fenster (Melde- und Nachrichtenvordruck). */
export function vordruckModalHtml(): string {
    return `
            <div class="modal fade teilnehmer-doc-modal" id="teilnehmerDocModal" tabindex="-1" aria-hidden="true" aria-labelledby="teilnehmerDocTitel">
                <div class="modal-dialog modal-dialog-centered modal-xl modal-fullscreen-md-down">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="teilnehmerDocTitel">Vordruck</h5>
                            <button type="button" class="btn btn-outline-secondary teilnehmer-doc-schliessen" id="btn-doc-close" aria-label="Vordruck schließen">
                                <i class="fas fa-xmark"></i> Schließen
                            </button>
                        </div>${vordruckModalKoerperHtml()}${vordruckRueckgaengigHtml()}${vordruckModalFussHtml()}
                    </div>
                </div>
            </div>
        `;
}
