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

    public bindMetaEvents(onPdfExport: () => void, onReset: () => void): void {
        document.getElementById("exportUebungsleitungPdf")?.addEventListener("click", onPdfExport);
        document.getElementById("resetUebungsleitungLocalData")?.addEventListener("click", onReset);
    }

    public renderTeilnehmerListe(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean
    ): void {
        this.teilnehmerView.render(uebung, teilnehmerStatus, showStaerkeDetails);
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
        nachrichtenStatus: Record<string, NachrichtenStatus>;
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

    public updateProgress(total: number, done: number, etaLabel: string): void {
        this.nachrichtenView.updateProgress(total, done, etaLabel);
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
              data-analytics-id="uebungsleitung-export-pdf">
              📄 Übungsleitung als PDF
            </button>

              <button
                class="btn btn-outline-danger"
                id="resetUebungsleitungLocalData"
                data-analytics-id="uebungsleitung-reset-local-data">
                ⟲ Lokale Übungsdaten zurücksetzen
              </button>
            </div>

          </div>
        `;
    }
}

export type { FlattenedNachricht, HeatmapBin, TeilnehmerTimeline };
