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
import type { Faelligkeit, PlanZustand } from "./lagebild";
import { renderLageHtml, type LageAnzeige } from "./lageMarkup";
import type { NachrichtenCallbacks } from "./nachrichtenTypen";

export type { LageAnzeige } from "./lageMarkup";

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
    /** Beschriftung des Vorschlag-Knopfs, z. B. „19:30 übernehmen (liegt 97 min zurück)“. */
    vorschlagLabel?: string;
    /** Ist schon eine Basis gesetzt? Dann heißt „Jetzt starten“ „Neu starten“. */
    basisGesetzt?: boolean;
    /** Offene Zeilen mit erreichter Soll-Zeit – dieselbe Zahl wie in der Lagezeile. */
    hinterPlan?: { ueberfaellig: number; faellig: number } | null;
}

/** Wie lange das Rückgängig-Angebot stehen bleibt. */
export const RUECKGAENGIG_MS = 10000;

export class UebungsleitungView {
    private teilnehmerView = new UebungsleitungTeilnehmerView();
    private nachrichtenView = new UebungsleitungNachrichtenView();
    private undoTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     * Die Container stehen fest im Dokument; ohne Abbruch blieben die Listener
     * einer früheren Ansicht hängen und jede Aktion liefe doppelt
     * (THW-Review 2026-10-05, offline P3-4: zwei Debrief-Downloads je Klick).
     */
    private abort: AbortController | null = null;

    /**
     * Signal aus dem AbortController des Fensters, in dem die Container leben –
     * im Browser derselbe, in Tests der des Test-DOM.
     */
    private get signal(): AbortSignal {
        if (!this.abort) {
            const fenster = (globalThis as { window?: { AbortController?: typeof AbortController } }).window;
            this.abort = new (fenster?.AbortController ?? AbortController)();
        }
        return this.abort.signal;
    }

