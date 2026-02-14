import { Uebung } from "../types/Uebung";
import { formatNatoDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";

export class TeilnehmerView {

    public renderHeader(uebung: Uebung, teilnehmer: string) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }

        // Header Card
        const headerHtml = `
            <div class="card mb-4">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h3 class="card-title mb-0">Sprechfunkübung: ${uebung.name}</h3>
                    <button class="btn btn-sm btn-outline-light" id="btn-reset-teilnehmer-data">
                        <i class="fas fa-undo"></i> Lokale Daten löschen
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Eigener Funkrufname:</strong> ${teilnehmer}</p>
                            <p><strong>Datum:</strong> ${formatNatoDate(uebung.datum)}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Rufgruppe:</strong> ${uebung.rufgruppe}</p>
                            <p><strong>Übungsleitung:</strong> ${uebung.leitung}</p>
                            ${uebung.loesungswoerter?.[teilnehmer] ? `<p><strong>Lösungswort:</strong> <code class="fs-5">${uebung.loesungswoerter[teilnehmer]}</code></p>` : ""}
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>Meine Funksprüche</h4>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted">
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
                    <tbody id="teilnehmerNachrichtenBody"></tbody>
                </table>
            </div>
        `;

        container.innerHTML = headerHtml;
    }

    public renderNachrichten(
        nachrichten: Nachricht[], 
        storage: TeilnehmerStorage
    ) {
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (!tbody) {
            return;
        }

        // Update Toggle State (if re-rendering, keep UI in sync with storage)
        const toggle = document.getElementById("toggle-hide-transmitted") as HTMLInputElement;
        if (toggle) {
            toggle.checked = storage.hideTransmitted;
        }

        const rows = nachrichten
            .filter(n => {
                if (storage.hideTransmitted) {
                    return !storage.nachrichten[n.id]?.uebertragen;
                }
                return true;
            })
            .map(n => {
                const status = storage.nachrichten[n.id];
                const isUebertragen = !!status?.uebertragen;

                return `
            <tr class="${isUebertragen ? "table-success opacity-50" : ""}">
                <td>${n.id}</td>
                <td>${n.empfaenger.join(", ")}</td>
                <td>${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}</td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input btn-toggle-uebertragen" type="checkbox" 
                            data-id="${n.id}" ${isUebertragen ? "checked" : ""}>
                        <label class="form-check-label small">Übertragen</label>
                    </div>
                </td>
            </tr>
        `;
            }).join("");

        tbody.innerHTML = rows || "<tr><td colspan=\"4\" class=\"text-center text-muted\">Keine Nachrichten vorhanden.</td></tr>";
    }

    public bindEvents(
        onToggleUebertragen: (id: number, checked: boolean) => void,
        onToggleHide: (checked: boolean) => void,
        onReset: () => void
    ) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }

        // Reset Button
        document.getElementById("btn-reset-teilnehmer-data")?.addEventListener("click", onReset);

        // Hide Toggle
        document.getElementById("toggle-hide-transmitted")?.addEventListener("change", e => {
            onToggleHide((e.target as HTMLInputElement).checked);
        });

        // Delegation for dynamic rows
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (tbody) {
            tbody.addEventListener("change", e => {
                const target = e.target as HTMLInputElement;
                if (target.classList.contains("btn-toggle-uebertragen")) {
                    const id = Number(target.dataset["id"]);
                    onToggleUebertragen(id, target.checked);
                }
            });
        }
    }
}
