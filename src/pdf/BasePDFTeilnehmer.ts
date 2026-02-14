import {jsPDF} from "jspdf";
import {FunkUebung} from "../models/FunkUebung";
import {BasePDF} from "./BasePDF";

export abstract class BasePDFTeilnehmer extends BasePDF{

    protected teilnehmer: string;

    constructor(
        teilnehmer: string,
        funkUebung: FunkUebung,
        pdfInstance: jsPDF
    ) {
        super(funkUebung, pdfInstance);
        this.teilnehmer = teilnehmer;
    }

    protected getTeilnehmerAnzeigeName(name: string): string {
        const stellen = this.funkUebung.teilnehmerStellen;
        const stellenName = stellen?.[name];

        if (stellenName && stellenName.trim().length > 0) {
            return `${stellenName} (${name})`;
        }

        return name;
    }

    protected drawDebugBox(
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        this.pdf.setDrawColor(255, 0, 0); // rot
        this.pdf.setLineWidth(0.3);
        this.pdf.rect(x, y, width, height);
    }

}