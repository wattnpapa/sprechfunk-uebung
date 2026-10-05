interface PdfViewport { width: number; height: number }

interface PdfPage {
    getViewport: (options: { scale: number; rotation?: number }) => PdfViewport;
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
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
        }).catch((err: unknown) => {
            // Ein Fehlschlag (z. B. kurz kein Netz) darf nicht bis zum
            // Neuladen haften bleiben: beim nächsten Blättern neu versuchen.
            pdfJsPromise = null;
            throw err;
        });
    }
    return pdfJsPromise;
};

/** Platzhalter im Vordruck-Fenster, wenn die Vorschau nicht gezeichnet werden kann. */
const VORSCHAU_FEHLER_ID = "teilnehmerPdfFehler";

/** Seitenanzeige und Blätterknöpfe im Vordruck-Fenster. */
function aktualisiereSeitenNavigation(page: number, totalPages: number): void {
    const label = document.getElementById("teilnehmerDocPage");
    const prevBtn = document.getElementById("btn-doc-prev") as HTMLButtonElement | null;
    const nextBtn = document.getElementById("btn-doc-next") as HTMLButtonElement | null;
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

/** Maßstab, mit dem die Seite vollständig in den Container passt. */
function passenderMassstab(container: HTMLElement, base: PdfViewport): number {
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width || container.clientWidth || base.width;
    const containerHeight = rect.height || container.clientHeight || base.height;
    return Math.min(containerWidth / base.width, containerHeight / base.height);
}

async function zeichneSeite(blob: Blob, canvas: HTMLCanvasElement, container: HTMLElement): Promise<void> {
    // ensure layout is measured correctly after modal/render changes
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

    const pdfjs = await loadPdfJs();
    const buffer = await blob.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pdfPage = await pdf.getPage(1);

    const scale = passenderMassstab(container, pdfPage.getViewport({ scale: 1, rotation: 0 }));
    const dpr = window.devicePixelRatio || 1;
    const viewport = pdfPage.getViewport({ scale, rotation: 0 });
    const hiResViewport = pdfPage.getViewport({ scale: scale * dpr, rotation: 0 });

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

/** Zeichnet den Vordruck per pdf.js und bietet bei Fehlern einen Ausweg an. */
export class VordruckVorschau {
    /** Objekt-URL des Vordrucks für den Ausweg „PDF öffnen“, wird je Seite ersetzt. */
    private vorschauFallbackUrl: string | null = null;

    public async renderPdfPage(blob: Blob, page: number, totalPages: number): Promise<void> {
        const canvas = document.getElementById("teilnehmerPdfCanvas") as HTMLCanvasElement | null;
        const container = document.getElementById("teilnehmerPdfView");
        aktualisiereSeitenNavigation(page, totalPages);

        if (!canvas || !container) {
            return;
        }
        try {
            await zeichneSeite(blob, canvas, container);
            this.zeigeVorschauFehler(container, canvas, null);
        } catch (err) {
            console.error("Vordruck-Vorschau fehlgeschlagen:", err);
            this.zeigeVorschauFehler(container, canvas, blob);
        }
    }

    /**
     * Zeigt statt eines leeren Rahmens eine Meldung mit Ausweg, wenn pdf.js
     * die Seite nicht zeichnen kann (alter Browser, kein Netz beim ersten
     * Laden). `blob === null` räumt die Meldung nach Erfolg wieder ab.
     */
    private zeigeVorschauFehler(container: HTMLElement, canvas: HTMLCanvasElement, blob: Blob | null): void {
        if (this.vorschauFallbackUrl) {
            URL.revokeObjectURL(this.vorschauFallbackUrl);
            this.vorschauFallbackUrl = null;
        }
        container.querySelector(`#${VORSCHAU_FEHLER_ID}`)?.remove();
        if (!blob) {
            canvas.classList.remove("d-none");
            return;
        }
        canvas.classList.add("d-none");
        this.vorschauFallbackUrl = URL.createObjectURL(blob);
        const hinweis = document.createElement("div");
        hinweis.id = VORSCHAU_FEHLER_ID;
        hinweis.className = "alert alert-warning m-3 teilnehmer-doc-fehler";
        hinweis.setAttribute("role", "alert");
        hinweis.innerHTML = `
            <p class="mb-2"><strong>Die Vorschau lässt sich hier nicht anzeigen.</strong></p>
            <p class="mb-3">Öffne den Vordruck als PDF oder arbeite mit der Tabelle weiter.
            Ohne Netz hilft auch der Ausdruck aus dem ZIP.</p>
            <a class="btn btn-primary" href="${this.vorschauFallbackUrl}" target="_blank" rel="noopener"
               data-testid="vordruck-pdf-oeffnen">Vordruck als PDF öffnen</a>`;
        container.appendChild(hinweis);
    }
}

function fokussiereSchliessen(): void {
    window.setTimeout(() => {
        (document.getElementById("btn-doc-close") as HTMLButtonElement | null)?.focus();
    }, 0);
}

interface BootstrapModalApi {
    getOrCreateInstance: (el: HTMLElement) => { show: () => void; hide: () => void };
}

/** Öffnet oder schließt das Vordruck-Fenster (Bootstrap oder Rückfallebene). */
export function togglePdfModal(show: boolean): void {
    const modalEl = document.getElementById("teilnehmerDocModal");
    if (!modalEl) {
        return;
    }
    // Innerhalb der Ansicht bildet ein Vorfahr einen eigenen Stapel- und
    // Positionierungskontext: das Fenster lag dann unter dem fixierten
    // App-Kopf und war am Handy nicht bildschirmfüllend.
    if (show && modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
    }
    const bootstrapModal = (window as unknown as { bootstrap?: { Modal?: BootstrapModalApi } }).bootstrap?.Modal;
    if (bootstrapModal) {
        const instance = bootstrapModal.getOrCreateInstance(modalEl);
        if (show) {
            instance.show();
            fokussiereSchliessen();
        } else {
            instance.hide();
        }
        return;
    }
    modalEl.classList.toggle("show", show);
    modalEl.style.display = show ? "block" : "none";
    document.body.classList.toggle("modal-open", show);
    if (show) {
        fokussiereSchliessen();
    }
}

function statusText(isTransmitted: boolean, vorhanden: boolean): string {
    if (!vorhanden) {
        return "kein Spruch";
    }
    return isTransmitted ? "✓ abgesetzt" : "offen";
}

/**
 * Zustand des angezeigten Vordrucks: Statusanzeige und Touch-Knopf. Der
 * Knopf wechselt zwischen „Als abgesetzt markieren“ und „Zurücknehmen“;
 * ein Doppeltipp ist durch die Kontextsperre in bindEvents abgefangen.
 */
export function setzeVordruckStatus(isTransmitted: boolean, vorhanden: boolean): void {
    const modal = document.getElementById("teilnehmerDocModal");
    modal?.classList.toggle("teilnehmer-doc-modal--done", isTransmitted);

    const status = document.getElementById("teilnehmerDocStatus");
    if (status) {
        status.className = `status-chip ${isTransmitted ? "status-chip--ok" : "status-chip--pending"}`;
        status.textContent = statusText(isTransmitted, vorhanden);
    }
    const btn = document.getElementById("btn-doc-absetzen") as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = !vorhanden;
        btn.dataset["aktion"] = isTransmitted ? "zuruecknehmen" : "absetzen";
        btn.className = `btn ${isTransmitted ? "btn-outline-secondary" : "btn-success"} teilnehmer-doc-absetzen`;
        btn.textContent = isTransmitted ? "Zurücknehmen (wieder offen)" : "✓ Als abgesetzt markieren";
    }
}
