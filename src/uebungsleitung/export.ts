import type { FunkUebung } from "../models/FunkUebung";
import type { TeilnehmerStatus, UebungsleitungStorage } from "../types/Storage";
import { uiFeedback } from "../core/UiFeedback";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import type { EffektiverStatus } from "./auswertung";
import type { AnmeldeZustand } from "./lagebild";

/**
 * Debrief-Daten: neben den Bestätigungen der Leitung auch die
 * Selbstmeldungen der Teilnehmer (`gemeldetUm`) und die Anmeldung aus dem
 * Anmelde-Funkspruch – getrennt ausgewiesen (THW-Review workflow F3).
 */
export function buildDebriefStorage(
    storage: UebungsleitungStorage,
    anmeldungen: Record<string, AnmeldeZustand>,
    effektiv: EffektiverStatus
): UebungsleitungStorage {
    const teilnehmer: Record<string, TeilnehmerStatus> = { ...storage.teilnehmer };
    Object.entries(anmeldungen).forEach(([name, zustand]) => {
        if (zustand.angemeldetUm) {
            teilnehmer[name] = { ...(teilnehmer[name] ?? {}), angemeldetUm: zustand.angemeldetUm };
        }
    });
    return { ...storage, teilnehmer, nachrichten: effektiv };
}

export async function downloadTeilnehmerDebrief(uebung: FunkUebung, debriefStorage: UebungsleitungStorage, name: string): Promise<void> {
    try {
        const pdfGenerator = await ladePdfGenerator();
        const blob = await pdfGenerator.generateTeilnehmerDebriefPdfBlob(uebung, debriefStorage, name);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Debrief_${pdfGenerator.sanitizeFileName(name)}_${pdfGenerator.sanitizeFileName(uebung.name)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        uiFeedback.success(`Debriefing PDF für ${name} erstellt.`);
    } catch {
        uiFeedback.error(`Debriefing PDF für ${name} konnte nicht erstellt werden.`);
    }
}

export async function exportUebungsleitungPdf(uebung: FunkUebung, storage: UebungsleitungStorage): Promise<void> {
    // Über den PDF-Dienst statt mit eigenem jsPDF: nur dort ist das
    // autoTable-Plugin angemeldet. Vorher scheiterte der Export als erste
    // Aktion einer frischen Ansicht (THW-Review 2026-10-04, B2).
    let pdfGenerator: Awaited<ReturnType<typeof ladePdfGenerator>>;
    try {
        pdfGenerator = await ladePdfGenerator();
    } catch {
        return; // ladePdfGenerator hat die Meldung schon gezeigt
    }
    try {
        pdfGenerator.downloadUebungsleitungPDF(uebung, storage);
    } catch (err) {
        console.error(err);
        uiFeedback.error("PDF der Übungsleitung konnte nicht erstellt werden. Der leere Plan liegt auch im Druckdaten-ZIP des Generators (Uebungsleitung.pdf).");
    }
}

export async function exportTeilnehmerUebersicht(uebung: FunkUebung): Promise<void> {
    try {
        const pdfGenerator = await ladePdfGenerator();
        await pdfGenerator.generateAllTeilnehmerUebersichtPrint(uebung);
        uiFeedback.success("PDF mit allen Teilnehmer-Übersichten erstellt.");
    } catch (err) {
        console.error(err);
        uiFeedback.error("Fehler beim PDF Export");
    }
}
