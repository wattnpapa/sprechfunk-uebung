import { TeilnehmerStatus } from "../../types";
import {
    markTeilnehmerAngemeldet,
    getTeilnehmerStatusReadonly
} from "./teilnehmer.state";
import { formatNatoDate } from "../../utils/date"

/**
 * Rendert die Teilnehmerübersicht für die Übungsleitung
 */
export function renderTeilnehmerListe(
    uebungId: string,
    teilnehmerListe: string[],
    loesungswoerter: Record<string, string>,
    staerken: Record<string, string>
): void {
    const container = document.getElementById("uebungsleitungTeilnehmer");
    if (!container) return;

    if (!teilnehmerListe.length) {
        container.innerHTML = `<em>Keine Teilnehmer vorhanden.</em>`;
        return;
    }

    const showLoesungswort =
        loesungswoerter &&
        Object.keys(loesungswoerter).length > 0;

    const showStaerke =
        staerken &&
        Object.keys(staerken).length > 0;

    // Toggle for Stärke-Details
    const showStaerkeDetails = (window as any).__SHOW_STAERKE_DETAILS__ ?? false;

    const rows = teilnehmerListe.map(name => {
        const status: TeilnehmerStatus | undefined =
            getTeilnehmerStatusReadonly(uebungId, name);

        return `
      <tr>
        <td>
          <strong>
            ${(() => {
                const u = (window as any).__AKTUELLE_UEBUNG__;
                const stellen = u?.teilnehmerStellen;
                if (stellen && stellen[name]) {
                    return `
                      ${stellen[name]}<br>
                      <small class="text-muted">${name}</small>
                    `;
                }
                return name;
            })()}
          </strong>
        </td>
 
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
        ` : ``}
 
        ${showStaerke ? `
        <td>
          <div class="mb-1">
            <small class="text-muted">Soll:</small>
            <span style="float: right;"><strong>${staerken[name] ?? "–"}</strong></span>
            ${(() => {
              const u = (window as any).__AKTUELLE_UEBUNG__;
              const nachrichten = u?.nachrichten || {};
              const details: string[] = [];

              Object.entries(nachrichten).forEach(([absender, liste]: any) => {
                (liste as any[]).forEach(n => {
                  if (n.empfaenger?.includes(name) && n.staerken?.length) {
                    n.staerken.forEach((s: any) => {
                      details.push(
                        `<div><small class="text-muted">Von ${absender}:</small><span style="float:right;">${s.fuehrer}/${s.unterfuehrer}/${s.helfer}/${(Number(s.fuehrer)||0)+(Number(s.unterfuehrer)||0)+(Number(s.helfer)||0)}</span></div>`
                      );
                    });
                  }
                });
              });

              if (!showStaerkeDetails) return "";
              if (!details.length) return "";
              return `<div class="mt-1">${details.join("")}</div>`;
            })()}
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
        ` : ``}

        <td>
          <textarea
            class="form-control form-control-sm"
            rows="1"
            placeholder="Notiz…"
            data-action="notiz"
            data-teilnehmer="${name}"
          >${status?.notizen ?? ""}</textarea>
        </td>

        <td>
          ${(() => {
              const u = (window as any).__AKTUELLE_UEBUNG__;
              const teilnehmerIds = u?.teilnehmerIds || {};
              // Finde die kryptische ID für diesen Teilnehmernamen
              const entry = Object.entries(teilnehmerIds).find(([id, tName]) => tName === name);
              if (entry) {
                  const kryptischeId = entry[0];
                  const url = `${window.location.origin}${window.location.pathname}#/teilnehmer/${u.id}/${kryptischeId}`;
                  return `
                    <div class="input-group input-group-sm" style="min-width: 150px;">
                        <input type="text" class="form-control" value="${url}" readonly id="link-${kryptischeId}">
                        <button class="btn btn-outline-secondary btn-copy-link" type="button" data-id="${kryptischeId}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                  `;
              }
              return "–";
          })()}
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
            ${showLoesungswort ? `<th>Lösungswort</th>` : ``}
            ${showStaerke ? `<th>
              Stärke
              <button
                class="btn btn-sm btn-outline-secondary ms-2"
                data-action="toggle-staerke-details">
                Details
              </button>
            </th>` : ``}
            <th>Notizen</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

    container
        .querySelectorAll<HTMLTextAreaElement>("textarea.auto-grow")
        .forEach(area => autoResizeTextarea(area));

    bindTeilnehmerEvents(uebungId);
    bindCopyLinkEvents();
}

function bindCopyLinkEvents() {
    document.querySelectorAll(".btn-copy-link").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            const input = document.getElementById(`link-${id}`) as HTMLInputElement;
            if (input) {
                input.select();
                document.execCommand("copy");
                
                const icon = (e.currentTarget as HTMLElement).querySelector("i");
                if (icon) {
                    icon.classList.replace("fa-copy", "fa-check");
                    setTimeout(() => icon.classList.replace("fa-check", "fa-copy"), 2000);
                }
            }
        });
    });
}

