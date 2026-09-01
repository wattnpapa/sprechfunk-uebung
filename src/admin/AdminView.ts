import { Uebung } from "../types/Uebung";
import { Chart } from "../core/chart";
import { funkspruchQuelleMerkmal, spielModusMerkmal, UebungsMerkmal } from "./uebungsMerkmale";

export interface AdminListHandlers {
    onView: (id: string) => void;
    onMonitor: (id: string) => void;
    onDelete: (id: string) => void;
    onOnlyTestFilterChange?: (checked: boolean) => void;
    onSearchChange?: (term: string) => void;
    onJahrChange?: (jahr: number | "alle") => void;
}

/** Ein Jahr mit Übungen als Auswahl für den Statistik-Filter. */
export interface JahresEintrag {
    jahr: number;
    anzahl: number;
}

export class AdminView {

    /** Wartezeit, bis eine Sucheingabe eine neue Abfrage auslöst. */
    private static readonly SUCHE_ENTPRELLUNG_MS = 250;

    private themeObserver: MutationObserver | null = null;
    private sucheTimer: ReturnType<typeof setTimeout> | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public renderStatistik(stats: any) {
        this.setText("infoGroesse", stats.totalKB);
        this.setText("infoTeilnehmer", stats.avgTeilnehmer);
        this.setText("infoDauer", stats.avgDauer);
        this.setText("infoLoesungswort", stats.pLoesungswort);
        this.setText("infoStaerke", stats.pStaerke);
        this.setText("infoBuchstabieren", stats.pBuchstabieren);
        this.setText("infoGesamtUebungen", stats.total.toString());
        this.setText("infoSpruecheProTeilnehmer", stats.avgSpruecheProTeilnehmer);
    }

