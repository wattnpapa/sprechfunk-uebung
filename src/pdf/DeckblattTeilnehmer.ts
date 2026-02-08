import {BasePDF} from "./BasePDF";
import {FunkUebung} from "../FunkUebung";
import {jsPDF} from "jspdf";
import firebase from "firebase/compat";
import Blob = firebase.firestore.Blob;
import { formatNatoDate } from "../utils/date";
import {BasePDFTeilnehmer} from "./BasePDFTeilnehmer";

export class DeckblattTeilnehmer extends BasePDFTeilnehmer {

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF) {
        super(teilnehmer, uebung, pdfInstance); // unit default 'mm'
    }

    draw(offsetX: number = 0) {
        const dateLine = formatNatoDate(this.funkUebung.datum, false)
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

        // 3) Eigener Teilnehmer – Stelle und Funkrufname getrennt
        const stellenName = this.funkUebung.teilnehmerStellen?.[this.teilnehmer];

        if (stellenName && stellenName.trim().length > 0) {
            // Zeile 1: Stellenname
            this.pdf.setFont("helvetica", "normal").setFontSize(14);
            y += this.drawCenteredMultilineText(
                stellenName,
                y,
                120,
                lh.owner,
                offsetX
            );
        }

        // Zeile 2: Funkrufname
        const funk = `${this.teilnehmer}`;
        this.pdf.setFont("helvetica", "normal").setFontSize(12);
        y += this.drawCenteredMultilineText(
            funk,
            y,
            120,
            lh.owner,
            offsetX
        );

        // Wenn kein Stellenname vorhanden → bewusst nichts anzeigen

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
            const anzeigename = this.getTeilnehmerAnzeigeName(name);
            y += this.drawCenteredMultilineText(
                anzeigename,
                y,
                120,
                lh.teilnehmer,
                offsetX
            );
        });

        // 10) Zweizeiliger Footer
        const generierungszeit = formatNatoDate(this.funkUebung.createDate, true);
        this.pdf.setFont("helvetica", "normal").setFontSize(6);
        const line1 = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id}`;
        const line2 = `Generiert: ${generierungszeit} | Generator: sprechfunk-uebung.de`;
        const y2 = h - 10;
        const y1 = y2 - 4;
        this.pdf.textWithLink(line1, 10 + offsetX, y1, {url: "https://sprechfunk-uebung.de/"});
        this.pdf.textWithLink(line2, 10 + offsetX, y2, {url: "https://sprechfunk-uebung.de/"});
    }

    /**
     * Zeichnet mehrzeiligen Text zentriert und gibt die benötigte Gesamthöhe zurück.
     */
    private drawCenteredMultilineText(
        text: string,
        y: number,
        maxWidth: number,
        lineHeight: number,
        offsetX: number = 0
    ): number {
        const lines = this.pdf.splitTextToSize(text, maxWidth);

        lines.forEach((line: string, index: number) => {
            const x = (148 - this.pdf.getTextWidth(line)) / 2 + offsetX;
            this.pdf.text(line, x, y + index * lineHeight);
        });

        return lines.length * lineHeight;
    }
}

