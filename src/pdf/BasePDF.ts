import {jsPDF} from "jspdf";
import {FunkUebung} from "../FunkUebung";

export abstract class BasePDF {

    protected funkUebung: FunkUebung;

    protected pdf: jsPDF;

    protected pdfWidth: number;
    protected pdfHeight: number;

    constructor(
        funkUebung: FunkUebung,
        pdfInstance: jsPDF
    ) {
        this.funkUebung = funkUebung;

        this.pdf = pdfInstance;
        this.pdfWidth = this.pdf.internal.pageSize.getWidth();
        this.pdfHeight = this.pdf.internal.pageSize.getHeight();
    }


    public blob() : Blob {
        return this.pdf.output('blob');
    }

    public abstract draw(offsetX: number) : void

    protected adjustTextForWidth(text: string, maxWidth: number, x: number, y: number) {
        let fontSize = 12;
        this.pdf.setFontSize(fontSize);

        while (this.pdf.getTextWidth(text) > maxWidth && fontSize > 7) {
            fontSize -= 0.5; // Schrittweise verkleinern
            this.pdf.setFontSize(fontSize);
        }

        this.pdf.text(text, x, y);
    }

    /**
     * Zeichnet Text in mehreren Zeilen.
     * - Respektiert explizite Zeilenumbrüche ("\\n")
     * - Bricht jede Zeile zusätzlich automatisch um (maxWidth)
     */
    /**
     * Zeichnet Text mehrzeilig mit automatischem Umbruch.
     * - Respektiert explizite Zeilenumbrüche ("\n")
     * - Nutzt jsPDF-eigenes Wrapping (maxWidth)
     * - Verhindert buchstabenweises Auseinanderziehen
     */
    protected drawMultilineText(
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number
    ): void {
        if (!text) return;

        // echte Zeilenumbrüche sicherstellen
        const normalized = String(text).replace(/\\n/g, "\n");

        const paragraphs = normalized.split("\n");

        let currentY = y;

        paragraphs.forEach((paragraph) => {
            // Leerzeile → Abstand
            if (paragraph.trim() === "") {
                currentY += lineHeight;
                return;
            }

            // Text zeichnen (jsPDF übernimmt Umbruch!)
            // @ts-ignore
            this.pdf.text(paragraph, x, currentY, {
                maxWidth: maxWidth,
                overflow: "linebreak"
            });

            // Höhe berechnen, die jsPDF tatsächlich benötigt hat
            const dimensions = this.pdf.getTextDimensions(paragraph, {
                maxWidth: maxWidth
            });

            // y-Position für nächsten Absatz erhöhen
            currentY += dimensions.h;
        });
    }
}