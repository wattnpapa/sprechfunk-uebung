
import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { formatNatoDate } from "../utils/date";
import type { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage } from "../storage";
import type { TeilnehmerStorage } from "../types";
import { escapeHtml } from "../utils/html";

/**
 * Erwarteter Hash:
 *   #/teilnehmer/<kryptischeId>
 */
function getTeilnehmerIdFromHash(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");

  if (parts[0] !== "teilnehmer") return null;
  return parts[1] ?? null;
}

export async function initTeilnehmer(db: Firestore): Promise<void> {
  const area = document.getElementById("teilnehmerArea");
  const contentEl = document.getElementById("teilnehmerContent");

  if (!area || !contentEl) return;

  const kryptischeId = getTeilnehmerIdFromHash();

  if (!kryptischeId) {
    contentEl.innerHTML = `<div class="alert alert-danger">Keine Teilnehmer-ID angegeben.</div>`;
    return;
  }

  try {
    // Da wir die uebungId nicht direkt im Link haben, müssen wir entweder:
    // 1. Die uebungId als Teil des Links mitgeben: #/teilnehmer/<uebungId>/<teilnehmerId>
    // 2. Eine Collection "teilnehmerLinks" in Firebase haben, die auf die Übung verweist.
    
    // Angenommen wir ändern das Link-Format auf #/teilnehmer/<uebungId>/<kryptischeId>
    const hash = window.location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/");
    const uebungId = parts[1];
    const tId = parts[2];

    if (!uebungId || !tId) {
        contentEl.innerHTML = `<div class="alert alert-danger">Ungültiger Link.</div>`;
        return;
    }

    const ref = doc(db, "uebungen", uebungId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      contentEl.innerHTML = `<div class="alert alert-warning">Übung nicht gefunden.</div>`;
      return;
    }

    const u = snap.data() as Uebung;
    const teilnehmerName = u.teilnehmerIds ? u.teilnehmerIds[tId] : null;

    if (!teilnehmerName) {
        contentEl.innerHTML = `<div class="alert alert-danger">Teilnehmer nicht in dieser Übung gefunden.</div>`;
        return;
    }

    area.style.display = "block";

    renderTeilnehmerSeite(u, teilnehmerName, contentEl);

  } catch (err) {
    console.error("❌ Fehler beim Laden der Teilnehmer-Daten:", err);
    contentEl.innerHTML = `<div class="alert alert-danger">Fehler beim Laden der Daten.</div>`;
  }
}

function renderTeilnehmerSeite(u: Uebung, teilnehmer: string, container: HTMLElement) {
    const storage = loadTeilnehmerStorage(u.id, teilnehmer);
    const nachrichten = u.nachrichten[teilnehmer] || [];

    const nachrichtenRows = nachrichten
        .filter((n: Nachricht) => {
            if (storage.hideTransmitted) {
                return !storage.nachrichten[n.id]?.uebertragen;
            }
            return true;
        })
        .map((n: Nachricht) => {
            const status = storage.nachrichten[n.id];
            const isUebertragen = !!status?.uebertragen;

            return `
        <tr class="${isUebertragen ? 'table-success opacity-50' : ''}">
            <td>${n.id}</td>
            <td>${n.empfaenger.join(", ")}</td>
            <td>${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input btn-toggle-uebertragen" type="checkbox" 
                        data-id="${n.id}" ${isUebertragen ? 'checked' : ''}>
                    <label class="form-check-label small">Übertragen</label>
                </div>
            </td>
        </tr>
    `}).join("");

    container.innerHTML = `
        <div class="card mb-4">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h3 class="card-title mb-0">Sprechfunkübung: ${u.name}</h3>
                <button class="btn btn-sm btn-outline-light" id="btn-reset-teilnehmer-data">
                    <i class="fas fa-undo"></i> Lokale Daten löschen
                </button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Eigener Funkrufname:</strong> ${teilnehmer}</p>
                        <p><strong>Datum:</strong> ${formatNatoDate(u.datum)}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Rufgruppe:</strong> ${u.rufgruppe}</p>
                        <p><strong>Übungsleitung:</strong> ${u.leitung}</p>
                        ${u.loesungswoerter?.[teilnehmer] ? `<p><strong>Lösungswort:</strong> <code class="fs-5">${u.loesungswoerter[teilnehmer]}</code></p>` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4>Meine Funksprüche</h4>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted" ${storage.hideTransmitted ? 'checked' : ''}>
                <label class="form-check-label" for="toggle-hide-transmitted">Übertragene ausblenden</label>
            </div>
        </div>

        <div class="table-responsive">
            <table class="table table-striped table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Nr.</th>
                        <th>Empfänger</th>
                        <th>Nachricht</th>
                        <th style="width: 150px;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${nachrichtenRows || '<tr><td colspan="4" class="text-center text-muted">Keine Nachrichten vorhanden.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    // Event-Listener: Übertragen toggle
    container.querySelectorAll(".btn-toggle-uebertragen").forEach(el => {
        el.addEventListener("change", (e) => {
            const checkbox = e.target as HTMLInputElement;
            const msgId = checkbox.dataset.id!;
            const storage = loadTeilnehmerStorage(u.id, teilnehmer);

            if (checkbox.checked) {
                storage.nachrichten[msgId] = {
                    uebertragen: true,
                    uebertragenUm: new Date().toISOString()
                };
            } else {
                delete storage.nachrichten[msgId];
            }

            saveTeilnehmerStorage(storage);
            renderTeilnehmerSeite(u, teilnehmer, container);
        });
    });

    // Event-Listener: Ausblenden toggle
    const hideToggle = document.getElementById("toggle-hide-transmitted") as HTMLInputElement;
    hideToggle?.addEventListener("change", () => {
        const storage = loadTeilnehmerStorage(u.id, teilnehmer);
        storage.hideTransmitted = hideToggle.checked;
        saveTeilnehmerStorage(storage);
        renderTeilnehmerSeite(u, teilnehmer, container);
    });

    // Event-Listener: Reset
    document.getElementById("btn-reset-teilnehmer-data")?.addEventListener("click", () => {
        if (confirm("Möchten Sie wirklich alle lokalen Daten für diese Übung löschen? Ihr Übertragungsstatus geht verloren.")) {
            clearTeilnehmerStorage(u.id, teilnehmer);
            window.location.reload();
        }
    });
}