    public renderUebungsListe(uebungen: Uebung[]) {
        const tbody = document.getElementById("adminUebungslisteBody");
        if (!tbody) {
            return;
        }
        
        tbody.innerHTML = "";

        uebungen.forEach(uebung => {
            const tr = document.createElement("tr");
            if (uebung.istStandardKonfiguration) {
                tr.classList.add("admin-standard-uebung-row");
            }
            tr.innerHTML = `
                <td>${uebung.createDate ? new Date(uebung.createDate).toLocaleString() : "-"}</td>
                <td><a href="#/generator/${uebung.id}" target="_blank">${uebung.name}</a></td>
                <td>${uebung.datum ? new Date(uebung.datum).toLocaleDateString() : "-"}</td>
                <td>${uebung.rufgruppe}</td>
                <td>${uebung.leitung}</td>
                <td title="${(uebung.teilnehmerListe || []).join("\n")}">${uebung.teilnehmerListe?.length ?? 0}</td>
                ${AdminView.merkmalZelle(spielModusMerkmal(uebung))}
                ${AdminView.merkmalZelle(funkspruchQuelleMerkmal(uebung))}
                <td class="text-end text-nowrap">
                     <button class="btn btn-sm btn-outline-secondary" data-action="view" title="Übung öffnen" data-id="${uebung.id}">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="monitor" title="Übung überwachen" data-id="${uebung.id}">
                        <i class="fas fa-display"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${uebung.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    /** Zelle mit Kurzform; die Details (Vorlagennamen, Szenariotitel) erscheinen als Tooltip. */
    private static merkmalZelle(merkmal: UebungsMerkmal): string {
        const title = merkmal.detail ? ` title="${AdminView.escapeAttribute(merkmal.detail)}"` : "";
        return `<td${title}>${AdminView.escapeHtml(merkmal.label)}</td>`;
    }

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    private static escapeAttribute(text: string): string {
        return AdminView.escapeHtml(text).replace(/"/g, "&quot;");
    }

    public renderPaginationInfo(currentPage: number, pageSize: number, currentCount: number, totalCount: number) {
        const info = document.getElementById("adminUebungslisteInfo");
        if (!info) {
            return;
        }
        if (currentCount === 0) {
            info.innerText = "Keine Übungen gefunden";
            return;
        }
        const from = currentPage * pageSize + 1;
        const to = from + currentCount - 1;
        info.innerText = `Zeige ${from} - ${to} von ${totalCount}`;
    }

    /**
     * Blättern nur dort anbieten, wo es auch eine Seite gibt — sonst landet man
     * auf leeren Seiten hinter dem Ende der (gefilterten) Liste.
     */
    public setPaginationButtons(hasPrev: boolean, hasNext: boolean) {
        const prev = document.getElementById("adminPrevPage") as HTMLButtonElement | null;
        const next = document.getElementById("adminNextPage") as HTMLButtonElement | null;
        if (prev) {
            prev.disabled = !hasPrev;
        }
        if (next) {
            next.disabled = !hasNext;
        }
    }

    /**
     * Füllt die Jahresauswahl über dem Diagramm. Jahre ohne Übungen tauchen
     * nicht auf, damit die Auswahl den tatsächlichen Bestand zeigt.
     */
    public renderJahresFilter(jahre: JahresEintrag[], aktiv: number | "alle") {
        const select = document.getElementById("adminStatistikJahr") as HTMLSelectElement | null;
        if (!select) {
            return;
        }

        const gesamt = jahre.reduce((summe, eintrag) => summe + eintrag.anzahl, 0);
        select.innerHTML = [
            `<option value="alle">Alle Jahre (${gesamt})</option>`,
            ...jahre.map(eintrag => `<option value="${eintrag.jahr}">${eintrag.jahr} (${eintrag.anzahl})</option>`)
        ].join("");
        select.value = String(aktiv);
    }

    /**
     * Übungen ohne die denormalisierten `stat*`-Felder fehlen im Diagramm. Ohne
     * diesen Hinweis wirkt das Diagramm schlicht leer statt unvollständig.
     */
    public renderStatistikHinweis(fehlendeUebungen: number) {
        const hinweis = document.getElementById("adminStatistikHinweis");
        if (!hinweis) {
            return;
        }
        if (fehlendeUebungen <= 0) {
            hinweis.textContent = "";
            hinweis.classList.add("d-none");
            return;
        }
        hinweis.textContent = `${fehlendeUebungen} Übung(en) ohne Statistikfelder — sie erscheinen im Diagramm, `
            + "sobald scripts/backfill-stat-felder.mjs gelaufen ist.";
        hinweis.classList.remove("d-none");
    }

    public renderChart(data: number[], labels: string[], datensatzLabel = "Übungen pro Monat") {
        const canvas = document.getElementById("chartUebungenProTag") as HTMLCanvasElement | null;
        if (!canvas) {
            return;
        }

        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        const farben = this.leseThemeFarben();

        new Chart(canvas, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: datensatzLabel,
                    data: data,
                    backgroundColor: farben.akzent,
                    borderColor: farben.akzentHell,
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { labels: { color: farben.text } }
                },
                scales: {
                    x: {
                        title: { display: true, text: "Monat", color: farben.text2 },
                        ticks: { color: farben.text2 },
                        grid: { color: farben.linie }
                    },
                    y: {
                        title: { display: true, text: "Anzahl Übungen", color: farben.text2 },
                        beginAtZero: true,
                        ticks: { color: farben.text2 },
                        grid: { color: farben.linie }
                    }
                }
            }
        });

        this.beobachteThemeWechsel(() => this.renderChart(data, labels, datensatzLabel));
    }

    /**
     * Chart.js zeichnet auf Canvas und kann deshalb keine CSS-Variablen lesen.
     * Die Rollen-Token werden hier einmal aufgelöst, damit das Diagramm
     * dieselben Farben trägt wie der Rest der Oberfläche.
     */
    private leseThemeFarben() {
        const stil = window.getComputedStyle(document.body);
        const token = (name: string, fallback: string) => stil.getPropertyValue(name).trim() || fallback;

        return {
            akzent: token("--akzent", "#12275e"),
            akzentHell: token("--akzent-hell", "#1d3d8f"),
            text: token("--text", "#11141b"),
            text2: token("--text-2", "#5c6478"),
            linie: token("--linie-fein", "#d7dce7")
        };
    }

    /**
     * Das Theme hängt als data-Attribut an <body>. Ohne Beobachter behielte das
     * Diagramm nach einem Theme-Wechsel die Farben des alten Themes bis zum Reload.
     */
    private beobachteThemeWechsel(neuZeichnen: () => void) {
        this.themeObserver?.disconnect();
        this.themeObserver = new window.MutationObserver(() => neuZeichnen());
        this.themeObserver.observe(document.body, { attributeFilter: ["data-theme"] });
    }

    public bindListEvents(handlers: AdminListHandlers) {
        const { onView, onMonitor, onDelete, onOnlyTestFilterChange, onSearchChange, onJahrChange } = handlers;

        // Die Jahresauswahl steht außerhalb der Tabelle und darf nicht an der
        // Tabellenprüfung unten scheitern.
        document.getElementById("adminStatistikJahr")?.addEventListener("change", e => {
            const wert = (e.target as HTMLSelectElement).value;
            onJahrChange?.(wert === "alle" ? "alle" : Number(wert));
        });

        const tbody = document.getElementById("adminUebungslisteBody");
        if (!tbody) {
            return;
        }

        tbody.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest("button");
            if (!btn) {
                return;
            }

            const action = btn.dataset["action"];
            const id = btn.dataset["id"];

            if (id) {
                if (action === "view") {
                    onView(id);
                }
                if (action === "monitor") {
                    onMonitor(id);
                }
                if (action === "delete") {
                    onDelete(id);
                }
            }
        });

        document.getElementById("adminSearchInput")?.addEventListener("input", e => {
            const term = (e.target as HTMLInputElement).value;
            this.entprelleSuche(() => onSearchChange?.(term));
        });
        document.getElementById("adminOnlyTestFilter")?.addEventListener("change", e => {
            const checked = (e.target as HTMLInputElement).checked;
            onOnlyTestFilterChange?.(checked);
        });
    }

    /**
     * Jede Sucheingabe stößt eine neue Abfrage über den Gesamtbestand an; ohne
     * Entprellung liefe das pro Tastendruck.
     */
    private entprelleSuche(ausfuehren: () => void) {
        if (this.sucheTimer !== null) {
            clearTimeout(this.sucheTimer);
        }
        this.sucheTimer = setTimeout(() => {
            this.sucheTimer = null;
            ausfuehren();
        }, AdminView.SUCHE_ENTPRELLUNG_MS);
    }

    private setText(id: string, text: string) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = text;
        }
    }
}
