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
import { UebungsleitungTeilnehmerView, type TeilnehmerZusatz } from "./UebungsleitungTeilnehmerView";
import type { LiveSyncState } from "../types/LiveStatus";
import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { berechnePlanStatus, formatLaufzeit, formatXZeit } from "../utils/xzeit";
import { faelligkeitLabel, formatUhrzeit, type Faelligkeit, type LageTeilnehmer, type PlanZustand } from "./lagebild";

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
    /** Vorgeschlagene Basis (geplanter Beginn oder Rollenspieler) – mit Knopf „übernehmen“. */
    vorschlag?: string | null;
    /** Rollen, die mit einer abweichenden Basis laufen, z. B. "Kater 10 (19:18)". */
    abweichungen?: string[];
}

export interface LageAnzeige {
    teilnehmer: LageTeilnehmer[];
    naechste: { planNr: number; sender: string; empfaenger: string[]; faelligkeit?: Faelligkeit }[];
    /** Vom Teilnehmer gemeldet, von der Leitung noch nicht bestätigt. */
    zuBestaetigen: number;
    hideAbgesetzt: boolean;
    ueberfaellig: number;
}

/** Wie lange das Rückgängig-Angebot stehen bleibt. */
export const RUECKGAENGIG_MS = 10000;

export class UebungsleitungView {
    private teilnehmerView = new UebungsleitungTeilnehmerView();
    private nachrichtenView = new UebungsleitungNachrichtenView();
    private undoTimer: ReturnType<typeof setTimeout> | null = null;

    public renderMeta(uebung: Uebung, uebungId: string): void {
        const metaEl = document.getElementById("uebungsleitungMeta");
        if (metaEl) {
            metaEl.innerHTML = this.buildMetaHtml(uebung, uebungId);
        }
        const gefahr = document.getElementById("uebungsleitungGefahrenbereichBody");
        if (gefahr) {
            gefahr.innerHTML = this.buildGefahrenbereichHtml();
        }
    }

    /**
     * Ersetzt die leeren Karten durch eine klare Meldung mit Weiter-Weg
     * (THW-Review error-recovery P1-1).
     */
    public showLadefehler(meldung: string, uebungId?: string): void {
        const area = document.getElementById("uebungsleitungArea");
        area?.querySelectorAll<HTMLElement>(".card").forEach(card => {
            if (!card.querySelector("#uebungsleitungMeta")) {
                card.classList.add("d-none");
            }
        });
        const metaEl = document.getElementById("uebungsleitungMeta");
        if (!metaEl) {
            return;
        }
        const idHinweis = uebungId
            ? `<div class="small mt-2">Geprüfte Übungs-ID: <code>${escapeHtml(uebungId)}</code></div>`
            : "";
        metaEl.innerHTML = `
          <div class="alert alert-warning mb-0" role="alert" data-testid="uebungsleitung-ladefehler">
            <strong>${escapeHtml(meldung)}</strong>
            ${idHinweis}
            <div class="d-flex flex-wrap gap-2 mt-3">
              <a class="btn btn-outline-primary" href="#/admin">Gespeicherte Übungen öffnen</a>
              <a class="btn btn-outline-secondary" href="#/generator">Neue Übung erstellen</a>
            </div>
          </div>`;
    }

    public bindMetaEvents(onPdfExport: () => void, onReset: () => void, onUebersichtExport?: () => void): void {
        document.getElementById("exportUebungsleitungPdf")?.addEventListener("click", onPdfExport);
        document.getElementById("resetUebungsleitungLocalData")?.addEventListener("click", onReset);
        if (onUebersichtExport) {
            document.getElementById("exportTeilnehmerUebersichtPdf")?.addEventListener("click", onUebersichtExport);
        }
    }

