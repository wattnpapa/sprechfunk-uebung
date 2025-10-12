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

}