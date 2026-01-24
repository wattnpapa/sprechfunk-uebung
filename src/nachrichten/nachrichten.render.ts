// src/uebungsleitung/nachrichten/nachrichten.render.ts
import {markNachrichtAbgesetzt, getNachrichtenStatusReadonly, setNachrichtenNotiz} from "./nachrichten.state";
import {loadUebungsleitungStorage, saveUebungsleitungStorage} from "../storage";
import {formatNatoDate} from "../utils/date";

let hideAbgesetzteNachrichten = false;

function updateNachrichtenProgress(
    uebungId: string,
    nachrichten: any[]
): void {
    const bar = document.getElementById("nachrichtenProgressBar") as HTMLElement | null;
    const label = document.getElementById("nachrichtenProgressLabel") as HTMLElement | null;

    if (!bar || !label) return;

    const total = nachrichten.length;
    let done = 0;

    for (const n of nachrichten) {
        const status = getNachrichtenStatusReadonly(
            uebungId,
            n.sender,
            n.nr
        );
        if (status?.abgesetztUm) done++;
    }

    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    bar.style.width = `${percent}%`;
    bar.setAttribute("aria-valuenow", String(percent));
    label.textContent = `${done} / ${total}`;
}

export interface UebungsNachricht {
    nr: number;
    empfaenger: string[];
    sender: string;
    text: string;
    zeit?: string;
}

/**
 * Baut aus der Übung eine flache Nachrichtenliste
 * Struktur der Übung:
 * nachrichten: {
 *   "<SENDER>": [
 *     { id, empfaenger: [], nachricht, zeit? }
 *   ]
 * }
 */
export function buildNachrichtenliste(uebung: any): UebungsNachricht[] {
    const result: UebungsNachricht[] = [];
    const nachrichten = uebung.nachrichten || {};

    Object.entries(nachrichten).forEach(([sender, msgs]: any) => {
        (msgs as any[]).forEach((msg: any) => {
            result.push({
                nr: msg.id,
                sender,
                empfaenger: Array.isArray(msg.empfaenger)
                    ? msg.empfaenger
                    : msg.empfaenger
                        ? [msg.empfaenger]
                        : [],
                text: msg.nachricht || "",
                zeit: msg.zeit
            });
        });
    });

    // Sortierung wie Übungsleitung / PDF
    result.sort((a, b) => a.nr - b.nr);

    return result;
}

/**
 * Rendert die Nachrichtenliste als Tabelle
 */