    /**
     * Beschriftet den Rücksetz-Knopf nach seiner tatsächlichen Reichweite
     * (THW-Review destructive-action P0-1).
     */
    public setResetModus(fuerAlle: boolean): void {
        const btn = document.getElementById("resetUebungsleitungLocalData");
        const text = document.getElementById("uebungsleitungResetText");
        if (btn) {
            btn.textContent = fuerAlle
                ? "⟲ Übungsstand für alle zurücksetzen"
                : "⟲ Daten der Übungsleitung auf diesem Gerät löschen";
        }
        if (text) {
            text.textContent = fuerAlle
                ? "Löscht abgesetzt-Markierungen, Zeiten, Notizen und Anmeldungen – auf allen Leitungs-Arbeitsplätzen und bei allen Teilnehmern. Nicht rückgängig zu machen."
                : "Löscht abgesetzt-Markierungen, Zeiten, Notizen und Anmeldungen auf diesem Gerät. Nicht rückgängig zu machen.";
        }
    }

    /** Reicht den Live-Sync-Status an die Nachrichten-Ansicht durch. */
    public updateLiveSyncState(state: LiveSyncState, offeneAenderungen = 0): void {
        this.nachrichtenView.updateLiveSyncState(state, offeneAenderungen);
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
        this.setText(
            "cockpitAbweichungen",
            anzeige.abweichungen?.length ? `Eigene Basis bei: ${anzeige.abweichungen.join(", ")}` : ""
        );

        const vorschlagBtn = document.getElementById("btn-cockpit-xzeit-vorschlag");
        if (vorschlagBtn) {
            vorschlagBtn.classList.toggle("d-none", !anzeige.vorschlag);
            vorschlagBtn.textContent = anzeige.vorschlag ? `${anzeige.vorschlag} übernehmen` : "";
            vorschlagBtn.dataset["basis"] = anzeige.vorschlag ?? "";
        }

        const badge = document.getElementById("cockpitPlanBadge");
        if (badge) {
            if (anzeige.soll === null) {
                badge.className = "badge border-0 bg-secondary";
                badge.textContent = "–";
            } else {
                const status = berechnePlanStatus(anzeige.ist, anzeige.soll);
                badge.className = `badge border-0 ${status.css}`;
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

    public bindCockpitEvents(
        onBasisChange: (value: string) => void,
        onJetzt: () => void,
        onVorschlag?: (value: string) => void,
        onPlanBadge?: () => void
    ): void {
        document.getElementById("cockpitXZeitBasisInput")?.addEventListener("change", e => {
            onBasisChange((e.target as HTMLInputElement).value);
        });
        document.getElementById("btn-cockpit-xzeit-jetzt")?.addEventListener("click", onJetzt);
        const vorschlagBtn = document.getElementById("btn-cockpit-xzeit-vorschlag");
        vorschlagBtn?.addEventListener("click", () => {
            const basis = vorschlagBtn.dataset["basis"];
            if (basis && onVorschlag) {
                onVorschlag(basis);
            }
        });
        if (onPlanBadge) {
            document.getElementById("cockpitPlanBadge")?.addEventListener("click", onPlanBadge);
        }
    }

    /** Scrollt zur ersten Plan-Zeile im Zustand (z. B. überfällig). */
    public scrollZuPlanZustand(zustand: PlanZustand): void {
        const zeile = document.querySelector<HTMLElement>(`#uebungsleitungNachrichten tr[data-plan-zustand="${zustand}"]`);
        this.hebeHervor(zeile);
    }

    public scrollZuPlanNr(planNr: number): void {
        const zeile = document.querySelector<HTMLElement>(`#uebungsleitungNachrichten tr[data-plan-nr="${planNr}"]`);
        this.hebeHervor(zeile);
    }

    private hebeHervor(el: HTMLElement | null): void {
        if (!el) {
            return;
        }
        el.scrollIntoView?.({ behavior: "smooth", block: "center" });
        el.classList.add("plan-zeile--ziel");
        setTimeout(() => el.classList.remove("plan-zeile--ziel"), 2000);
    }

    private setText(id: string, text: string): void {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    /**
     * Lagezeile oben: offen je Teilnehmer, was als Nächstes dran ist, und die
     * Wege zu Filter und Auswertung (THW-Review command P1-3).
     */
    public renderLage(lage: LageAnzeige): void {
        const body = document.getElementById("uebungsleitungLageBody");
        if (!body) {
            return;
        }
        const teilnehmer = lage.teilnehmer.length
            ? lage.teilnehmer.map(t => {
                const css = t.offen === 0 ? "lage-chip lage-chip--fertig" : "lage-chip";
                const bestaetigen = t.nurGemeldet > 0 ? `, ${t.nurGemeldet} zu bestätigen` : "";
                return `<span class="${css}" title="${escapeHtml(t.teilnehmer)}: ${t.offen} von ${t.gesamt} offen${bestaetigen}">${escapeHtml(t.teilnehmer)}: <strong>${t.offen === 0 ? "fertig" : `${t.offen} offen`}</strong>${bestaetigen}</span>`;
            }).join("")
            : "<span class=\"text-body-secondary\">Keine Nachrichten.</span>";

        const naechste = lage.naechste.length
            ? lage.naechste.map(n => {
                const f = n.faelligkeit;
                const zeit = f ? ` · ${formatUhrzeit(f.sollMs)} · ${faelligkeitLabel(f)}` : "";
                return `<button type="button" class="btn btn-sm btn-outline-secondary lage-naechste" data-action="zu-plan-nr" data-plan-nr="${n.planNr}">Nr. ${n.planNr} · ${escapeHtml(n.sender)} → ${escapeHtml(n.empfaenger.join(", "))}${zeit}</button>`;
            }).join("")
            : "<span class=\"text-body-secondary\">Alles erledigt.</span>";

        body.innerHTML = `
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <strong class="me-1">Lage:</strong>
            ${teilnehmer}
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <strong class="me-1">Als Nächstes:</strong>
            ${naechste}
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
            ${lage.ueberfaellig > 0 ? `<button type="button" class="btn btn-sm btn-danger" data-action="zu-ueberfaellig">${lage.ueberfaellig} überfällig – zur ersten</button>` : ""}
            ${lage.zuBestaetigen > 0 ? `<button type="button" class="btn btn-sm btn-outline-primary" data-action="gemeldete-bestaetigen" title="Übernimmt alle vom Teilnehmer gemeldeten Nachrichten mit der Uhrzeit der Teilnehmer-Meldung">${lage.zuBestaetigen} gemeldete bestätigen</button>` : ""}
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="lage-hide" aria-pressed="${lage.hideAbgesetzt}">${lage.hideAbgesetzt ? "Abgesetzte wieder zeigen" : "Abgesetzte ausblenden"}</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="zu-auswertung">Heatmap &amp; Timeline</button>
          </div>`;
    }

    public bindLageEvents(callbacks: {
        onGemeldeteBestaetigen: () => void;
        onToggleHide: (val: boolean) => void;
    }): void {
        const body = document.getElementById("uebungsleitungLageBody");
        body?.addEventListener("click", e => {
            const btn = (e.target as HTMLElement).closest<HTMLElement>("button[data-action]");
            const action = btn?.dataset["action"];
            if (!btn || !action) {
                return;
            }
            if (action === "gemeldete-bestaetigen") {
                callbacks.onGemeldeteBestaetigen();
            } else if (action === "lage-hide") {
                callbacks.onToggleHide(btn.getAttribute("aria-pressed") !== "true");
            } else if (action === "zu-auswertung") {
                this.hebeHervor(document.getElementById("nachrichtenAuswertung"));
            } else if (action === "zu-ueberfaellig") {
                this.scrollZuPlanZustand("ueberfaellig");
            } else if (action === "zu-plan-nr") {
                this.scrollZuPlanNr(Number(btn.dataset["planNr"]));
            }
        });
    }

    /**
     * Rückgängig-Leiste nach einer Rücknahme – statt einer Rückfrage, die
     * reflexartig weggeklickt wird.
     */
    public zeigeRueckgaengig(meldung: string, onUndo: () => void): void {
        const el = document.getElementById("uebungsleitungUndo");
        if (!el) {
            return;
        }
        if (this.undoTimer !== null) {
            clearTimeout(this.undoTimer);
        }
        el.innerHTML = `<span>${escapeHtml(meldung)}</span>
            <button type="button" class="btn btn-sm btn-light" data-action="undo">Rückgängig</button>
            <button type="button" class="btn btn-sm btn-link text-reset" data-action="undo-schliessen" aria-label="Hinweis schließen">✕</button>`;
        el.classList.remove("d-none");
        const schliessen = () => {
            el.classList.add("d-none");
            el.innerHTML = "";
            if (this.undoTimer !== null) {
                clearTimeout(this.undoTimer);
                this.undoTimer = null;
            }
        };
        el.querySelector("[data-action='undo']")?.addEventListener("click", () => {
            schliessen();
            onUndo();
        }, { once: true });
        el.querySelector("[data-action='undo-schliessen']")?.addEventListener("click", schliessen, { once: true });
        this.undoTimer = setTimeout(schliessen, RUECKGAENGIG_MS);
    }

    public renderTeilnehmerListe(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean,
        zusatz: TeilnehmerZusatz = {}
    ): void {
        this.teilnehmerView.render(uebung, teilnehmerStatus, showStaerkeDetails, zusatz);
    }

    public bindTeilnehmerEvents(callbacks: {
        onAnmelden: (name: string) => void;
        onAnmeldungZuruecknehmen?: (name: string) => void;
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
        faelligkeit?: Record<string, Faelligkeit>;
        sollUhrzeit?: Record<string, string>;
        ruecknahmeGesperrt?: Set<string>;
    }): void {
        this.nachrichtenView.render(options);
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
        onZeitNachtragen?: (sender: string, nr: number, hhmm: string) => void;
        onNotiz: (sender: string, nr: number, val: string) => void;
        onFilterSender: (val: string) => void;
        onFilterEmpfaenger: (val: string) => void;
        onToggleHide: (val: boolean) => void;
        onFilterText: (val: string) => void;
    }): void {
        this.nachrichtenView.bindEvents(callbacks);
    }

    /**
     * Kopf kompakt: Lageinformation statt technischer Kennungen. Der
     * Übungscode ist für Nachzügler wichtig, die UUID braucht im Ablauf niemand.
     */
    private buildMetaHtml(uebung: Uebung, uebungId: string): string {
        const safeName = escapeHtml(uebung.name || "–");
        const safeDatum = escapeHtml(formatNatoDate(uebung.datum));
        const safeRufgruppe = escapeHtml(uebung.rufgruppe || "–");
        const safeLeitung = escapeHtml(uebung.leitung || "–");
        const safeCount = escapeHtml(String(uebung.teilnehmerListe?.length ?? 0));
        const safeUebungId = escapeHtml(uebungId);
        const safeUebungCode = escapeHtml((uebung.uebungCode || "–").toUpperCase());

        return `
          <div class="d-flex flex-wrap gap-3 align-items-baseline uebungsleitung-kopf">
            <div><strong>${safeName}</strong></div>
            <div><span class="text-body-secondary">Datum</span> ${safeDatum}</div>
            <div><span class="text-body-secondary">Rufgruppe</span> ${safeRufgruppe}</div>
            <div><span class="text-body-secondary">Übungsleitung</span> ${safeLeitung}</div>
            <div><span class="text-body-secondary">Teilnehmer</span> ${safeCount}</div>
            <div><span class="text-body-secondary">Übungscode</span> <code class="fs-6">${safeUebungCode}</code></div>
          </div>
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
            <small class="text-body-secondary">Übungs-ID: <code>${safeUebungId}</code></small>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary" id="exportUebungsleitungPdf">📄 Übungsleitung als PDF</button>
              <button class="btn btn-outline-secondary" id="exportTeilnehmerUebersichtPdf">📄 Alle Teilnehmer-Übersichten als PDF</button>
            </div>
          </div>
        `;
    }

    /** Folgenschwere Aktion abgesetzt am Seitenende, nicht neben den Exporten. */
    private buildGefahrenbereichHtml(): string {
        return `
          <h3 class="h6 text-danger-emphasis mb-2">Übungsstand zurücksetzen</h3>
          <p class="small text-body-secondary mb-2" id="uebungsleitungResetText"></p>
          <button class="btn btn-outline-danger" id="resetUebungsleitungLocalData">⟲ Übungsstand zurücksetzen</button>
        `;
    }
}

export type { FlattenedNachricht, HeatmapBin, TeilnehmerTimeline };
