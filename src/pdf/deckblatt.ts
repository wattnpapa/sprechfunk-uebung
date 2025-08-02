import jsPDF from "jspdf";
import { FunkUebung } from "../FunkUebung";
import { DateFormatter } from "../DateFormatter";


class Deckblatt {

    draw(pdf: jsPDF, funkUebung: FunkUebung, teilnehmer: string): void {
        // Datum kurz z.B. "19jul25"
        const dateLine = DateFormatter
            .formatNATODate(funkUebung.datum, false)
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
        const n = funkUebung.teilnehmerListe.length;
        const totalH = lh.date + lh.title + lh.owner + lh.rufgruppe + lh.blank
            + lh.hdrSection + lh.Leitung + lh.partEmpty + lh.hdrTeil
            + n * lh.teilnehmer;

        // Vertikal zentrieren
        const h = pdf.internal.pageSize.getHeight();
        const w = pdf.internal.pageSize.getWidth();
        let y = (h - totalH) / 2 + lh.date / 2;
        const centerX = (txt: string): number => (w - pdf.getTextWidth(txt)) / 2;

        // 1) Datum
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(dateLine, centerX(dateLine), y);
        y += lh.date;

        // 2) Titel
        pdf.setFont("helvetica", "bold").setFontSize(16);
        pdf.text(funkUebung.name, centerX(funkUebung.name), y);
        y += lh.title;

        // 3) Eigener Rufname
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(teilnehmer, centerX(teilnehmer), y);
        y += lh.owner;

        // 4) Rufgruppe
        pdf.text(funkUebung.rufgruppe, centerX(funkUebung.rufgruppe), y);
        y += lh.rufgruppe;

        // 5) Leerzeile
        y += lh.blank;

        // 6) Übungsleitung
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Übungsleitung:", centerX("Übungsleitung:"), y);
        y += lh.hdrSection;
        pdf.setFont("helvetica", "normal").setFontSize(12);
        pdf.text(funkUebung.leitung, centerX(funkUebung.leitung), y);
        y += lh.Leitung;

        // 7) Leer vor Teilnehmer
        y += lh.partEmpty;

        // 8) Teilnehmer-Header
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Teilnehmer:", centerX("Teilnehmer:"), y);
        y += lh.hdrTeil;

        // 9) Teilnehmerliste
        pdf.setFont("helvetica", "normal").setFontSize(8);
        funkUebung.teilnehmerListe.forEach((name: string) => {
            pdf.text(name, centerX(name), y);
            y += lh.teilnehmer;
        });

        // 10) Zweizeiliger Footer
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true);
        pdf.setFont("helvetica", "normal").setFontSize(6);
        const line1 = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id}`;
        const line2 = `Generiert: ${generierungszeit} | Generator: sprechfunk-uebung.de`;
        const y2 = h - 10;
        const y1 = y2 - 4;
        pdf.textWithLink(line1, 10, y1, { url: "https://sprechfunk-uebung.de/" });
        pdf.textWithLink(line2, 10, y2, { url: "https://sprechfunk-uebung.de/" });

        
    }
}

// Instanz der Klasse exportieren
const deckblatt = new Deckblatt();
export default deckblatt;