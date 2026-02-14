import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { formatNatoDate } from "../utils/date";

export class DeckblattTeilnehmer extends BasePDFTeilnehmer {

    draw(xOffset = 0) {
        const startY = 40;
        const centerX = xOffset + 74; // A5 Mitte (148/2)

        this.addText("Sprechfunkübung", centerX, startY, 18, "bold", "center");
        this.addText(this.funkUebung.name, centerX, startY + 10, 14, "normal", "center");

        this.addText("Teilnehmer:", centerX, startY + 30, 12, "bold", "center");
        this.addText(this.teilnehmer, centerX, startY + 40, 16, "bold", "center");

        this.addText("Rufgruppe:", centerX, startY + 60, 12, "bold", "center");
        this.addText(this.funkUebung.rufgruppe, centerX, startY + 70, 14, "normal", "center");

        this.addText("Datum:", centerX, startY + 90, 12, "bold", "center");
        this.addText(formatNatoDate(this.funkUebung.datum), centerX, startY + 100, 14, "normal", "center");

        const loesungswort = this.funkUebung.loesungswoerter?.[this.teilnehmer];
        if (loesungswort) {
            this.addText("Lösungswort:", centerX, startY + 120, 12, "bold", "center");
            this.addText(loesungswort, centerX, startY + 130, 14, "normal", "center");
        }
    }
}
