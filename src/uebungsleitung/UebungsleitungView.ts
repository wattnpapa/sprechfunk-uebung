import { Uebung } from "../types/Uebung";
import { formatNatoDate } from "../utils/date";
import { TeilnehmerStatus, NachrichtenStatus } from "../types/Storage";
import { escapeHtml } from "../utils/html";
import {
    UebungsleitungNachrichtenView,
    FlattenedNachricht,
    HeatmapBin,
    TeilnehmerTimeline
} from "./UebungsleitungNachrichtenView";
import { UebungsleitungTeilnehmerView } from "./UebungsleitungTeilnehmerView";
import type { LiveSyncState } from "../types/LiveStatus";
import type { EffektiverNachrichtenStatus, TeilnehmerFortschritt } from "../services/liveStatusMerge";
import { berechnePlanStatus, formatLaufzeit, formatXZeit } from "../utils/xzeit";

export interface CockpitAnzeige {
    /** Formatierte Uhrzeit, z. B. "14:03:27". */
    uhrzeit: string;
    /** Millisekunden seit X-Zeit-Basis – `null`, solange keine Basis bekannt ist. */
    laufzeitMs: number | null;
    /** Erledigte Nachrichten (Teilnehmer-Meldung oder Bestätigung der Leitung). */
    ist: number;
    gesamt: number;
    /** Laut Zeitplan fällige Nachrichten – `null` ohne Basis. */
    soll: number | null;
    basisHinweis: string;
}

export class UebungsleitungView {
    private teilnehmerView = new UebungsleitungTeilnehmerView();
    private nachrichtenView = new UebungsleitungNachrichtenView();

    public renderMeta(uebung: Uebung, uebungId: string): void {
        const metaEl = document.getElementById("uebungsleitungMeta");
        if (!metaEl) {
            return;
        }
        metaEl.innerHTML = this.buildMetaHtml(uebung, uebungId);
    }

    public bindMetaEvents(onPdfExport: () => void, onReset: () => void, onUebersichtExport?: () => void): void {
        document.getElementById("exportUebungsleitungPdf")?.addEventListener("click", onPdfExport);
        document.getElementById("resetUebungsleitungLocalData")?.addEventListener("click", onReset);
        if (onUebersichtExport) {
            document.getElementById("exportTeilnehmerUebersichtPdf")?.addEventListener("click", onUebersichtExport);
        }
    }

    /** Reicht den Live-Sync-Status an die Nachrichten-Ansicht durch. */
    public updateLiveSyncState(state: LiveSyncState): void {
        this.nachrichtenView.updateLiveSyncState(state);
    }

    /** Cockpit-Kacheln nur im X-Zeit-Modus einblenden. */
    public setCockpitVisible(visible: boolean): void {
        document.getElementById("uebungsleitungCockpit")?.classList.toggle("d-none", !visible);
    }

    public updateCockpit(anzeige: CockpitAnzeige): void {
        this.setText("cockpitUhrzeit", anzeige.uhrzeit);
        this.setText("cockpitLaufzeit", anzeige.laufzeitMs !== null ? formatLaufzeit(anzeige.laufzeitMs) : "–");
        this.setText("cockpitXZeit", anzeige.laufzeitMs !== null ? formatXZeit(anzeige.laufzeitMs) : "–");
        this.setText("cockpitFortschritt", `${anzeige.ist}/${anzeige.gesamt}`);
        this.setText("cockpitBasisHinweis", anzeige.basisHinweis);

        const badge = document.getElementById("cockpitPlanBadge");
        if (badge) {
            if (anzeige.soll === null) {
                badge.className = "badge bg-secondary";
                badge.textContent = "–";
            } else {
                const status = berechnePlanStatus(anzeige.ist, anzeige.soll);
                badge.className = `badge ${status.css}`;
                badge.textContent = status.label;
            }
        }
    }

    public setCockpitBasisInputValue(value: string): void {
        const input = document.getElementById("cockpitXZeitBasisInput") as HTMLInputElement | null;
        if (input) {
            input.value = value;
        }
    }

    public bindCockpitEvents(onBasisChange: (value: string) => void, onJetzt: () => void): void {
        document.getElementById("cockpitXZeitBasisInput")?.addEventListener("change", e => {
            onBasisChange((e.target as HTMLInputElement).value);
        });
        document.getElementById("btn-cockpit-xzeit-jetzt")?.addEventListener("click", onJetzt);
    }

