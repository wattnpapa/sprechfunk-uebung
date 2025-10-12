import {BasePDF} from "./BasePDF";
import {FunkUebung} from "../FunkUebung";
import {jsPDF} from "jspdf";
import firebase from "firebase/compat";
import Blob = firebase.firestore.Blob;
import {DateFormatter} from "../DateFormatter";
import {BasePDFTeilnehmer} from "./BasePDFTeilnehmer";

export class DeckblattTeilnehmer extends BasePDFTeilnehmer {

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF) {
        super(teilnehmer, uebung, pdfInstance); // unit default 'mm'
    }

    draw(offsetX:number = 0) {
        const dateLine = DateFormatter
            .formatNATODate(this.funkUebung.datum, false)
            .replace(/\s+/g, '')
            .toLowerCase();

        // Zeilenhöhen in mm
        const lh = {
            date: 10,
            title: 12,
            owner: 10,
            rufgruppe: 10,
            blank: 8,
            hdrSection: 8,
            Leitung: 10,
            partEmpty: 10,
            hdrTeil: 4,
            teilnehmer: 4
        };

        // Gesamt-Höhe berechnen
        const n = this.funkUebung.teilnehmerListe.length;
        const totalH = lh.date + lh.title + lh.owner + lh.rufgruppe + lh.blank
            + lh.hdrSection + lh.Leitung + lh.partEmpty + lh.hdrTeil
            + n * lh.teilnehmer;

        // Vertikal zentrieren
        const h = 210;
        const w = 148;
        let y = (h - totalH) / 2 + lh.date / 2;
        const centerX = (txt: string): number => (w - this.pdf.getTextWidth(txt)) / 2 + offsetX;

        // 1) Datum
        this.pdf.setFont("helvetica", "normal").setFontSize(14);
        this.pdf.text(dateLine, centerX(dateLine), y);
        y += lh.date;

        // 2) Titel
        this.pdf.setFont("helvetica", "bold").setFontSize(16);
        this.pdf.text(this.funkUebung.name, centerX(this.funkUebung.name), y);
        y += lh.title;

        // 3) Eigener Rufname
        this.pdf.setFont("helvetica", "normal").setFontSize(14);
        this.pdf.text(this.teilnehmer, centerX(this.teilnehmer), y);
        y += lh.owner;

        // 4) Rufgruppe
        this.pdf.text(this.funkUebung.rufgruppe, centerX(this.funkUebung.rufgruppe), y);
        y += lh.rufgruppe;

        // 5) Leerzeile
        y += lh.blank;

        // 6) Übungsleitung
        this.pdf.setFont("helvetica", "bold").setFontSize(12);
        this.pdf.text("Übungsleitung:", centerX("Übungsleitung:"), y);
        y += lh.hdrSection;
        this.pdf.setFont("helvetica", "normal").setFontSize(12);
        this.pdf.text(this.funkUebung.leitung, centerX(this.funkUebung.leitung), y);
        y += lh.Leitung;

        // 7) Leer vor Teilnehmer
        y += lh.partEmpty;

        // 8) Teilnehmer-Header
        this.pdf.setFont("helvetica", "bold").setFontSize(12);
        this.pdf.text("Teilnehmer:", centerX("Teilnehmer:"), y);
        y += lh.hdrTeil;

        // 9) Teilnehmerliste
        this.pdf.setFont("helvetica", "normal").setFontSize(8);
        this.funkUebung.teilnehmerListe.forEach((name: string) => {
            this.pdf.text(name, centerX(name), y);
            y += lh.teilnehmer;
        });

        // 10) Zweizeiliger Footer
        const generierungszeit = DateFormatter.formatNATODate(this.funkUebung.createDate, true);
        this.pdf.setFont("helvetica", "normal").setFontSize(6);
        const line1 = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id}`;
        const line2 = `Generiert: ${generierungszeit} | Generator: sprechfunk-uebung.de`;
        const y2 = h - 10;
        const y1 = y2 - 4;
        this.pdf.textWithLink(line1, 10 + offsetX, y1, { url: "https://sprechfunk-uebung.de/" });
        this.pdf.textWithLink(line2, 10 + offsetX, y2, { url: "https://sprechfunk-uebung.de/" });
    }
}