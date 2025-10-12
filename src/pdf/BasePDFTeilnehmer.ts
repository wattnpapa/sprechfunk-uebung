import {jsPDF} from "jspdf";
import {FunkUebung} from "../FunkUebung";
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


}