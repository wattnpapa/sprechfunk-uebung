import type { jsPDF } from "jspdf";
import { qrMatrix } from "../../scripts/lib/qrcode.mjs";

/**
 * Zugangsdaten auf Papier (THW-Review 2026-10-04, analog-first P2-1,
 * workflow F5): Wer auf Papier begonnen hat, soll mit dem Blatt allein
 * zurück in seine Ansicht finden – Übungscode und Teilnehmercode zum
 * Abschreiben, dazu ein QR-Code auf den Teilnehmer-Link.
 */

/** Adresse der App, wenn die Seite nicht über http(s) läuft (Electron, Tests). */
export const STANDARD_BASIS_URL = "https://sprechfunk-uebung.de/";

interface MitZugang {
    uebungCode?: string;
    teilnehmerIds?: Record<string, string>;
}

/** Basisadresse der laufenden App, wie sie auch der Linkbereich des Generators nutzt. */
export function appBasisUrl(): string {
    if (typeof window === "undefined" || !window.location) {
        return STANDARD_BASIS_URL;
    }
    const { protocol, origin, pathname } = window.location;
    if (protocol !== "https:" && protocol !== "http:") {
        return STANDARD_BASIS_URL;
    }
    return `${origin}${pathname}`;
}

/** Übungscode in Großbuchstaben oder null, wenn die Übung keinen hat (Altbestand). */
export function uebungCodeVon(uebung: MitZugang): string | null {
    const code = (uebung.uebungCode ?? "").trim().toUpperCase();
    return code === "" ? null : code;
}

/** Teilnehmercode eines Funkrufnamens (teilnehmerIds bildet Code → Name ab). */
export function teilnehmerCodeVon(uebung: MitZugang, teilnehmer: string): string | null {
    const eintrag = Object.entries(uebung.teilnehmerIds ?? {}).find(([, name]) => name === teilnehmer);
    return eintrag ? eintrag[0].toUpperCase() : null;
}

/** Kurzlink in die Teilnehmeransicht – dieselbe Form wie im Generator. */
export function teilnehmerZugangsUrl(basis: string, uebungCode: string, teilnehmerCode: string): string {
    const params = new URLSearchParams({ uc: uebungCode, tc: teilnehmerCode });
    return `${basis}#/teilnehmer?${params.toString()}`;
}

/** Link in die Übungsleitung. */
export function uebungsleitungUrl(basis: string, uebungId: string): string {
    return `${basis}#/uebungsleitung/${uebungId}`;
}

/**
 * Zeichnet einen QR-Code als Quadrat mit Kantenlänge `kante` (mm) an (x, y).
 * Weißer Rand von vier Modulen (Ruhezone nach Norm) ist in `kante` enthalten.
 */
export function zeichneQrCode(pdf: jsPDF, text: string, x: number, y: number, kante: number): void {
    const { matrix, groesse } = qrMatrix(text);
    const rand = 4;
    const modul = kante / (groesse + rand * 2);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(x, y, kante, kante, "F");
    pdf.setFillColor(0, 0, 0);
    matrix.forEach((zeile, i) => {
        // Waagerechte Läufe zusammenfassen: weniger Rechtecke, kleinere Datei.
        let start = -1;
        for (let j = 0; j <= groesse; j++) {
            const dunkel = j < groesse && zeile[j] === true;
            if (dunkel && start < 0) {
                start = j;
            } else if (!dunkel && start >= 0) {
                pdf.rect(x + (rand + start) * modul, y + (rand + i) * modul, (j - start) * modul, modul, "F");
                start = -1;
            }
        }
    });
}
