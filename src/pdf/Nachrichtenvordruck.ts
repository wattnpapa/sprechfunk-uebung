import { FunkUebung } from "../models/FunkUebung";
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { Nachricht } from "../types/Nachricht";
import { zeichneNachrichtenvordruck } from "../vordruck/NachrichtenvordruckRenderer";
import type { VordruckDaten } from "../vordruck/VordruckDaten";
import { vordruckDatenAusUebung } from "./vordruckDaten";

/**
 * Nachrichtenvordruck einer Übungsnachricht.
 *
 * Die Klasse bildet nur noch Übung und Nachricht auf `VordruckDaten` ab; das
 * Zeichnen liegt in `src/vordruck/`, das ohne Übungsbegriffe auskommt.
 */
export class Nachrichtenvordruck extends BasePDFTeilnehmer {

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

    /**
     * Überschreibt einzelne Felder des Vordrucks – etwa Vorrang, Vermerke oder
     * die Quittung, die eine Sprechfunkübung nicht kennt.
     *
     * Bewusst ein Setter und kein weiterer Konstruktorparameter: die Signatur
     * ist schon lang, und der Übungsbetrieb kommt ohne Anpassung aus.
     */
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
        zeichneNachrichtenvordruck(this.pdf, this.daten(), {
            offsetX,
            ohneHintergrund: this.hideBackground,
            ohneRahmen: this.hideFooter
        });
    }
}
