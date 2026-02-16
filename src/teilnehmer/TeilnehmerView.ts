import { Uebung } from "../types/Uebung";
import { formatNatoDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";

interface PdfPage {
    getViewport: (options: { scale: number; rotation?: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
    rotate?: number;
}

interface PdfJsModule {
    getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<{ getPage: (n: number) => Promise<PdfPage> }> };
    GlobalWorkerOptions: { workerSrc: string };
}

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = async (): Promise<PdfJsModule> => {
    if (!pdfJsPromise) {
        const pdfUrl = new URL("pdfjs/pdf.min.js", import.meta.url).toString();
        const workerUrl = new URL("pdfjs/pdf.worker.min.js", import.meta.url).toString();
        pdfJsPromise = import(/* @vite-ignore */ pdfUrl).then(mod => {
            const pdf = mod as PdfJsModule;
            pdf.GlobalWorkerOptions.workerSrc = workerUrl;
            return pdf;
        });
    }
    return pdfJsPromise;
};

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
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-light" id="btn-download-teilnehmer-zip" data-analytics-id="teilnehmer-download-zip">
                            <i class="fas fa-file-archive"></i> ZIP herunterladen
                        </button>
                        <button class="btn btn-sm btn-outline-light" id="btn-reset-teilnehmer-data" data-analytics-id="teilnehmer-reset-local-data">
                            <i class="fas fa-undo"></i> Lokale Daten löschen
                        </button>
                    </div>
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
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <h4 class="mb-0">Meine Funksprüche</h4>
                <div class="btn-group" role="group" aria-label="Ansicht wählen">
                    <button class="btn btn-outline-primary active" type="button" data-doc-view="table" data-analytics-id="teilnehmer-docmode-table">Tabelle</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="meldevordruck" data-analytics-id="teilnehmer-docmode-melde">Meldevordruck</button>
                    <button class="btn btn-outline-primary" type="button" data-doc-view="nachrichtenvordruck" data-analytics-id="teilnehmer-docmode-nachricht">Nachrichtenvordruck</button>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted">
                    <label class="form-check-label" for="toggle-hide-transmitted">Übertragene ausblenden</label>
                </div>
            </div>
            <div class="mb-2">
                <input type="search" class="form-control form-control-sm" id="teilnehmerSearchInput" placeholder="Nachrichten filtern (Nr, Empfänger, Text)">
            </div>

            <div id="teilnehmerTableView" class="table-responsive">
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

            <div class="modal fade teilnehmer-doc-modal" id="teilnehmerDocModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Vordruck</h5>
                            <div class="form-check form-switch ms-3">
                                <input class="form-check-input" type="checkbox" id="toggle-hide-transmitted-modal">
                                <label class="form-check-label small" for="toggle-hide-transmitted-modal">Übertragene ausblenden</label>
                            </div>
                            <button type="button" class="btn-close" id="btn-doc-close" data-analytics-id="teilnehmer-doc-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="teilnehmer-doc-layout">
                                <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-prev" data-analytics-id="teilnehmer-doc-prev">
                                    <i class="fas fa-chevron-left"></i> Zurück
                                </button>
                                <div class="teilnehmer-doc-center">
                                    <div id="teilnehmerPdfView" class="teilnehmer-doc-container">
                                        <canvas id="teilnehmerPdfCanvas" class="teilnehmer-doc-canvas"></canvas>
                                    </div>
                                    <span id="teilnehmerDocPage" class="text-muted teilnehmer-doc-page"></span>
                                </div>
                                <button class="btn btn-outline-secondary teilnehmer-doc-nav" type="button" id="btn-doc-next" data-analytics-id="teilnehmer-doc-next">
                                    Weiter <i class="fas fa-chevron-right"></i>
                                </button>
                                <div class="teilnehmer-doc-legend">
                                    <div><span class="badge bg-light text-dark">←/→</span> <span class="small text-muted">Blättern</span></div>
                                    <div><span class="badge bg-light text-dark">Space</span> <span class="small text-muted">Übertragen</span></div>
                                    <div><span class="badge bg-light text-dark">Ü</span> <span class="small text-muted">Übertragene ausblenden</span></div>
                                    <div><span class="badge bg-light text-dark">M</span> <span class="small text-muted">Meldevordruck</span></div>
                                    <div><span class="badge bg-light text-dark">N</span> <span class="small text-muted">Nachrichtenvordruck</span></div>
                                    <div><span class="badge bg-light text-dark">Esc</span> <span class="small text-muted">Schließen</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
        const toggleModal = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement;
        if (toggleModal) {
            toggleModal.checked = storage.hideTransmitted;
        }

        const rows = nachrichten
            .filter(n => {
                const search = (document.getElementById("teilnehmerSearchInput") as HTMLInputElement | null)?.value?.trim().toLowerCase() ?? "";
                if (search) {
                    const haystack = `${n.id} ${n.empfaenger.join(" ")} ${n.nachricht}`.toLowerCase();
                    if (!haystack.includes(search)) {
                        return false;
                    }
                }
                if (storage.hideTransmitted) {
                    return !storage.nachrichten[n.id]?.uebertragen;
                }
                return true;
            })
            .map(n => {
                const status = storage.nachrichten[n.id];
                const isUebertragen = !!status?.uebertragen;
                const toggleId = `toggle-uebertragen-${n.id}`;

                return `
            <tr class="${isUebertragen ? "status-ok-row" : "status-pending-row"}">
                <td>${n.id}</td>
                <td>${n.empfaenger.join(", ")}</td>
                <td>${escapeHtml(n.nachricht).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}</td>
                <td>
                    <div class="form-check form-switch d-flex align-items-center gap-2">
                        <button type="button"
                            class="status-chip ${isUebertragen ? "status-chip--ok" : "status-chip--pending"} btn-toggle-uebertragen-chip"
                            data-id="${n.id}"
                            data-analytics-id="teilnehmer-toggle-chip-${n.id}"
                            data-checked="${isUebertragen ? "1" : "0"}">
                            ${isUebertragen ? "übertragen" : "offen"}
                        </button>
                        <input class="form-check-input btn-toggle-uebertragen" type="checkbox" 
                            id="${toggleId}"
                            data-id="${n.id}" ${isUebertragen ? "checked" : ""}>
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
        onReset: () => void,
        onDocViewChange: (mode: "table" | "meldevordruck" | "nachrichtenvordruck") => void,
        onDocPrev: () => void,
        onDocNext: () => void,
        onDocClose: () => void,
        onDocToggleCurrent: () => void,
        onDownloadZip: () => void,
        onSearch: () => void
    ) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }

        // Reset Button
        document.getElementById("btn-reset-teilnehmer-data")?.addEventListener("click", onReset);
        document.getElementById("btn-download-teilnehmer-zip")?.addEventListener("click", onDownloadZip);

        // Hide Toggle
        document.getElementById("toggle-hide-transmitted")?.addEventListener("change", e => {
            onToggleHide((e.target as HTMLInputElement).checked);
        });
        document.getElementById("toggle-hide-transmitted-modal")?.addEventListener("change", e => {
            onToggleHide((e.target as HTMLInputElement).checked);
        });
        document.getElementById("teilnehmerSearchInput")?.addEventListener("input", () => onSearch());

        document.querySelectorAll<HTMLButtonElement>("[data-doc-view]").forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.dataset["docView"] as "table" | "meldevordruck" | "nachrichtenvordruck" | undefined;
                if (mode) {
                    onDocViewChange(mode);
                }
            });
        });

        document.getElementById("btn-doc-prev")?.addEventListener("click", onDocPrev);
        document.getElementById("btn-doc-next")?.addEventListener("click", onDocNext);
        document.getElementById("btn-doc-close")?.addEventListener("click", onDocClose);

        document.addEventListener("keydown", e => {
            const target = e.target as HTMLElement | null;
            const isTypingTarget = !!target && (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.tagName === "SELECT" ||
                target.isContentEditable
            );

            if (e.code === "Space" && !isTypingTarget && document.getElementById("teilnehmerDocModal")?.classList.contains("show")) {
                e.preventDefault();
                onDocToggleCurrent();
                return;
            }
            // `[` is a practical fallback on non-DE keyboard layouts (e.g. CI runners).
            if (e.key === "ü" || e.key === "Ü" || e.key === "[") {
                const toggle = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement | null;
                if (toggle) {
                    toggle.checked = !toggle.checked;
                    onToggleHide(toggle.checked);
                }
                return;
            }
            if (e.key === "m" || e.key === "M") {
                onDocViewChange("meldevordruck");
                return;
            }
            if (e.key === "n" || e.key === "N") {
                onDocViewChange("nachrichtenvordruck");
                return;
            }
            if (e.key === "Escape") {
                onDocClose();
                return;
            }
            if (e.key === "ArrowLeft") {
                onDocPrev();
                return;
            }
            if (e.key === "ArrowRight") {
                onDocNext();
            }
        });

        // Delegation for dynamic rows
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (tbody) {
            const handleToggleEvent = (event: Event) => {
                const target = event.target as HTMLInputElement;
                if (!target.classList.contains("btn-toggle-uebertragen")) {
                    return;
                }
                const id = Number(target.dataset["id"]);
                if (!Number.isFinite(id)) {
                    return;
                }
                onToggleUebertragen(id, target.checked);
            };
            tbody.addEventListener("change", handleToggleEvent);
            tbody.addEventListener("click", handleToggleEvent);
            tbody.addEventListener("click", event => {
                const target = event.target as HTMLElement;
                const chip = target.closest(".btn-toggle-uebertragen-chip") as HTMLElement | null;
                if (!chip) {
                    return;
                }
                const id = Number(chip.dataset["id"]);
                const checked = chip.dataset["checked"] === "1";
                if (!Number.isFinite(id)) {
                    return;
                }
                onToggleUebertragen(id, !checked);
            });
        }

    }

    public setDocMode(mode: "table" | "meldevordruck" | "nachrichtenvordruck") {
        const tableView = document.getElementById("teilnehmerTableView");
        const buttons = document.querySelectorAll<HTMLButtonElement>("[data-doc-view]");

        buttons.forEach(btn => {
            const isActive = btn.dataset["docView"] === mode;
            btn.classList.toggle("active", isActive);
        });

        const showPdf = mode !== "table";
        tableView?.classList.toggle("d-none", showPdf);
        this.togglePdfModal(showPdf);
    }

    public async renderPdfPage(blob: Blob, page: number, totalPages: number) {
        const canvas = document.getElementById("teilnehmerPdfCanvas") as HTMLCanvasElement | null;
        const container = document.getElementById("teilnehmerPdfView");
        const label = document.getElementById("teilnehmerDocPage");
        const prevBtn = document.getElementById("btn-doc-prev") as HTMLButtonElement | null;
        const nextBtn = document.getElementById("btn-doc-next") as HTMLButtonElement | null;

        if (canvas && container) {
            // ensure layout is measured correctly after modal/render changes
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

            const pdfjs = await loadPdfJs();
            const buffer = await blob.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: buffer }).promise;
            const pdfPage = await pdf.getPage(1);

            const rotation = pdfPage.rotate ?? 0;
            const baseViewport = pdfPage.getViewport({ scale: 1, rotation });
            const rect = container.getBoundingClientRect();
            const containerWidth = rect.width || container.clientWidth || baseViewport.width;
            const containerHeight = rect.height || container.clientHeight || baseViewport.height;
            const scale = Math.min(
                containerWidth / baseViewport.width,
                containerHeight / baseViewport.height
            );
            const dpr = window.devicePixelRatio || 1;
            const viewport = pdfPage.getViewport({ scale, rotation });
            const hiResViewport = pdfPage.getViewport({ scale: scale * dpr, rotation });

            canvas.width = Math.floor(hiResViewport.width);
            canvas.height = Math.floor(hiResViewport.height);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                await pdfPage.render({ canvasContext: ctx, viewport: hiResViewport }).promise;
            }
        }
        if (label) {
            label.textContent = `Seite ${page} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = page <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = page >= totalPages;
        }
    }

    public setDocTransmitted(isTransmitted: boolean) {
        const modal = document.getElementById("teilnehmerDocModal");
        modal?.classList.toggle("teilnehmer-doc-modal--done", isTransmitted);
    }

    private togglePdfModal(show: boolean) {
        const modalEl = document.getElementById("teilnehmerDocModal");
        if (!modalEl) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bootstrapModal = (window as any).bootstrap?.Modal;
        if (bootstrapModal) {
            const instance = bootstrapModal.getOrCreateInstance(modalEl);
            if (show) {
                instance.show();
            } else {
                instance.hide();
            }
            return;
        }
        modalEl.classList.toggle("show", show);
        modalEl.style.display = show ? "block" : "none";
        document.body.classList.toggle("modal-open", show);
    }
}
