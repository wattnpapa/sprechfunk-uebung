import { jsPDF } from "jspdf";
import {FunkUebung} from "../models/FunkUebung";

export abstract class BasePDF {
    protected pdf: jsPDF;
    protected funkUebung: FunkUebung;

    constructor(funkUebung: FunkUebung, pdf: jsPDF) {
        this.funkUebung = funkUebung;
        this.pdf = pdf;
    }

    abstract draw(xOffset?: number): void;

    protected addText(text: string, x: number, y: number, fontSize = 10, fontStyle = "normal", align: "left" | "center" | "right" = "left") {
        this.pdf.setFontSize(fontSize);
        this.pdf.setFont("helvetica", fontStyle);
        this.pdf.text(text, x, y, { align: align });
    }

    protected addRect(x: number, y: number, w: number, h: number) {
        this.pdf.rect(x, y, w, h);
    }

    protected addLine(x1: number, y1: number, x2: number, y2: number) {
        this.pdf.line(x1, y1, x2, y2);
    }

    protected addWrappedText(text: string, x: number, y: number, maxWidth: number, fontSize = 10, fontStyle = "normal") {
        this.pdf.setFontSize(fontSize);
        this.pdf.setFont("helvetica", fontStyle);
        const lines = this.pdf.splitTextToSize(text, maxWidth);
        this.pdf.text(lines, x, y);
        return lines.length * (fontSize * 0.3527); // Ungefähre Höhe in mm zurückgeben
    }

    protected addCheckbox(x: number, y: number, size = 4, checked = false) {
        this.pdf.rect(x, y, size, size);
        if (checked) {
            this.pdf.line(x, y, x + size, y + size);
            this.pdf.line(x + size, y, x, y + size);
        }
    }

    protected addTable(headers: string[], data: string[][], startY: number, startX: number, colWidths: number[] = []) {
        // @ts-expect-error jsPDF autotable types
        this.pdf.autoTable({
            head: [headers],
            body: data,
            startY: startY,
            margin: { left: startX },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            columnStyles: colWidths.reduce((acc: any, width, index) => {
                acc[index] = { cellWidth: width };
                return acc;
            }, {}),
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 1 },
            headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold" }
        });
    }
}
