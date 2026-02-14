import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import { TeilnehmerStatus, NachrichtenStatus } from "../types/Storage";
import { escapeHtml } from "../utils/html";

interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
}

export class UebungsleitungView {

    public renderMeta(uebung: Uebung, uebungId: string) {
        const metaEl = document.getElementById("uebungsleitungMeta");
        if (!metaEl) {
            return;
        }

        metaEl.innerHTML = `
          <div class="row">
            <div class="col-md-6 mb-2">
              <strong>Name der Übung:</strong><br>${uebung.name || "–"}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Datum:</strong><br>${formatNatoDate(uebung.datum)}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Rufgruppe:</strong><br>${uebung.rufgruppe || "–"}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Übungsleitung:</strong><br>${uebung.leitung || "–"}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Anzahl Teilnehmer:</strong><br>${uebung.teilnehmerListe?.length ?? 0}
            </div>
            <div class="col-md-6 mb-2">
              <strong>Übungs-ID:</strong><br><code>${uebungId}</code>
            </div>
            <div class="col-12 mt-3 d-flex justify-content-end">
            <button
              class="btn btn-outline-secondary me-2"
              id="exportUebungsleitungPdf">
              📄 Übungsleitung als PDF
            </button>
    
              <button
                class="btn btn-outline-danger"
                id="resetUebungsleitungLocalData">
                ⟲ Lokale Übungsdaten zurücksetzen
              </button>
            </div>
            
          </div>
        `;
    }

    public bindMetaEvents(onPdfExport: () => void, onReset: () => void) {
        document.getElementById("exportUebungsleitungPdf")?.addEventListener("click", onPdfExport);
        document.getElementById("resetUebungsleitungLocalData")?.addEventListener("click", onReset);
    }

    public renderTeilnehmerListe(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean
    ) {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        const teilnehmerListe = uebung.teilnehmerListe || [];
        const loesungswoerter = uebung.loesungswoerter || {};
        const staerken = uebung.loesungsStaerken || {};

        if (!teilnehmerListe.length) {
            container.innerHTML = "<em>Keine Teilnehmer vorhanden.</em>";
            return;
        }

        const showLoesungswort = Object.keys(loesungswoerter).length > 0;
        const showStaerke = Object.keys(staerken).length > 0;

        const rows = teilnehmerListe.map(name => {
            const status = teilnehmerStatus[name];

            // Name & Stelle
            let nameHtml = `<strong>${name}</strong>`;
            if (uebung.teilnehmerStellen && uebung.teilnehmerStellen[name]) {
                nameHtml = `<strong>${uebung.teilnehmerStellen[name]}</strong><br><small class="text-muted">${name}</small>`;
            }

            return `
          <tr>
            <td>${nameHtml}</td>
     
            <td>
              ${status?.angemeldetUm
                        ? `<span class="badge bg-success">${formatNatoDate(status.angemeldetUm)}</span>`
                        : `<button class="btn btn-sm btn-outline-primary"
                    data-action="anmelden"
                    data-teilnehmer="${name}">
                    Anmelden
                  </button>`
                }
            </td> 
            
            ${showLoesungswort ? `
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
            ` : ""}
     
            ${showStaerke ? `
            <td>
              <div class="mb-1">
                <small class="text-muted">Soll:</small>
                <span style="float: right;"><strong>${staerken[name] ?? "–"}</strong></span>
                ${this.renderStaerkeDetails(uebung, name, showStaerkeDetails)}
              </div>
              <div class="d-flex gap-1">
                ${[0, 1, 2, 3].map(i => `
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
                `).join("")}
              </div>
            </td>
            ` : ""}
    
            <td>
              <textarea
                class="form-control form-control-sm auto-grow"
                rows="1"
                placeholder="Notiz…"
                data-action="notiz"
                data-teilnehmer="${name}"
              >${status?.notizen ?? ""}</textarea>
            </td>
          </tr>
        `;
        }).join("");

        container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-striped align-middle">
           <thead>
              <tr>
                <th>Teilnehmer</th>
                <th>Angemeldet</th>
                ${showLoesungswort ? "<th>Lösungswort</th>" : ""}
                ${showStaerke ? `<th>
                  Stärke
                  <button
                    class="btn btn-sm btn-outline-secondary ms-2"
                    data-action="toggle-staerke-details">
                    Details
                  </button>
                </th>` : ""}
                <th>Notizen</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
      
        // Auto-resize textareas initial
        container.querySelectorAll<HTMLTextAreaElement>("textarea.auto-grow").forEach(el => {
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
        });
    }

