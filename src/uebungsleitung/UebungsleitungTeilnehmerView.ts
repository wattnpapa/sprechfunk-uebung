import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import { TeilnehmerStatus } from "../types/Storage";
import { escapeHtml } from "../utils/html";
import type { TeilnehmerFortschritt } from "../services/liveStatusMerge";

type TeilnehmerCallbacks = {
    onAnmelden: (name: string) => void;
    onLoesungswort: (name: string, val: string) => void;
    onStaerke: (name: string, idx: number, val: string) => void;
    onNotiz: (name: string, val: string) => void;
    onToggleDetails: () => void;
    onDownloadDebrief: (name: string) => void;
};

export class UebungsleitungTeilnehmerView {
    public render(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean,
        fortschritt: Record<string, TeilnehmerFortschritt> = {}
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
        const nachzuegler = this.findeNachzuegler(teilnehmerListe, fortschritt);
        const rows = teilnehmerListe.map(name =>
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
                istNachzuegler: nachzuegler.has(name)
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
            istNachzuegler
        } = options;

        const safeName = escapeHtml(name);
        const nameHtml = this.renderTeilnehmerName(uebung, name, safeName, codeByTeilnehmer);

        return `
          <tr${istNachzuegler ? " class=\"table-warning\" data-nachzuegler=\"1\"" : ""}>
            <td>${nameHtml}</td>
            <td>${this.renderFortschrittCell(fortschritt, istNachzuegler)}</td>
            <td>${this.renderAnmeldeCell(name, status)}</td>
            ${showLoesungswort ? this.renderLoesungswortCell(name, status, loesungswoerter) : ""}
            ${showStaerke ? this.renderStaerkeCell({ uebung, name, status, staerken, showStaerkeDetails }) : ""}
            <td>
              <textarea
                class="form-control form-control-sm auto-grow"
                rows="1"
                placeholder="Notiz…"
                data-action="notiz"
                data-teilnehmer="${name}"
              >${status?.notizen ?? ""}</textarea>
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
            .filter((f): f is TeilnehmerFortschritt => Boolean(f?.online));
        if (aktive.length < 3) {
            return new Set();
        }

        const quoten = aktive
            .map(f => (f.gesamt > 0 ? f.gemeldet / f.gesamt : 0))
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
                .filter(f => (f.gesamt > 0 ? f.gemeldet / f.gesamt : 0) < median / 2)
                .map(f => f.teilnehmer)
        );
    }

    private renderFortschrittCell(fortschritt?: TeilnehmerFortschritt, istNachzuegler?: boolean): string {
        if (!fortschritt?.online) {
            return "<span class=\"badge bg-secondary\" title=\"Noch keine Live-Meldung von diesem Teilnehmer\">keine Meldung</span>";
        }

        const { gemeldet, gesamt, letzteMeldungUm } = fortschritt;
        const percent = gesamt > 0 ? Math.round((gemeldet / gesamt) * 100) : 0;
        const barCss = istNachzuegler ? "bg-warning" : "bg-success";
        const letzte = letzteMeldungUm
            ? `<small class="text-body-secondary">zuletzt ${formatNatoDate(letzteMeldungUm)}</small>`
            : "<small class=\"text-body-secondary\">noch nichts übertragen</small>";

        return `
            <div class="progress" style="height:6px;" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar ${barCss}" style="width:${percent}%"></div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <small><strong>${gemeldet}</strong> / ${gesamt}</small>
              ${istNachzuegler ? "<span class=\"badge bg-warning text-dark\">Nachzügler</span>" : ""}
            </div>
            ${letzte}
        `;
    }

    private renderAnmeldeCell(name: string, status?: TeilnehmerStatus): string {
        if (status?.angemeldetUm) {
            return `<span class="badge bg-success">${formatNatoDate(status.angemeldetUm)}</span>`;
        }
        return `<button class="btn btn-sm btn-outline-primary"
                    data-action="anmelden"
                    data-teilnehmer="${name}">
                    Anmelden
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
                <strong>${loesungswoerter[name] ?? "–"}</strong>
              </div>
              <input
                type="text"
                class="form-control form-control-sm"
                placeholder="Empfangenes Lösungswort"
                data-action="loesungswort"
                data-teilnehmer="${name}"
                value="${status?.loesungswortGesendet ?? ""}"
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
        const inputs = [0, 1, 2, 3].map(i => `
                  <input
                    type="text"
                    class="form-control form-control-sm text-center"
                    style="width:3rem"
                    maxlength="3"
                    placeholder="-"
                    data-action="staerke"
                    data-teilnehmer="${name}"
                    data-index="${i}"
                    value="${status?.teilstaerken?.[i] ?? ""}"
                  />
                `).join("");

        return `
            <td>
              <div class="mb-1">
                <small class="text-muted">Soll:</small>
                <span style="float: right;"><strong>${staerken[name] ?? "–"}</strong></span>
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
