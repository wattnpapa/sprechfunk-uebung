import {BasePDF} from "./BasePDF";
import {FunkUebung} from "../FunkUebung";
import {jsPDF} from "jspdf";
import {BasePDFTeilnehmer} from "./BasePDFTeilnehmer";

export class Teilnehmer extends BasePDFTeilnehmer {

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF) {
        super(teilnehmer, uebung, pdfInstance)
    }

    draw(): void {

    }

}