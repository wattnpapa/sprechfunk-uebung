import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import { TeilnehmerStatus } from "../types/Storage";
import { escapeHtml } from "../utils/html";
import type { TeilnehmerFortschritt } from "../services/liveStatusMerge";
import type { AnmeldeZustand } from "./lagebild";

type TeilnehmerCallbacks = {
    onAnmelden: (name: string) => void;
    onAnmeldungZuruecknehmen?: (name: string) => void;
    onLoesungswort: (name: string, val: string) => void;
    onStaerke: (name: string, idx: number, val: string) => void;
    onNotiz: (name: string, val: string) => void;
    onToggleDetails: () => void;
    onDownloadDebrief: (name: string) => void;
};

/** Zusatzangaben zur Teilnehmertabelle, die nicht im Übungsdokument stehen. */
export interface TeilnehmerZusatz {
    /** Anmeldung je Teilnehmer – aus Tabelle, Anmelde-Funkspruch oder Selbstmeldung. */
    anmeldung?: Record<string, AnmeldeZustand>;
    /** Bezugszeit für „vor N min“ – für Tests einstellbar. */
    jetztMs?: number;
}

/** Ab so vielen Minuten ohne neue Meldung bei offenen Nachrichten wird nachgefragt. */
export const STILL_SEIT_MINUTEN = 10;

export class UebungsleitungTeilnehmerView {
    /**
     * Zuletzt gezeigter Meldungsstand je Teilnehmer. Die Tabelle wird bei jedem
     * Firestore-Snapshot vollständig neu geschrieben; ohne diesen Merker wäre
     * nicht erkennbar, welche Zeile sich tatsächlich geändert hat — und ein
     * Übergang überlebte das Neu-Rendern ohnehin nicht.
     */
    private letzterStand = new Map<string, number>();

    /** Zuletzt gezeigte Balkenlänge in Prozent, Startwert des Übergangs. */
    private letzterProzent = new Map<string, number>();

    public render(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean,
        fortschritt: Record<string, TeilnehmerFortschritt> = {},
        zusatz: TeilnehmerZusatz = {}
    ): void {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        const teilnehmerListe = uebung.teilnehmerListe || [];
        if (!teilnehmerListe.length) {
            container.innerHTML = "<em>Keine Teilnehmer vorhanden.</em>";
            return;
        }

        const loesungswoerter = uebung.loesungswoerter || {};
        const staerken = uebung.loesungsStaerken || {};
        const showLoesungswort = Object.keys(loesungswoerter).length > 0;
        const showStaerke = Object.keys(staerken).length > 0;
        const codeByTeilnehmer = this.buildCodeByTeilnehmer(uebung.teilnehmerIds);
        // Nachzügler: alle, die spürbar hinter dem Median der Gruppe liegen.
        const beuebteStelle = uebung.fuehrungsstelle?.beuebteStelle;
        const nachzuegler = this.findeNachzuegler(teilnehmerListe.filter(n => n !== beuebteStelle), fortschritt);
        const jetztMs = zusatz.jetztMs ?? Date.now();
        // Die beübte Stelle steht oben und getrennt: sie wird beübt, spielt nicht ein.
        const sortiert = beuebteStelle && teilnehmerListe.includes(beuebteStelle)
            ? [beuebteStelle, ...teilnehmerListe.filter(n => n !== beuebteStelle)]
            : teilnehmerListe;
        const rows = sortiert.map(name => name === beuebteStelle
            ? this.renderBeuebteStelleRow(uebung, name, showLoesungswort, showStaerke)
            :
            this.renderTeilnehmerRow({
                uebung,
                name,
                status: teilnehmerStatus[name],
                showLoesungswort,
                showStaerke,
                showStaerkeDetails,
                loesungswoerter,
                staerken,
                codeByTeilnehmer,
                fortschritt: fortschritt[name],
                istNachzuegler: nachzuegler.has(name),
                anmeldung: zusatz.anmeldung?.[name],
                jetztMs
            })
        ).join("");

        container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-striped align-middle">
           <thead>
              <tr>
                <th>Teilnehmer</th>
                <th style="width:170px;">Fortschritt</th>
                <th>Angemeldet</th>
                ${showLoesungswort ? "<th>Lösungswort</th>" : ""}
                ${showStaerke ? `<th>
                  Stärke
                  <button
                    class="btn btn-sm btn-outline-secondary ms-2"
                    data-action="toggle-staerke-details"
                   >
                    Details
                  </button>
                </th>` : ""}
                <th>Notizen</th>
                <th style="width:150px;">Debrief</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;

        container.querySelectorAll<HTMLTextAreaElement>("textarea.auto-grow").forEach(el => {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        });

        this.merkeStand(teilnehmerListe, fortschritt);
        this.starteBalkenUebergang(container);
    }

