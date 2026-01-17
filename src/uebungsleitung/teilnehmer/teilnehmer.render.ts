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

    const rows = teilnehmerListe.map(name => {
        const status: TeilnehmerStatus | undefined =
            getTeilnehmerStatusReadonly(uebungId, name);

        return `
      <tr>
        <td><strong>${name}</strong></td>

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

        <td>
          <div class="mb-1">
            <small class="text-muted">Soll:</small>
            <strong>${staerken[name] ?? "–"}</strong>
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

        <td>
          <textarea
            class="form-control form-control-sm"
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
            <th>Lösungswort</th>
            <th>Stärke</th>
            <th>Notizen</th>
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
}

function autoResizeTextarea(el: HTMLTextAreaElement): void {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
}