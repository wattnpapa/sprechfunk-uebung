import { FunkUebung } from "../models/FunkUebung";
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { Nachricht } from "../types/Nachricht";
import { zeichneMeldevordruck } from "../vordruck/MeldevordruckRenderer";
import type { VordruckDaten } from "../vordruck/VordruckDaten";
import { vordruckDatenAusUebung } from "./vordruckDaten";

/**
 * Meldevordruck einer Übungsnachricht.
 *
 * Wie beim Nachrichtenvordruck bildet die Klasse nur Übung und Nachricht auf
 * `VordruckDaten` ab; gezeichnet wird in `src/vordruck/`.
 */
export class Meldevordruck extends BasePDFTeilnehmer {

    protected hideBackground = false;
    protected hideFooter = false;

    protected nachricht: Nachricht;

    /** Abweichende Feldwerte, gesetzt über `mitDaten`. */
    protected anpassung: Partial<VordruckDaten> = {};

    constructor(
        teilnehmer: string,
        uebung: FunkUebung,
        pdfInstance: jsPDF,
        nachricht: Nachricht,
        hideBackground = false,
        hideFooter = false
    ) {
        super(teilnehmer, uebung, pdfInstance); // unit default 'mm'
        this.nachricht = nachricht;
        this.hideBackground = hideBackground;
        this.hideFooter = hideFooter;
    }

    /** Überschreibt einzelne Felder des Vordrucks. */
    public mitDaten(anpassung: Partial<VordruckDaten>): this {
        this.anpassung = anpassung;
        return this;
    }

    /** Die Daten, die gezeichnet werden – zum Prüfen und Weiterverwenden. */
    public daten(): VordruckDaten {
        const daten = vordruckDatenAusUebung(this.teilnehmer, this.funkUebung, this.nachricht);
        return Object.assign(daten, this.anpassung);
    }

    draw(offsetX = 0): void {
        zeichneMeldevordruck(this.pdf, this.daten(), {
            offsetX,
            ohneHintergrund: this.hideBackground,
            ohneRahmen: this.hideFooter
        });
    }
}