export function renderNachrichtenliste(
    nachrichten: UebungsNachricht[]
): void {
    const container = document.getElementById("uebungsleitungNachrichten");
    if (!container) return;

    if (!nachrichten.length) {
        container.innerHTML = `<em>Keine Nachrichten vorhanden.</em>`;
        return;
    }

    const uebungId = (window as any).__AKTUELLE_UEBUNG_ID__;
    if (uebungId) {
        updateNachrichtenProgress(uebungId, nachrichten);
    }
    const rows = nachrichten
        .filter(n => {
            if (!hideAbgesetzteNachrichten) return true;

            const status = uebungId
                ? getNachrichtenStatusReadonly(uebungId, n.sender, n.nr)
                : undefined;

            return !status?.abgesetztUm;
        })
        .map(n => {
            const status = uebungId
                ? getNachrichtenStatusReadonly(uebungId, n.sender, n.nr)
                : undefined;

            const abgesetzt = Boolean(status?.abgesetztUm);
            const notiz = status?.notiz ?? "";
            return `
    <tr class="${abgesetzt ? "table-success" : ""}">
      <td class="text-center fw-bold">${n.nr}</td>
      <td>${n.empfaenger.map(e => `<div>${e}</div>`).join("")}</td>
      <td>${n.sender}</td>
      <td class="nachricht-text">
          ${escapeHtml(n.text).replace(/\n/g, "<br>")}
        
          <textarea
            class="form-control form-control-sm mt-2 nachricht-notiz"
            data-nr="${n.nr}"
            data-sender="${escapeAttr(n.sender)}"
            placeholder="Notiz zur Nachricht…"
          >${escapeHtml(notiz)}</textarea>
        </td>
      <td class="text-center">
        ${
                abgesetzt
                    ? `
      <div class="d-flex gap-2 justify-content-center">
        <span class="badge bg-success">abgesetzt</span>
        <button
          class="btn btn-sm btn-outline-danger"
          data-action="reset"
          data-nr="${n.nr}"
          data-sender="${escapeAttr(n.sender)}"
          title="Status zurücksetzen">
          ↺
        </button>
      </div>
    `
                    : `<button
         class="btn btn-sm btn-outline-success"
         data-action="abgesetzt"
         data-nr="${n.nr}"
         data-sender="${escapeAttr(n.sender)}">
         ✓ abgesetzt
       </button>`
            }
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
                    <th style="width:220px;">Empfänger</th>
                    <th style="width:200px;">Sender</th>
                    <th>Nachricht</th>
                    <th style="width:140px;" class="text-center">
                      Abgesetzt 
                      <div class="form-check form-switch d-inline-flex ms-2 align-middle">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          id="toggleHideAbgesetzt"
                          ${hideAbgesetzteNachrichten ? "checked" : ""}
                        >
                        <label
                          class="form-check-label small ms-1"
                          for="toggleHideAbgesetzt">
                           ausblenden
                        </label>
                      </div>
                    </th>
                    <th style="width:90px;">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll<HTMLButtonElement>(
        'button[data-action="abgesetzt"]'
    ).forEach(btn => {
        btn.addEventListener("click", () => {
            const nr = Number(btn.dataset.nr);
            const sender = String(btn.dataset.sender || "");
            const uebungId = (window as any).__AKTUELLE_UEBUNG_ID__;

            console.log("[CLICK] Abgesetzt gedrückt", {nr, sender, uebungId});

            if (!uebungId) {
                console.warn("[CLICK] Keine Übungs-ID gefunden");
                return;
            }
            if (!sender) {
                console.warn("[CLICK] Kein Sender am Button gefunden");
                return;
            }

            markNachrichtAbgesetzt(uebungId, sender, nr);

            console.log(
                "[STATE] Nachricht abgesetzt",
                getNachrichtenStatusReadonly(uebungId, sender, nr)
            );

            // Re-render (so Badge + Zeit erscheinen korrekt)
            const u = (window as any).__AKTUELLE_UEBUNG__;
            renderNachrichtenliste(buildNachrichtenliste(u));
        });
    });
    container.querySelectorAll<HTMLButtonElement>(
        'button[data-action="reset"]'
    ).forEach(btn => {
        btn.addEventListener("click", () => {
            const nr = Number(btn.dataset.nr);
            const sender = String(btn.dataset.sender || "");
            const uebungId = (window as any).__AKTUELLE_UEBUNG_ID__;

            if (!uebungId || !sender) return;

            const storage = loadUebungsleitungStorage(uebungId);
            const key = `${sender}__${nr}`;
            delete storage.nachrichten[key];
            saveUebungsleitungStorage(storage);

            console.log("[STATE] Nachricht zurückgesetzt", {sender, nr});

            const u = (window as any).__AKTUELLE_UEBUNG__;
            renderNachrichtenliste(buildNachrichtenliste(u));
        });
    });

    const toggle = document.getElementById("toggleHideAbgesetzt") as HTMLInputElement | null;
    if (toggle) {
        toggle.addEventListener("change", () => {
            hideAbgesetzteNachrichten = toggle.checked;

            const u = (window as any).__AKTUELLE_UEBUNG__;
            renderNachrichtenliste(buildNachrichtenliste(u));
        });
    }

    container.querySelectorAll<HTMLTextAreaElement>(
        "textarea.nachricht-notiz"
    ).forEach(textarea => {
        textarea.addEventListener("input", () => {
            const nr = Number(textarea.dataset.nr);
            const sender = String(textarea.dataset.sender);
            const uebungId = (window as any).__AKTUELLE_UEBUNG_ID__;

            if (!uebungId || !sender) return;

            setNachrichtenNotiz(uebungId, sender, nr, textarea.value);
        });
    });
}

/**
 * HTML escapen (Sicherheit)
 */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
    return escapeHtml(value)
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}