    /** Schreibt den eben gezeigten Stand fort — Grundlage des nächsten Vergleichs. */
    private merkeStand(teilnehmerListe: string[], fortschritt: Record<string, TeilnehmerFortschritt>): void {
        teilnehmerListe.forEach(name => {
            const eintrag = fortschritt[name];
            this.letzterStand.set(name, eintrag?.erledigt ?? 0);
            if (eintrag && (eintrag.online || eintrag.erledigt > 0)) {
                const gesamt = eintrag.gesamt;
                this.letzterProzent.set(name, gesamt > 0 ? Math.round((eintrag.erledigt / gesamt) * 100) : 0);
            }
        });
    }

    /**
     * Setzt die Zielbreite im nächsten Frame. Der Balken ist mit dem alten Wert
     * im Markup entstanden; erst der Wechsel danach löst den Übergang aus.
     */
    private starteBalkenUebergang(container: HTMLElement): void {
        const balken = container.querySelectorAll<HTMLElement>(".progress-bar[data-fortschritt]");
        if (!balken.length) {
            return;
        }
        const anwenden = () => balken.forEach(el => {
            el.style.transform = `scaleX(${Number(el.dataset["fortschritt"]) / 100})`;
        });
        if (typeof globalThis.requestAnimationFrame === "function") {
            globalThis.requestAnimationFrame(anwenden);
        } else {
            anwenden();
        }
    }