    private setText(id: string, text: string): void {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    public renderTeilnehmerListe(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean,
        fortschritt: Record<string, TeilnehmerFortschritt> = {}
    ): void {
        this.teilnehmerView.render(uebung, teilnehmerStatus, showStaerkeDetails, fortschritt);
    }

    public bindTeilnehmerEvents(callbacks: {
        onAnmelden: (name: string) => void;
        onLoesungswort: (name: string, val: string) => void;
        onStaerke: (name: string, idx: number, val: string) => void;
        onNotiz: (name: string, val: string) => void;
        onToggleDetails: () => void;
        onDownloadDebrief: (name: string) => void;
    }): void {
        this.teilnehmerView.bindEvents(callbacks);
    }

    public renderNachrichtenListe(options: {
        nachrichten: FlattenedNachricht[];
        nachrichtenStatus: Record<string, NachrichtenStatus | EffektiverNachrichtenStatus>;
        hideAbgesetzt: boolean;
        senderFilter: string;
        empfaengerFilter: string;
        textFilter: string;
    }): void {
        this.nachrichtenView.render({
            nachrichten: options.nachrichten,
            nachrichtenStatus: options.nachrichtenStatus,
            hideAbgesetzt: options.hideAbgesetzt,
            senderFilter: options.senderFilter,
            empfaengerFilter: options.empfaengerFilter,
            textFilter: options.textFilter
        });
    }

    public updateProgress(total: number, done: number, etaLabel: string, nurGemeldet = 0): void {
        this.nachrichtenView.updateProgress(total, done, etaLabel, nurGemeldet);
    }

    public updateOperationalStats(tempoLabel: string, loadLabel: string, heatmapLabel: string): void {
        this.nachrichtenView.updateOperationalStats(tempoLabel, loadLabel, heatmapLabel);
    }

    public updateHeatmap(bins: HeatmapBin[]): void {
        this.nachrichtenView.updateHeatmap(bins);
    }

    public updateTeilnehmerTimeline(entries: TeilnehmerTimeline[]): void {
        this.nachrichtenView.updateTeilnehmerTimeline(entries);
    }

    public bindNachrichtenEvents(callbacks: {
        onAbgesetzt: (sender: string, nr: number) => void;
        onReset: (sender: string, nr: number) => void;
        onNotiz: (sender: string, nr: number, val: string) => void;
        onFilterSender: (val: string) => void;
        onFilterEmpfaenger: (val: string) => void;
        onToggleHide: (val: boolean) => void;
        onFilterText: (val: string) => void;
    }): void {
        this.nachrichtenView.bindEvents(callbacks);
    }

    private buildMetaHtml(uebung: Uebung, uebungId: string): string {
        const safeName = escapeHtml(uebung.name || "–");
        const safeDatum = escapeHtml(formatNatoDate(uebung.datum));
        const safeRufgruppe = escapeHtml(uebung.rufgruppe || "–");
        const safeLeitung = escapeHtml(uebung.leitung || "–");
        const safeCount = escapeHtml(String(uebung.teilnehmerListe?.length ?? 0));
        const safeUebungId = escapeHtml(uebungId);
        const safeUebungCode = escapeHtml((uebung.uebungCode || "–").toUpperCase());

        return `
          <div class="row">
            <div class="col-md-6 mb-2">
              <strong>Name der Übung:</strong><br>${safeName}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Datum:</strong><br>${safeDatum}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Rufgruppe:</strong><br>${safeRufgruppe}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Übungsleitung:</strong><br>${safeLeitung}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Anzahl Teilnehmer:</strong><br>${safeCount}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Übungs-ID:</strong><br><code>${safeUebungId}</code>
            </div>
            <div class="col-md-6 mb-2">
              <strong>Übungscode:</strong><br><code>${safeUebungCode}</code>
            </div>
            <div class="col-12 mt-3 d-flex justify-content-end">
            <button
              class="btn btn-outline-secondary me-2"
              id="exportUebungsleitungPdf"
             >
              📄 Übungsleitung als PDF
            </button>

            <button
              class="btn btn-outline-secondary me-2"
              id="exportTeilnehmerUebersichtPdf"
             >
              📄 Alle Teilnehmer-Übersichten als PDF
            </button>

              <button
                class="btn btn-outline-danger"
                id="resetUebungsleitungLocalData"
               >
                ⟲ Lokale Übungsdaten zurücksetzen
              </button>
            </div>

          </div>
        `;
    }
}

export type { FlattenedNachricht, HeatmapBin, TeilnehmerTimeline };