/**
 * Bindet UI-Events (delegiert)
 */
function bindTeilnehmerEvents(uebungId: string): void {
    const container = document.getElementById("uebungsleitungTeilnehmer");
    if (!container) return;

    // Anmeldung
    container.querySelectorAll<HTMLButtonElement>(
        'button[data-action="anmelden"]'
    ).forEach(btn => {
        btn.addEventListener("click", () => {
            const name = btn.dataset.teilnehmer!;
            markTeilnehmerAngemeldet(uebungId, name);

            // 🔁 Neu rendern
            const u = (window as any).__AKTUELLE_UEBUNG__;
            console.log(u);
            renderTeilnehmerListe(
                uebungId,
                u.teilnehmerListe,
                u.loesungswoerter || {},
                u.loesungsStaerken || {}
            );
        });
    });

    // Notizen
    container.querySelectorAll<HTMLTextAreaElement>(
        'textarea[data-action="notiz"]'
    ).forEach(area => {
        area.addEventListener("change", () => {
            const name = area.dataset.teilnehmer!;
            // Lazy import → keine Zyklen
            import("./teilnehmer.state").then(m =>
                m.updateTeilnehmerNotiz(uebungId, name, area.value)
            );
        });
    });

    // Lösungswort
    container.querySelectorAll<HTMLInputElement>(
        'input[data-action="loesungswort"]'
    ).forEach(input => {
        input.addEventListener("change", () => {
            const name = input.dataset.teilnehmer!;
            import("./teilnehmer.state").then(m =>
                m.updateTeilnehmerLoesungswort(
                    uebungId,
                    name,
                    input.value
                )
            );
        });
    });

    // Teilstärken
    container.querySelectorAll<HTMLInputElement>(
        'input[data-action="staerke"]'
    ).forEach(input => {
        input.addEventListener("change", () => {
            const name = input.dataset.teilnehmer!;
            const index = Number(input.dataset.index);

            import("./teilnehmer.state").then(m =>
                m.updateTeilnehmerTeilstaerke(
                    uebungId,
                    name,
                    index,
                    input.value
                )
            );
        });
    });

    container.querySelectorAll<HTMLTextAreaElement>(
        'textarea[data-action="notiz"]'
    ).forEach(area => {

        // Initial (Sicherheit bei Re-Render)
        autoResizeTextarea(area);

        area.addEventListener("input", () => {
            autoResizeTextarea(area);
        });

        area.addEventListener("change", () => {
            const name = area.dataset.teilnehmer!;
            import("./teilnehmer.state").then(m =>
                m.updateTeilnehmerNotiz(uebungId, name, area.value)
            );
        });
    });

    // Stärke-Details ein/ausblenden
    container.querySelectorAll<HTMLButtonElement>(
      'button[data-action="toggle-staerke-details"]'
    ).forEach(btn => {
      btn.addEventListener("click", () => {
        (window as any).__SHOW_STAERKE_DETAILS__ = !(window as any).__SHOW_STAERKE_DETAILS__;

        const u = (window as any).__AKTUELLE_UEBUNG__;
        renderTeilnehmerListe(
          uebungId,
          u.teilnehmerListe || [],
          u.loesungswoerter || {},
          u.loesungsStaerken || {}
        );
      });
    });
}

function autoResizeTextarea(el: HTMLTextAreaElement): void {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
}