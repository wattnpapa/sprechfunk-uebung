import { jsPDF } from 'jspdf'
import { FunkUebung } from '../FunkUebung'
import { Nachricht } from '../types/Nachricht'
import deckblatt from './deckblatt';

class NachrichtenvordruckPdf {

    draw(pdf: jsPDF, funkUebung: FunkUebung, teilnehmer: string, nachricht: Nachricht, offsetX: number = 0,
        hideBackground: boolean = false,
        hideFooter: boolean = false) {
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        const width = 148, height = 210;
        // Hintergrundbild positionieren
        if (!hideBackground) pdf.addImage(templateImageUrl, 'PNG', offsetX, 0, width, height);

        // FM Zentrale
        pdf.setFontSize(16);
        pdf.text('x', offsetX + 15.4, 9);
        pdf.setFontSize(10);
        pdf.text(`${nachricht.id}`, offsetX + 125.5, 17);
        pdf.setFontSize(16);
        pdf.text('x', offsetX + 122.2, 27.5);
        // Ausgang
        pdf.text('x', offsetX + 18.6, 42.5);

        // Absender
        pdf.setFontSize(12);
        pdf.text(`${teilnehmer}`, offsetX + 44, 155);

        // Empfänger und Anschrift
        let empText = nachricht.empfaenger.includes('Alle') ? 'Alle' : nachricht.empfaenger.join(', ');
        this.adjustTextForWidth(pdf, empText, 70, offsetX + 58, 35);
        this.adjustTextForWidth(pdf, empText, 70, offsetX + 42, 55);

        // Nachricht umbrochen
        pdf.setFontSize(12);
        const lineHeight = 6.5;
        const msgLines = pdf.splitTextToSize(nachricht.nachricht, 120);
        let startY = 77;
        msgLines.forEach((line: string, i: number) => {
            pdf.text(line, offsetX + 17, startY + i * lineHeight);
        });

        // Footer (compact)
        if (!hideFooter) {
            const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true);
            this.drawCompactFooter(
                pdf,
                funkUebung,
                generierungszeit,
                148,
                210,
                offsetX
            );
        }
    }

    getBlob(funkUebung: FunkUebung) {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new jsPDF("p", "mm", "a5");
            deckblatt.draw(pdf, funkUebung, teilnehmer);
            pdf.addPage();

            nachrichten.forEach((nachricht: Nachricht, index: number) => {
                this.draw(pdf, funkUebung, teilnehmer, nachricht);
                if (index < nachrichten.length - 1) pdf.addPage();
            });

            const totalPages = (pdf as any).getNumberOfPages();
            for (let j = 2; j <= totalPages; j++) {
                pdf.setPage(j);
            }

            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });
    }


}

// Instanz der Klasse exportieren
const pdfGenerator = new NachrichtenvordruckPdf();
export default NachrichtenvordruckPdf;