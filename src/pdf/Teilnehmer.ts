import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { formatNatoDate } from "../utils/date";

export class Teilnehmer extends BasePDFTeilnehmer {

    draw() {
        const startY = 20;
        const margin = 20;
        const width = 297 - 2 * margin;

        // Header
        this.addText(`Übung: ${this.funkUebung.name}`, margin, startY, 16, "bold");
        this.addText(`Teilnehmer: ${this.teilnehmer}`, margin, startY + 10, 14, "normal");
        this.addText(`Datum: ${formatNatoDate(this.funkUebung.datum)}`, margin + width - 50, startY, 10, "normal", "right");

        // Tabelle
        const headers = ["Nr.", "Empfänger", "Nachricht"];
        const data = (this.funkUebung.nachrichten[this.teilnehmer] || []).map(n => [
            n.id.toString(),
            n.empfaenger.join(", "),
            n.nachricht
        ]);

        this.addTable(headers, data, startY + 20, margin, [15, 50, 190]);
    }
}
