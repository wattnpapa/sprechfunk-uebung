import { jsPDF } from "jspdf";
import {FunkUebung} from "../models/FunkUebung";
import { BasePDF } from "./BasePDF";

export abstract class BasePDFTeilnehmer extends BasePDF {
    protected teilnehmer: string;

    constructor(teilnehmer: string, funkUebung: FunkUebung, pdf: jsPDF) {
        super(funkUebung, pdf);
        this.teilnehmer = teilnehmer;
    }
}
