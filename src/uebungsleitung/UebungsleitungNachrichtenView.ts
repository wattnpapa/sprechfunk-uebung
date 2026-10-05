import type { LiveSyncState } from "../types/LiveStatus";
import { statusKey } from "./lagebild";
import { passesFilter, renderNachrichtenRow, renderNachrichtenTabelle, type NachrichtenZeilenZustand } from "./nachrichtenMarkup";
import { renderHeatmap, renderTeilnehmerTimeline } from "./nachrichtenDiagramme";
import type {
    HeatmapBin,
    NachrichtenCallbacks,
    NachrichtenRenderOptionen,
    TeilnehmerTimeline
} from "./nachrichtenTypen";

export type {
    FlattenedNachricht,
    HeatmapBin,
    NachrichtenRenderOptionen,
    TeilnehmerTimeline
} from "./nachrichtenTypen";

function liveSyncLabel(state: LiveSyncState, offeneAenderungen: number): { text: string; css: string; title: string } {
    const offen = offeneAenderungen > 0 ? ` (${offeneAenderungen} warten)` : "";
    const labels: Record<LiveSyncState, { text: string; css: string; title: string }> = {
        aus: { text: "Live-Status: aus", css: "bg-secondary", title: "Live-Sync deaktiviert – es zählt nur, was auf diesem Gerät markiert wird." },
        verbinde: { text: "Live-Status: verbinde…", css: "bg-secondary", title: "Verbindung wird aufgebaut." },
        live: { text: "Live-Status: live", css: "bg-success", title: "Der Server hat die letzten Änderungen bestätigt; Teilnehmer-Meldungen treffen live ein." },
        offline: {
            text: `Live-Status: offline – wird nachgereicht${offen}`,
            css: "bg-warning text-dark",
            title: "Keine Verbindung. Deine Markierungen liegen auf diesem Gerät und werden übertragen, sobald wieder Netz da ist. Lade die Seite bis dahin nicht neu. Angezeigt wird der zuletzt bekannte Stand der Teilnehmer."
        },
        fehler: {
            text: "Live-Status: Fehler – wird nicht übertragen",
            css: "bg-danger",
            title: "Der Server lehnt die Änderungen ab. Sie bleiben nur auf diesem Gerät. Halte den Stand auf Papier fest."
        }
    };
    return labels[state];
}

type KlickAktion = (sender: string, nr: number, container: HTMLElement, btn: HTMLElement) => void;

export class UebungsleitungNachrichtenView {
    private zustand: NachrichtenZeilenZustand = { zeitEditKey: null, offeneNotizen: new Set<string>() };
    private letzteOptionen: NachrichtenRenderOptionen | null = null;

    public render(options: NachrichtenRenderOptionen): void {
        this.letzteOptionen = options;
        const { nachrichten } = options;
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        if (!nachrichten.length) {
            container.innerHTML = "<em>Keine Nachrichten vorhanden.</em>";
            return;
        }
        // Seitwärts gescrollte Tabelle (Tablet/Handy) nach dem Neuaufbau nicht nach links springen lassen.
        const scrollLeft = container.querySelector<HTMLElement>(".table-responsive")?.scrollLeft ?? 0;

        const zeigeXZeit = nachrichten.some(n => n.xZeitSlot !== undefined);
        const rows = nachrichten
            .filter(n => passesFilter(n, options))
            .map(n => renderNachrichtenRow(n, options, zeigeXZeit, this.zustand))
            .join("");

        container.innerHTML = renderNachrichtenTabelle(options, rows, zeigeXZeit);
        const tabelle = container.querySelector<HTMLElement>(".table-responsive");
        if (tabelle && scrollLeft) {
            tabelle.scrollLeft = scrollLeft;
        }
    }

    private rerender(): void {
        if (this.letzteOptionen) {
            this.render(this.letzteOptionen);
        }
    }

    private klickAktionen(callbacks: NachrichtenCallbacks): Map<string, KlickAktion> {
        return new Map<string, KlickAktion>([
            ["abgesetzt", (sender, nr) => callbacks.onAbgesetzt(sender, nr)],
            ["reset", (sender, nr) => callbacks.onReset(sender, nr)],
            ["zeit-bearbeiten", (sender, nr, container) => {
                this.zustand.zeitEditKey = statusKey(sender, nr);
                this.rerender();
                container.querySelector<HTMLInputElement>("input.ul-zeit-input")?.focus();
            }],
            ["zeit-abbrechen", () => {
                this.zustand.zeitEditKey = null;
                this.rerender();
            }],
            ["zeit-speichern", (sender, nr, container) => this.speichereZeit(container, sender, nr, callbacks)],
            ["notiz-oeffnen", (sender, nr, _container, btn) => this.oeffneNotiz(btn, sender, nr)],
            ["auslassen", (sender, nr) => callbacks.onAuslassen?.(sender, nr)],
            ["wieder-oeffnen", (sender, nr) => callbacks.onWiederOeffnen?.(sender, nr)],
            ["reaktion", (sender, nr, _container, btn) => {
                const wert = btn.dataset["reaktion"];
                if (wert === "erfolgt" || wert === "abweichend" || wert === "ausgeblieben") {
                    callbacks.onReaktion?.(sender, nr, wert);
                }
            }]
        ]);
    }

