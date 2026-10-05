/**
 * Karte „X-Zeit“ einer X-Zeit-Übung.
 *
 * Die X-Zeit setzt im Normalfall die Übungsleitung; sie erscheint hier von
 * selbst. Vor dem Start steht deshalb nur ein Satz da und kein Knopf, der wie
 * eine Aufforderung wirkt (field-user P2, 2026-10-05). Wer ohne Übungsleitung
 * übt, klappt das Zeitfeld bewusst auf. Alle Bedienelemente sind mindestens
 * 44 px hoch (glove-touch P2-3).
 */
export function xZeitBannerHtml(): string {
    return `
            <div class="card mb-2 teilnehmer-xzeit" id="xZeitBanner">
                <div class="card-body">
                    <div class="teilnehmer-xzeit-zeile">
                        <strong class="text-nowrap">X-Zeit</strong>
                        <span id="xZeitBasisHerkunft" class="teilnehmer-xzeit-herkunft"></span>
                        <span id="xZeitCountdown" class="teilnehmer-xzeit-countdown"></span>
                    </div>
                    <div class="teilnehmer-xzeit-optionen">
                        <div class="form-check form-switch teilnehmer-schalter mb-0" title="Zeigt nur die aktuell fällige Meldung mit Countdown – künftige Meldungen bleiben verborgen.">
                            <input class="form-check-input" type="checkbox" id="toggle-fokus-modus">
                            <label class="form-check-label" for="toggle-fokus-modus">Nur fälligen Spruch zeigen (Fokus)</label>
                        </div>
                        <details class="teilnehmer-xzeit-eigene" id="xZeitEigene">
                            <summary>Ohne Übungsleitung üben: X-Zeit selbst setzen</summary>
                            <div class="teilnehmer-xzeit-eingabe">
                                <label class="visually-hidden" for="xZeitBasisInput">Eigene X-Zeit (Uhrzeit)</label>
                                <input type="time" class="form-control" id="xZeitBasisInput">
                                <button class="btn btn-outline-primary" id="btn-xzeit-jetzt" type="button">Jetzt starten</button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
            <div id="teilnehmerFokusCard" class="d-none" data-testid="teilnehmer-fokus-card"></div>`;
}