    private renderStaerkeDetails(uebung: Uebung, name: string, show: boolean): string {
        if (!show) {
            return "";
        }
        
        const nachrichten: Record<string, Nachricht[]> = uebung.nachrichten || {};
        const details: string[] = [];

        Object.entries(nachrichten).forEach(([absender, liste]) => {
            liste.forEach(n => {
                if (n.empfaenger?.includes(name) && n.staerken?.length) {
                    n.staerken.forEach(s => {
                        details.push(
                            `<div><small class="text-muted">Von ${absender}:</small><span style="float:right;">${s.fuehrer}/${s.unterfuehrer}/${s.helfer}/${(Number(s.fuehrer) || 0) + (Number(s.unterfuehrer) || 0) + (Number(s.helfer) || 0)}</span></div>`
                        );
                    });
                }
            });
        });

        if (!details.length) {
            return "";
        }
        return `<div class="mt-1">${details.join("")}</div>`;
    }

    public bindTeilnehmerEvents(
        onAnmelden: (name: string) => void,
        onLoesungswort: (name: string, val: string) => void,
        onStaerke: (name: string, idx: number, val: string) => void,
        onNotiz: (name: string, val: string) => void,
        onToggleDetails: () => void
    ) {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            
            // Anmelden
            const btnAnmelden = target.closest("button[data-action=\"anmelden\"]") as HTMLElement;
            if (btnAnmelden) {
                const teilnehmer = btnAnmelden.dataset["teilnehmer"];
                if (teilnehmer) {
                    onAnmelden(teilnehmer);
                }
            }

            // Toggle Details
            const btnToggle = target.closest("button[data-action=\"toggle-staerke-details\"]");
            if (btnToggle) {
                onToggleDetails();
            }

        });

        container.addEventListener("change", e => {
            const target = e.target as HTMLInputElement;
            const action = target.dataset["action"];
            const name = target.dataset["teilnehmer"];

            if (!action || !name) {
                return;
            }

            if (action === "loesungswort") {
                onLoesungswort(name, target.value);
            } else if (action === "staerke") {
                const idx = Number(target.dataset["index"]);
                onStaerke(name, idx, target.value);
            } else if (action === "notiz") {
                onNotiz(name, target.value);
            }
        });
        
        // Auto-resize for textareas
        container.addEventListener("input", e => {
            const target = e.target as HTMLElement;
            if (target.tagName === "TEXTAREA" && target.classList.contains("auto-grow")) {
                target.style.height = "auto";
                target.style.height = target.scrollHeight + "px";
            }
        });
    }

    // --- Nachrichten ---

    public renderNachrichtenListe(
        nachrichten: FlattenedNachricht[], 
        nachrichtenStatus: Record<string, NachrichtenStatus>,
        hideAbgesetzt: boolean,
        senderFilter: string,
        empfaengerFilter: string,
        textFilter: string
    ) {
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }

        if (!nachrichten.length) {
            container.innerHTML = "<em>Keine Nachrichten vorhanden.</em>";
            return;
        }

        // Filter Options
        const uniqueSenders = Array.from(new Set(nachrichten.map(n => n.sender))).sort();
        const uniqueEmpfaenger = Array.from(new Set(nachrichten.flatMap(n => n.empfaenger))).sort();

        // Filter Logic
        const rows = nachrichten
            .filter(n => {
                if (senderFilter && n.sender !== senderFilter) {
                    return false;
                }
                if (empfaengerFilter && !n.empfaenger.includes(empfaengerFilter)) {
                    return false;
                }
                if (textFilter && !n.text.toLowerCase().includes(textFilter.toLowerCase())) {
                    return false;
                }
                
                const key = `${n.sender}__${n.nr}`;
                const status = nachrichtenStatus[key];
                
                if (hideAbgesetzt && status?.abgesetztUm) {
                    return false;
                }
                return true;
            })
            .map(n => {
                const key = `${n.sender}__${n.nr}`;
                const status = nachrichtenStatus[key];
                const abgesetzt = Boolean(status?.abgesetztUm);
                const notiz = status?.notiz ?? "";

                return `
                <tr class="${abgesetzt ? "status-ok-row" : "status-pending-row"}">
                  <td class="text-center fw-bold">${n.nr}</td>
                  <td>${n.empfaenger.map((e: string) => `<div>${e}</div>`).join("")}</td>
                  <td>${n.sender}</td>
                  <td class="nachricht-text">
                      ${escapeHtml(n.text).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}
                      <textarea
                        class="form-control form-control-sm mt-2 nachricht-notiz"
                        data-nr="${n.nr}"
                        data-sender="${this.escapeAttr(n.sender)}"
                        placeholder="Notiz zur Nachricht…"
                      >${escapeHtml(notiz)}</textarea>
                    </td>
                  <td class="text-center">
                    ${abgesetzt ? `
                      <div class="d-flex gap-2 justify-content-center">
                        <span class="status-chip status-chip--ok">abgesetzt</span>
                        <button class="btn btn-sm btn-outline-danger" data-action="reset" data-nr="${n.nr}" data-sender="${this.escapeAttr(n.sender)}" title="Status zurücksetzen">↺</button>
                      </div>
                    ` : `
                      <div class="d-flex gap-2 justify-content-center">
                        <span class="status-chip status-chip--pending">offen</span>
                        <button class="btn btn-sm btn-outline-success" data-action="abgesetzt" data-nr="${n.nr}" data-sender="${this.escapeAttr(n.sender)}">✓ abgesetzt</button>
                      </div>
                    `}
                  </td>
                  <td>${status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : ""}</td>
                </tr>
              `;
            }).join("");

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-bordered table-striped align-middle">
                    <thead>
                      <tr>
                        <th style="width:60px;">Nr</th>
                        <th style="width:220px;">
                          Empfänger
                          <select id="empfaengerFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${uniqueEmpfaenger.map(e => `<option value="${this.escapeAttr(e)}" ${empfaengerFilter===e?"selected":""}>${escapeHtml(e)}</option>`).join("")}
                          </select>
                        </th>
                        <th style="width:200px;">
                          Sender
                          <select id="senderFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${uniqueSenders.map(s => `<option value="${this.escapeAttr(s)}" ${senderFilter===s?"selected":""}>${escapeHtml(s)}</option>`).join("")}
                          </select>
                        </th>
                        <th>
                          Nachricht
                          <input id="nachrichtenTextFilterInput" type="search" class="form-control form-control-sm mt-1" placeholder="Suchen..." value="${this.escapeAttr(textFilter)}">
                        </th>
                        <th style="width:140px;" class="text-center">
                          Abgesetzt 
                          <div class="form-check form-switch d-inline-flex ms-2 align-middle">
                            <input class="form-check-input" type="checkbox" id="toggleHideAbgesetzt" ${hideAbgesetzt ? "checked" : ""}>
                            <label class="form-check-label small ms-1" for="toggleHideAbgesetzt">ausblenden</label>
                          </div>
                        </th>
                        <th style="width:90px;">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    public updateProgress(total: number, done: number, etaLabel: string) {
        const bar = document.getElementById("nachrichtenProgressBar");
        const label = document.getElementById("nachrichtenProgressLabel");
        const eta = document.getElementById("nachrichtenEtaLabel");
        if (!bar || !label || !eta) {
            return;
        }

        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        bar.style.width = `${percent}%`;
        bar.setAttribute("aria-valuenow", String(percent));
        label.textContent = `${done} / ${total}`;
        eta.textContent = etaLabel;
    }

    public bindNachrichtenEvents(
        onAbgesetzt: (sender: string, nr: number) => void,
        onReset: (sender: string, nr: number) => void,
        onNotiz: (sender: string, nr: number, val: string) => void,
        onFilterSender: (val: string) => void,
        onFilterEmpfaenger: (val: string) => void,
        onToggleHide: (val: boolean) => void,
        onFilterText: (val: string) => void
    ) {
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }

        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest("button");
            if (!btn) {
                return;
            }

            const action = btn.dataset["action"];
            const nr = Number(btn.dataset["nr"]);
            const sender = btn.dataset["sender"];

            if (action === "abgesetzt" && sender) {
                onAbgesetzt(sender, nr);
            }
            if (action === "reset" && sender) {
                onReset(sender, nr);
            }
        });

        container.addEventListener("change", e => {
            const target = e.target as HTMLInputElement | HTMLSelectElement;
            if (target.id === "senderFilterSelect") {
                onFilterSender(target.value);
            }
            if (target.id === "empfaengerFilterSelect") {
                onFilterEmpfaenger(target.value);
            }
            if (target.id === "toggleHideAbgesetzt") {
                onToggleHide((target as HTMLInputElement).checked);
            }
        });

        container.addEventListener("input", e => {
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            if (target.id === "nachrichtenTextFilterInput") {
                onFilterText(target.value);
                return;
            }
            if (target.classList.contains("nachricht-notiz")) {
                const nr = Number(target.dataset["nr"]);
                const sender = target.dataset["sender"];
                if (sender) {
                    onNotiz(sender, nr, (target as HTMLTextAreaElement).value);
                }
            }
        });
    }

    private escapeAttr(value: string): string {
        return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
}