    /**
     * @param signal beendet alle Listener, wenn die Ansicht verlassen bzw. neu
     *               aufgebaut wird – der Container selbst bleibt im Dokument.
     */
    public bindEvents(callbacks: NachrichtenCallbacks, signal?: AbortSignal): void {
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        const opt: AddEventListenerOptions = signal ? { signal } : {};
        const aktionen = this.klickAktionen(callbacks);
        container.addEventListener("click", e => {
            const btn = (e.target as HTMLElement).closest("button");
            const sender = btn?.dataset["sender"];
            if (!btn || btn.disabled || !sender) {
                return;
            }
            aktionen.get(btn.dataset["action"] ?? "")?.(sender, Number(btn.dataset["nr"]), container, btn);
        }, opt);

        container.addEventListener("keydown", e => this.handleZeitTaste(e, container, callbacks), opt);

        container.addEventListener("change", e => {
            const target = e.target as HTMLInputElement | HTMLSelectElement;
            if (target.id === "senderFilterSelect") {
                callbacks.onFilterSender(target.value);
            }
            if (target.id === "empfaengerFilterSelect") {
                callbacks.onFilterEmpfaenger(target.value);
            }
            if (target.id === "toggleHideAbgesetzt") {
                callbacks.onToggleHide((target as HTMLInputElement).checked);
            }
        }, opt);

        container.addEventListener("input", e => this.handleEingabe(e.target as HTMLTextAreaElement | HTMLInputElement, callbacks), opt);
    }

    private handleZeitTaste(e: KeyboardEvent, container: HTMLElement, callbacks: NachrichtenCallbacks): void {
        const target = e.target as HTMLInputElement;
        if (!target.classList?.contains("ul-zeit-input")) {
            return;
        }
        const sender = target.dataset["sender"];
        const nr = Number(target.dataset["nr"]);
        if (e.key === "Enter" && sender) {
            e.preventDefault();
            this.speichereZeit(container, sender, nr, callbacks);
        } else if (e.key === "Escape") {
            this.zustand.zeitEditKey = null;
            this.rerender();
        }
    }

    private handleEingabe(target: HTMLTextAreaElement | HTMLInputElement, callbacks: NachrichtenCallbacks): void {
        if (target.id === "nachrichtenTextFilterInput") {
            callbacks.onFilterText(target.value);
            return;
        }
        if (!target.classList.contains("nachricht-notiz")) {
            return;
        }
        const nr = Number(target.dataset["nr"]);
        const sender = target.dataset["sender"];
        if (sender) {
            callbacks.onNotiz(sender, nr, target.value);
        }
    }

    private speichereZeit(container: HTMLElement, sender: string, nr: number, callbacks: NachrichtenCallbacks): void {
        const input = container.querySelector<HTMLInputElement>("input.ul-zeit-input");
        const wert = input?.value ?? "";
        this.zustand.zeitEditKey = null;
        if (wert && callbacks.onZeitNachtragen) {
            callbacks.onZeitNachtragen(sender, nr, wert);
            return;
        }
        this.rerender();
    }

    /** Notizfeld erst auf Wunsch – hält die Zeilen niedrig. */
    private oeffneNotiz(btn: HTMLElement, sender: string, nr: number): void {
        this.zustand.offeneNotizen.add(statusKey(sender, nr));
        const textarea = document.createElement("textarea");
        textarea.className = "form-control form-control-sm mt-2 nachricht-notiz";
        textarea.dataset["nr"] = String(nr);
        textarea.dataset["sender"] = sender;
        textarea.placeholder = "Notiz zur Nachricht…";
        btn.replaceWith(textarea);
        textarea.focus();
    }

    /**
     * @param done       erledigt laut Teilnehmer-Meldung oder Bestätigung der Leitung
     * @param nurGemeldet Teilmenge davon, die die Leitung noch nicht bestätigt hat
     */
    public updateProgress(total: number, done: number, etaLabel: string, nurGemeldet = 0): void {
        const bar = document.getElementById("nachrichtenProgressBar");
        const label = document.getElementById("nachrichtenProgressLabel");
        const eta = document.getElementById("nachrichtenEtaLabel");
        if (!bar || !label || !eta) {
            return;
        }
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        bar.style.width = `${percent}%`;
        bar.setAttribute("aria-valuenow", String(percent));
        label.textContent = nurGemeldet > 0
            ? `${done} / ${total} (${nurGemeldet} nur gemeldet)`
            : `${done} / ${total}`;
        eta.textContent = etaLabel;
    }

    /**
     * Zeigt ehrlich, ob die Änderungen beim Server ankommen. „offline“ heißt:
     * liegt lokal und wird nachgereicht; „Fehler“ heißt: wird nicht übertragen.
     */
    public updateLiveSyncState(state: LiveSyncState, offeneAenderungen = 0): void {
        const badge = document.getElementById("uebungsleitungLiveSyncBadge");
        if (!badge) {
            return;
        }
        const label = liveSyncLabel(state, offeneAenderungen);
        badge.className = `badge ${label.css}`;
        badge.textContent = label.text;
        badge.setAttribute("title", label.title);
        badge.dataset["state"] = state;
    }

    public updateOperationalStats(tempoLabel: string, loadLabel: string, heatmapLabel: string): void {
        const tempo = document.getElementById("nachrichtenTempoLabel");
        const load = document.getElementById("nachrichtenLoadLabel");
        const heatmap = document.getElementById("nachrichtenHeatmapLabel");
        if (!tempo || !load || !heatmap) {
            return;
        }
        tempo.textContent = tempoLabel;
        load.textContent = loadLabel;
        heatmap.textContent = heatmapLabel;
    }

    public updateHeatmap(bins: HeatmapBin[]): void {
        const chart = document.getElementById("nachrichtenHeatmapChart");
        if (chart) {
            renderHeatmap(chart, bins);
        }
    }

    public updateTeilnehmerTimeline(entries: TeilnehmerTimeline[]): void {
        const container = document.getElementById("nachrichtenTeilnehmerTimeline");
        if (container) {
            renderTeilnehmerTimeline(container, entries);
        }
    }
}