    /** Löst alle Listener dieser Ansicht und schließt die Rückgängig-Leiste. */
    public dispose(): void {
        this.abort?.abort();
        this.schliesseRueckgaengig();
    }

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
        const opt = { signal: this.signal };
        document.getElementById("exportUebungsleitungPdf")?.addEventListener("click", onPdfExport, opt);
        document.getElementById("resetUebungsleitungLocalData")?.addEventListener("click", onReset, opt);
        if (onUebersichtExport) {
            document.getElementById("exportTeilnehmerUebersichtPdf")?.addEventListener("click", onUebersichtExport, opt);
        }
    }

    /**
     * Teilnehmertabelle ein- und ausklappen: Wer im Plan abhakt, scrollt sonst
     * jedes Mal an Stärke- und Notizfeldern vorbei (THW-Review 2026-10-05,
     * command P3-2, stress-test P2-3).
     */
    public setTeilnehmerEingeklappt(eingeklappt: boolean): void {
        document.getElementById("uebungsleitungTeilnehmer")?.classList.toggle("d-none", eingeklappt);
        const btn = document.getElementById("btn-teilnehmer-einklappen");
        if (btn) {
            btn.setAttribute("aria-expanded", String(!eingeklappt));
            btn.textContent = eingeklappt ? "Teilnehmer zeigen" : "Teilnehmer einklappen";
        }
    }

    public bindTeilnehmerEinklappen(onToggle: () => void): void {
        document.getElementById("btn-teilnehmer-einklappen")?.addEventListener("click", onToggle, { signal: this.signal });
    }

    /** Einmalige Bestätigung nach „für alle zurücksetzen“ und dem Neuladen. */
    public zeigeZurueckgesetzt(umIso: string): void {
        const el = document.getElementById("uebungsleitungResetErfolg");
        if (!el) {
            return;
        }
        const um = new Date(umIso);
        const uhrzeit = `${String(um.getHours()).padStart(2, "0")}:${String(um.getMinutes()).padStart(2, "0")}`;
        el.textContent = `Übungsstand für alle zurückgesetzt (um ${uhrzeit}).`;
        el.classList.remove("d-none");
        globalThis.scrollTo?.({ top: 0 });
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
            vorschlagBtn.textContent = anzeige.vorschlag ? (anzeige.vorschlagLabel || `${anzeige.vorschlag} übernehmen`) : "";
            vorschlagBtn.dataset["basis"] = anzeige.vorschlag ?? "";
        }
        // Läuft die Übung schon, ist „Jetzt starten“ ein Neustart für alle
        // (THW-Review 2026-10-05, destructive-action P1-1).
        this.setText("btn-cockpit-xzeit-jetzt", anzeige.basisGesetzt ? "Neu starten (verschiebt alle Zeiten)" : "Jetzt starten");
        this.updatePlanBadge(anzeige);
    }

    /**
     * „n hinter Plan“ zählt dieselben Zeilen wie die Lagezeile („überfällig“
     * plus „jetzt fällig“) – zwei Zahlen ohne Erklärung verwirrten
     * (THW-Review 2026-10-05, command P3-1).
     */
    private updatePlanBadge(anzeige: CockpitAnzeige): void {
        const badge = document.getElementById("cockpitPlanBadge");
        if (!badge) {
            return;
        }
        if (anzeige.soll === null) {
            badge.className = "badge border-0 bg-secondary";
            badge.textContent = "–";
            return;
        }
        const hinter = anzeige.hinterPlan;
        const status = hinter
            ? berechnePlanStatus(0, hinter.ueberfaellig + hinter.faellig)
            : berechnePlanStatus(anzeige.ist, anzeige.soll);
        badge.className = `badge border-0 ${status.css}`;
        badge.textContent = status.label;
        if (hinter) {
            badge.setAttribute("title", `${hinter.ueberfaellig} überfällig, ${hinter.faellig} jetzt fällig – antippen springt zur ersten`);
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
        const opt = { signal: this.signal };
        document.getElementById("cockpitXZeitBasisInput")?.addEventListener("change", e => {
            onBasisChange((e.target as HTMLInputElement).value);
        }, opt);
        document.getElementById("btn-cockpit-xzeit-jetzt")?.addEventListener("click", onJetzt, opt);
        const vorschlagBtn = document.getElementById("btn-cockpit-xzeit-vorschlag");
        vorschlagBtn?.addEventListener("click", () => {
            const basis = vorschlagBtn.dataset["basis"];
            if (basis && onVorschlag) {
                onVorschlag(basis);
            }
        }, opt);
        if (onPlanBadge) {
            document.getElementById("cockpitPlanBadge")?.addEventListener("click", onPlanBadge, opt);
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

    /** Lagezeile oben (Inhalt: {@link renderLageHtml}). */
    public renderLage(lage: LageAnzeige): void {
        const body = document.getElementById("uebungsleitungLageBody");
        if (body) {
            body.innerHTML = renderLageHtml(lage);
        }
    }

    public bindLageEvents(callbacks: {
        onGemeldeteBestaetigen: () => void;
        onToggleHide: (val: boolean) => void;
    }): void {
        const body = document.getElementById("uebungsleitungLageBody");
        const ziele: Record<string, (btn: HTMLElement) => void> = {
            "gemeldete-bestaetigen": () => callbacks.onGemeldeteBestaetigen(),
            "lage-hide": btn => callbacks.onToggleHide(btn.getAttribute("aria-pressed") !== "true"),
            "zu-auswertung": () => this.hebeHervor(document.getElementById("nachrichtenAuswertung")),
            "zu-ueberfaellig": btn => this.scrollZuPlanZustand(btn.dataset["ziel"] === "faellig" ? "faellig" : "ueberfaellig"),
            "zu-plan-nr": btn => this.scrollZuPlanNr(Number(btn.dataset["planNr"])),
            "zu-zuruecksetzen": () => this.hebeHervor(document.getElementById("uebungsleitungGefahrenbereich"))
        };
        body?.addEventListener("click", e => {
            const btn = (e.target as HTMLElement).closest<HTMLElement>("button[data-action]");
            const aktion = btn ? ziele[btn.dataset["action"] ?? ""] : undefined;
            if (btn && aktion) {
                aktion(btn);
            }
        }, { signal: this.signal });
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
        document.getElementById("uebungsleitungArea")?.classList.add("ul-undo-offen");
        el.querySelector("[data-action='undo']")?.addEventListener("click", () => {
            this.schliesseRueckgaengig();
            onUndo();
        }, { once: true });
        el.querySelector("[data-action='undo-schliessen']")?.addEventListener("click", () => this.schliesseRueckgaengig(), { once: true });
        this.undoTimer = setTimeout(() => this.schliesseRueckgaengig(), RUECKGAENGIG_MS);
    }

    /**
     * Schließt die Rückgängig-Leiste – auch, sobald eine neue Aktion kommt: Ein
     * „Rückgängig“ darf sich nie auf eine ältere Aktion beziehen als die
     * zuletzt sichtbare (THW-Review 2026-10-05, error-recovery P3-2).
     */
    public schliesseRueckgaengig(): void {
        const el = document.getElementById("uebungsleitungUndo");
        if (el) {
            el.classList.add("d-none");
            el.innerHTML = "";
        }
        document.getElementById("uebungsleitungArea")?.classList.remove("ul-undo-offen");
        if (this.undoTimer !== null) {
            clearTimeout(this.undoTimer);
            this.undoTimer = null;
        }
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
        this.teilnehmerView.bindEvents(callbacks, this.signal);
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
        jetztMs?: number;
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

    public bindNachrichtenEvents(callbacks: NachrichtenCallbacks): void {
        this.nachrichtenView.bindEvents(callbacks, this.signal);
    }

    /**
     * Kopf kompakt: Lageinformation statt technischer Kennungen. Der
     * Übungscode ist für Nachzügler wichtig, die UUID braucht im Ablauf niemand.
     */
    private buildMetaHtml(uebung: Uebung, uebungId: string): string {
        const safeName = escapeHtml(uebung.name || "–");
        // Das Übungsdatum als Datum, nicht als DTG mit „0000“ (THW-Review 2026-10-05, workflow W9).
        const safeDatum = escapeHtml(formatDatum(uebung.datum));
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
            <div><span class="text-body-secondary" title="Teilnehmer brauchen ihn zusammen mit ihrem Teilnehmercode">Übungscode</span> <code class="fs-6">${safeUebungCode}</code></div>
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
          <h3 class="h6 ul-gefahr-titel mb-2">⚠ Übungsstand zurücksetzen</h3>
          <p class="small text-body-secondary mb-2" id="uebungsleitungResetText"></p>
          <button class="btn btn-outline-danger" id="resetUebungsleitungLocalData">⟲ Übungsstand zurücksetzen</button>
        `;
    }
}

/** „05.10.2026“ – leer bzw. „–“, wenn kein gültiges Datum vorliegt. */
function formatDatum(wert: unknown): string {
    const d = wert instanceof Date ? wert : new Date(String(wert ?? ""));
    if (Number.isNaN(d.getTime())) {
        return formatNatoDate(wert, false);
    }
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export type { FlattenedNachricht, HeatmapBin, TeilnehmerTimeline };