    public bindEvents(callbacks: TeilnehmerCallbacks): void {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            if (this.handleCopyLink(target)) {
                return;
            }
            this.handleAnmelden(target, callbacks.onAnmelden);
            this.handleAnmeldungZuruecknehmen(target, callbacks.onAnmeldungZuruecknehmen);
            this.handleToggleDetails(target, callbacks.onToggleDetails);
            this.handleDownloadDebrief(target, callbacks.onDownloadDebrief);
        });

        container.addEventListener("change", e => {
            this.handleTeilnehmerChange(e.target as HTMLInputElement, callbacks);
        });

        container.addEventListener("input", e => {
            const target = e.target as HTMLElement;
            if (target.tagName === "TEXTAREA" && target.classList.contains("auto-grow")) {
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
            }
            // Bereits beim Tippen übernehmen: ein Live-Update kann die Zeile neu
            // aufbauen, bevor `change` (erst beim Verlassen) je feuern würde.
            this.handleTeilnehmerChange(e.target as HTMLInputElement, callbacks);
        });
    }

    private buildCodeByTeilnehmer(teilnehmerIds?: Record<string, string>): Record<string, string> {
        return Object.entries(teilnehmerIds || {}).reduce<Record<string, string>>((acc, [code, name]) => {
            acc[name] = code.toUpperCase();
            return acc;
        }, {});
    }

    private renderTeilnehmerRow(options: {
        uebung: Uebung;
        name: string;
        status: TeilnehmerStatus | undefined;
        showLoesungswort: boolean;
        showStaerke: boolean;
        showStaerkeDetails: boolean;
        loesungswoerter: Record<string, string>;
        staerken: Record<string, string>;
        codeByTeilnehmer: Record<string, string>;
        fortschritt: TeilnehmerFortschritt | undefined;
        istNachzuegler: boolean;
        anmeldung?: AnmeldeZustand | undefined;
        jetztMs: number;
    }): string {
        const {
            uebung,
            name,
            status,
            showLoesungswort,
            showStaerke,
            showStaerkeDetails,
            loesungswoerter,
            staerken,
            codeByTeilnehmer,
            fortschritt,
            istNachzuegler,
            anmeldung,
            jetztMs
        } = options;

        const safeName = escapeHtml(name);
        const nameHtml = this.renderTeilnehmerName(uebung, name, safeName, codeByTeilnehmer);

        const zeilenKlassen = [
            "uebungsleitung-teilnehmer-zeile",
            istNachzuegler ? "table-warning" : "",
            this.hatNeueMeldung(name, fortschritt) ? "ist-gemeldet" : ""
        ].filter(Boolean).join(" ");

        return `
          <tr class="${zeilenKlassen}"${istNachzuegler ? " data-nachzuegler=\"1\"" : ""}>
            <td>${nameHtml}</td>
            <td>${this.renderFortschrittCell(name, fortschritt, istNachzuegler, jetztMs)}</td>
            <td>${this.renderAnmeldeCell(name, anmeldung ?? (status?.angemeldetUm ? { angemeldetUm: status.angemeldetUm, quelle: "leitung" } : {}))}</td>
            ${showLoesungswort ? this.renderLoesungswortCell(name, status, loesungswoerter) : ""}
            ${showStaerke ? this.renderStaerkeCell({ uebung, name, status, staerken, showStaerkeDetails }) : ""}
            <td>
              <textarea
                class="form-control form-control-sm auto-grow"
                rows="1"
                placeholder="Notiz…"
                data-action="notiz"
                data-teilnehmer="${this.escapeAttr(name)}"
              >${escapeHtml(status?.notizen ?? "")}</textarea>
            </td>
            <td>
              <button
                class="btn btn-sm btn-outline-secondary"
                data-action="download-debrief"
                data-teilnehmer="${this.escapeAttr(name)}">
                Debrief PDF
              </button>
            </td>
          </tr>
        `;
    }

    /**
     * Die beübte Stelle einer Führungsstellen-Übung bekommt keinen
     * Teilnehmerlink und meldet sich nicht an – sie wird beübt
     * (THW-Review command P2-2).
     */
    private renderBeuebteStelleRow(uebung: Uebung, name: string, showLoesungswort: boolean, showStaerke: boolean): string {
        const stelle = uebung.teilnehmerStellen?.[name] ?? uebung.fuehrungsstelle?.stellen?.[name];
        const eingehend = Object.entries(uebung.nachrichten ?? {})
            .reduce((summe, [sender, liste]) => summe + (sender === name
                ? 0
                : liste.filter(n => n.empfaenger.includes(name) || n.empfaenger.includes("Alle")).length), 0);
        const leer = "<td class=\"text-body-secondary\">–</td>";
        return `
          <tr class="uebungsleitung-teilnehmer-zeile uebungsleitung-beuebt" data-beuebt="1">
            <td>
              <span class="badge bg-primary mb-1">beübte Stelle</span><br>
              ${stelle ? `<strong>${escapeHtml(stelle)}</strong><br><small class="text-muted">${escapeHtml(name)}</small>` : `<strong>${escapeHtml(name)}</strong>`}
            </td>
            <td><small>empfängt ${eingehend} Einspielungen</small></td>
            <td><small class="text-body-secondary">kein Teilnehmerlink – wird beübt</small></td>
            ${showLoesungswort ? leer : ""}
            ${showStaerke ? leer : ""}
            ${leer}
            ${leer}
          </tr>`;
    }

    private renderTeilnehmerName(
        uebung: Uebung,
        name: string,
        safeName: string,
        codeByTeilnehmer: Record<string, string>
    ): string {
        const codeHtml = this.renderCodeHint(uebung, name, codeByTeilnehmer);
        if (uebung.teilnehmerStellen && uebung.teilnehmerStellen[name]) {
            return `${codeHtml}<strong>${escapeHtml(uebung.teilnehmerStellen[name])}</strong><br><small class="text-muted">${safeName}</small>`;
        }
        return `${codeHtml}<strong>${safeName}</strong>`;
    }

    private renderCodeHint(uebung: Uebung, name: string, codeByTeilnehmer: Record<string, string>): string {
        const code = codeByTeilnehmer[name];
        if (!code) {
            return "";
        }
        const uebungCode = (uebung.uebungCode || "").toUpperCase();
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const joinLink = `${baseUrl}#/teilnehmer?${new URLSearchParams({ uc: uebungCode, tc: code }).toString()}`;
        return `<div class="d-flex align-items-center gap-2 text-muted mb-1">
                    <small>Teilnehmer Code: ${escapeHtml(uebungCode)} / ${escapeHtml(code)}</small>
                    <button
                      class="btn btn-sm btn-outline-secondary py-0 px-1"
                      type="button"
                      data-action="copy-link"
                      data-link="${escapeHtml(joinLink)}"
                      aria-label="Teilnehmer-Link kopieren"
                      title="Teilnehmer-Link kopieren">
                      <i class="fas fa-copy" aria-hidden="true"></i>
                    </button>
                </div>`;
    }

    /**
     * Nachzügler sind Teilnehmer, die weniger als die Hälfte des Median-Fortschritts
     * der Gruppe erreicht haben. Erst ab drei aktiven Meldungen sinnvoll auswertbar.
     */
    private findeNachzuegler(
        teilnehmerListe: string[],
        fortschritt: Record<string, TeilnehmerFortschritt>
    ): Set<string> {
        const aktive = teilnehmerListe
            .map(name => fortschritt[name])
            .filter((f): f is TeilnehmerFortschritt => Boolean(f?.online || (f?.erledigt ?? 0) > 0));
        if (aktive.length < 3) {
            return new Set();
        }

        const quoten = aktive
            .map(f => (f.gesamt > 0 ? f.erledigt / f.gesamt : 0))
            .sort((a, b) => a - b);
        const mitte = Math.floor(quoten.length / 2);
        const median = quoten.length % 2 === 0
            ? ((quoten[mitte - 1] ?? 0) + (quoten[mitte] ?? 0)) / 2
            : (quoten[mitte] ?? 0);
        if (median <= 0) {
            return new Set();
        }

        return new Set(
            aktive
                .filter(f => (f.gesamt > 0 ? f.erledigt / f.gesamt : 0) < median / 2)
                .map(f => f.teilnehmer)
        );
    }

    /**
     * Wahr, sobald die Meldungszahl gegenüber der letzten Anzeige gestiegen ist.
     * Beim ersten Rendern ist nichts "neu" — sonst blitzte die ganze Tabelle
     * beim Öffnen auf und die Markierung verlöre ihren Wert.
     */
    private hatNeueMeldung(name: string, fortschritt?: TeilnehmerFortschritt): boolean {
        const vorher = this.letzterStand.get(name);
        return vorher !== undefined && (fortschritt?.erledigt ?? 0) > vorher;
    }

    /**
     * Fortschritt aus beiden Quellen: was der Teilnehmer gemeldet und was die
     * Leitung bestätigt hat, getrennt ausgewiesen (THW-Review workflow F3).
     */
    private renderFortschrittCell(
        name: string,
        fortschritt?: TeilnehmerFortschritt,
        istNachzuegler?: boolean,
        jetztMs: number = Date.now()
    ): string {
        if (!fortschritt || (!fortschritt.online && fortschritt.erledigt === 0)) {
            return "<span class=\"badge bg-secondary\" title=\"Noch keine Live-Meldung von diesem Teilnehmer und nichts von der Leitung abgehakt\">keine Meldung</span>";
        }

        const { erledigt, gemeldet, bestaetigt, gesamt, letzteMeldungUm } = fortschritt;
        const percent = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;
        const barCss = istNachzuegler ? "bg-warning" : "bg-success";
        const herkunft = `<small class="text-body-secondary d-block">TN ${gemeldet} · Leitung ${bestaetigt}</small>`;
        const geraet = this.renderGeraetHinweis(fortschritt, jetztMs);
        const letzte = letzteMeldungUm
            ? `<small class="text-body-secondary">zuletzt ${formatNatoDate(letzteMeldungUm)}</small>${herkunft}${geraet}`
            : `<small class="text-body-secondary">noch nichts abgesetzt</small>${geraet}`;
        // Der Balken startet auf dem zuletzt gezeigten Wert und bekommt den
        // neuen erst im nächsten Frame; so legt er die Strecke sichtbar zurück.
        const start = this.letzterProzent.get(name) ?? percent;

        return `
            <div class="progress" style="height:6px;" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar ${barCss}" style="transform:scaleX(${start / 100})" data-fortschritt="${percent}"></div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <small><strong>${erledigt}</strong> / ${gesamt}</small>
              ${istNachzuegler ? "<span class=\"badge bg-warning text-dark\">Nachzügler</span>" : ""}
            </div>
            ${letzte}
        `;
    }

    /**
     * „Wie lange nichts vom Gerät?“ – unterscheidet ein Funkloch von einem
     * Teilnehmer, der gerade nur nichts absetzt (THW-Review offline P2-1).
     */
    private renderGeraetHinweis(fortschritt: TeilnehmerFortschritt, jetztMs: number): string {
        if (!fortschritt.online || !fortschritt.zuletztGesehenUm) {
            return fortschritt.online ? "" : "<small class=\"text-body-secondary d-block\">kein Live-Gerät</small>";
        }
        const minuten = Math.floor((jetztMs - Date.parse(fortschritt.zuletztGesehenUm)) / 60000);
        if (!Number.isFinite(minuten) || minuten < 1) {
            return "";
        }
        if (minuten >= STILL_SEIT_MINUTEN && fortschritt.erledigt < fortschritt.gesamt) {
            return `<small class="d-block text-warning-emphasis fw-semibold" title="Seit ${minuten} Minuten keine Änderung vom Gerät – Funkloch oder Pause? Per Funk nachfragen.">seit ${minuten} min nichts vom Gerät</small>`;
        }
        return `<small class="text-body-secondary d-block">Gerät vor ${minuten} min</small>`;
    }

    /**
     * Anmeldung und Anmelde-Funkspruch sind ein Vorgang. „Anmeldung erhalten“
     * statt „Anmelden“, damit es nicht wie ein Login aussieht; die Rücknahme
     * steht abgesetzt daneben (THW-Review error-recovery P1-2).
     */
    private renderAnmeldeCell(name: string, anmeldung: AnmeldeZustand): string {
        const safeName = this.escapeAttr(name);
        if (anmeldung.angemeldetUm) {
            const quelle = anmeldung.quelle === "funkspruch"
                ? "über Anmelde-Funkspruch"
                : anmeldung.quelle === "teilnehmer"
                    ? "vom Teilnehmer gemeldet"
                    : "";
            const ruecknahme = anmeldung.quelle === "teilnehmer"
                ? ""
                : `<button type="button" class="btn btn-sm btn-link px-0 text-danger d-block" data-action="anmeldung-zuruecknehmen" data-teilnehmer="${safeName}">Anmeldung zurücknehmen</button>`;
            return `<span class="badge bg-success">angemeldet ${formatNatoDate(anmeldung.angemeldetUm)}</span>
                    ${quelle ? `<small class="text-body-secondary d-block">${quelle}</small>` : ""}
                    ${ruecknahme}`;
        }
        return `<button class="btn btn-sm btn-outline-primary"
                    data-action="anmelden"
                    data-teilnehmer="${safeName}"
                    title="Der Teilnehmer hat sich im Funk angemeldet – sein Anmelde-Funkspruch gilt damit als abgesetzt">
                    Anmeldung erhalten
                  </button>`;
    }

    private renderLoesungswortCell(
        name: string,
        status: TeilnehmerStatus | undefined,
        loesungswoerter: Record<string, string>
    ): string {
        return `
            <td>
              <div class="mb-1">
                <small class="text-muted">Soll:</small>
                <strong>${escapeHtml(loesungswoerter[name] ?? "–")}</strong>
              </div>
              <input
                type="text"
                class="form-control form-control-sm"
                placeholder="Empfangenes Lösungswort"
                data-action="loesungswort"
                data-teilnehmer="${this.escapeAttr(name)}"
                value="${this.escapeAttr(status?.loesungswortGesendet ?? "")}"
              />
            </td>
        `;
    }

    private renderStaerkeCell(
        options: {
            uebung: Uebung;
            name: string;
            status: TeilnehmerStatus | undefined;
            staerken: Record<string, string>;
            showStaerkeDetails: boolean;
        }
    ): string {
        const { uebung, name, status, staerken, showStaerkeDetails } = options;
        const felder = [
            { kurz: "F", lang: "Führer" },
            { kurz: "UF", lang: "Unterführer" },
            { kurz: "H", lang: "Helfer" },
            { kurz: "Ges", lang: "Gesamt" }
        ];
        const inputs = felder.map((feld, i) => `
                  <input
                    type="text"
                    class="form-control form-control-sm text-center"
                    style="width:3rem"
                    maxlength="3"
                    placeholder="${feld.kurz}"
                    title="Empfangene Stärke: ${feld.lang}"
                    aria-label="Empfangene Stärke ${feld.lang}"
                    data-action="staerke"
                    data-teilnehmer="${this.escapeAttr(name)}"
                    data-index="${i}"
                    value="${this.escapeAttr(status?.teilstaerken?.[i] ?? "")}"
                  />
                `).join("");

        return `
            <td>
              <div class="mb-1">
                <small class="text-muted" title="Führer / Unterführer / Helfer / Gesamt">Soll (F/UF/H/Ges):</small>
                <span style="float: right;"><strong>${escapeHtml(staerken[name] ?? "–")}</strong></span>
                ${this.renderStaerkeDetails(uebung, name, showStaerkeDetails)}
              </div>
              <div class="d-flex gap-1">${inputs}</div>
            </td>
        `;
    }

    private renderStaerkeDetails(uebung: Uebung, name: string, show: boolean): string {
        if (!show) {
            return "";
        }

        const nachrichten: Record<string, Nachricht[]> = uebung.nachrichten || {};
        const details: string[] = [];
        Object.entries(nachrichten).forEach(([absender, liste]) => {
            liste.forEach(n => {
                if (!n.empfaenger?.includes(name) || !n.staerken?.length) {
                    return;
                }
                n.staerken.forEach(s => {
                    const total = (Number(s.fuehrer) || 0) + (Number(s.unterfuehrer) || 0) + (Number(s.helfer) || 0);
                    details.push(
                        `<div><small class="text-muted">Von ${absender}:</small><span style="float:right;">${s.fuehrer}/${s.unterfuehrer}/${s.helfer}/${total}</span></div>`
                    );
                });
            });
        });
        return details.length ? `<div class="mt-1">${details.join("")}</div>` : "";
    }

    private handleCopyLink(target: HTMLElement): boolean {
        const btnCopyLink = target.closest("button[data-action=\"copy-link\"]") as HTMLButtonElement | null;
        if (!btnCopyLink) {
            return false;
        }
        const link = btnCopyLink.dataset["link"] || "";
        const original = btnCopyLink.textContent || "Link kopieren";
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(link)
                .then(() => {
                    btnCopyLink.textContent = "Kopiert";
                    window.setTimeout(() => {
                        btnCopyLink.textContent = original;
                    }, 1200);
                })
                .catch(() => {
                    btnCopyLink.textContent = original;
                });
        }
        return true;
    }

    private handleAnmelden(target: HTMLElement, onAnmelden: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"anmelden\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer) {
            onAnmelden(teilnehmer);
        }
    }

    private handleAnmeldungZuruecknehmen(target: HTMLElement, onZuruecknehmen?: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"anmeldung-zuruecknehmen\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer && onZuruecknehmen) {
            onZuruecknehmen(teilnehmer);
        }
    }

    private handleToggleDetails(target: HTMLElement, onToggleDetails: () => void): void {
        const btn = target.closest("button[data-action=\"toggle-staerke-details\"]");
        if (btn) {
            onToggleDetails();
        }
    }

    private handleDownloadDebrief(target: HTMLElement, onDownloadDebrief: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"download-debrief\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer) {
            onDownloadDebrief(teilnehmer);
        }
    }

    private handleTeilnehmerChange(target: HTMLInputElement, callbacks: TeilnehmerCallbacks): void {
        const action = target.dataset["action"];
        const name = target.dataset["teilnehmer"];
        if (!action || !name) {
            return;
        }
        if (action === "loesungswort") {
            callbacks.onLoesungswort(name, target.value);
            return;
        }
        if (action === "staerke") {
            callbacks.onStaerke(name, Number(target.dataset["index"]), target.value);
            return;
        }
        if (action === "notiz") {
            callbacks.onNotiz(name, target.value);
        }
    }

    private escapeAttr(value: string): string {
        return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
}
