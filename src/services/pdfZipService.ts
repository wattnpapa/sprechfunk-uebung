import JSZip from "jszip";
import { FunkUebung } from "../models/FunkUebung";
import { formatNatoDate } from "../utils/date";

type PdfZipDeps = {
    sanitizeFileName: (name: string) => string;
    generateTeilnehmerPDFsBlob: (funkUebung: FunkUebung) => Promise<Map<string, Blob>>;
    generateInstructorPDFBlob: (funkUebung: FunkUebung) => Blob;
    generateNachrichtenvordruckPDFsBlob: (funkUebung: FunkUebung, hideBackground?: boolean, hideFooter?: boolean) => Promise<Map<string, Blob>>;
    generateNachrichtenvordruckA4PDFsBlob: (funkUebung: FunkUebung) => Promise<Map<string, Blob>>;
    generateMeldevordruckPDFsBlob: (funkUebung: FunkUebung, hideBackground?: boolean, hideFooter?: boolean) => Promise<Map<string, Blob>>;
    generateMeldevordruckA4PDFsBlob: (funkUebung: FunkUebung) => Promise<Map<string, Blob>>;
    generateAllNachrichtenvordruckPrintBlob: (funkUebung: FunkUebung) => Promise<Blob>;
    generateAllMeldevordruckPrintBlob: (funkUebung: FunkUebung) => Promise<Blob>;
    generateAllNachrichtenvordruckPrintA4Blob: (funkUebung: FunkUebung) => Promise<Blob>;
    generateAllMeldevordruckPrintA4Blob: (funkUebung: FunkUebung) => Promise<Blob>;
    generatePlainNachrichtenvordruckPrintBlob: (funkUebung: FunkUebung) => Promise<Blob>;
    generatePlainMeldevordruckPrintBlob: (funkUebung: FunkUebung) => Promise<Blob>;
    generateNachrichtenvordruckPDFForTeilnehmer: (funkUebung: FunkUebung, teilnehmer: string, hideBackground?: boolean, hideFooter?: boolean) => Promise<{ blob: Blob; totalPages: number }>;
    generateMeldevordruckPDFForTeilnehmer: (funkUebung: FunkUebung, teilnehmer: string, hideBackground?: boolean, hideFooter?: boolean) => Promise<{ blob: Blob; totalPages: number }>;
};

export async function generateAllPDFsAsZipBlob(
    funkUebung: FunkUebung,
    deps: PdfZipDeps
): Promise<Blob> {
    const zip = new JSZip();

    const teilnehmerBlobs = await deps.generateTeilnehmerPDFsBlob(funkUebung);
    teilnehmerBlobs.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Übersicht_${deps.sanitizeFileName(teilnehmer)}.pdf`, blob);
    });

    zip.file("Uebungsleitung.pdf", deps.generateInstructorPDFBlob(funkUebung));

    const nachrichtenvordruckBlobs = await deps.generateNachrichtenvordruckPDFsBlob(funkUebung);
    nachrichtenvordruckBlobs.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${deps.sanitizeFileName(teilnehmer)}_A5.pdf`, blob);
    });

    const nachrichtenvordruckBlobsNadel = await deps.generateNachrichtenvordruckPDFsBlob(funkUebung, true, true);
    nachrichtenvordruckBlobsNadel.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${deps.sanitizeFileName(teilnehmer)}_Nadeldrucker_A5.pdf`, blob);
    });

    const nachrichtenvordruckA4Blobs = await deps.generateNachrichtenvordruckA4PDFsBlob(funkUebung);
    nachrichtenvordruckA4Blobs.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${deps.sanitizeFileName(teilnehmer)}_A4.pdf`, blob);
    });

    const meldevordruckBlobs = await deps.generateMeldevordruckPDFsBlob(funkUebung);
    meldevordruckBlobs.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Meldevordruck_${deps.sanitizeFileName(teilnehmer)}_A5.pdf`, blob);
    });

    const meldevordruckBlobsNadel = await deps.generateMeldevordruckPDFsBlob(funkUebung, true, true);
    meldevordruckBlobsNadel.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Meldevordruck_${deps.sanitizeFileName(teilnehmer)}_Nadeldrucker_A5.pdf`, blob);
    });

    const meldevordruckA4Blobs = await deps.generateMeldevordruckA4PDFsBlob(funkUebung);
    meldevordruckA4Blobs.forEach((blob, teilnehmer) => {
        zip.file(`Teilnehmer/${deps.sanitizeFileName(teilnehmer)}/Meldevordruck_${deps.sanitizeFileName(teilnehmer)}_A4.pdf`, blob);
    });

    zip.file("Gesamt/Druck_Nachrichtenvordruck_A5.pdf", await deps.generateAllNachrichtenvordruckPrintBlob(funkUebung));
    zip.file("Gesamt/Druck_Meldevordruck_A5.pdf", await deps.generateAllMeldevordruckPrintBlob(funkUebung));
    zip.file("Gesamt/Druck_Nachrichtenvordruck_A4.pdf", await deps.generateAllNachrichtenvordruckPrintA4Blob(funkUebung));
    zip.file("Gesamt/Druck_Meldevordruck_A4.pdf", await deps.generateAllMeldevordruckPrintA4Blob(funkUebung));
    zip.file("Gesamt/Nadeldrucker_Nachrichtenvordruck_A5.pdf", await deps.generatePlainNachrichtenvordruckPrintBlob(funkUebung));
    zip.file("Gesamt/Nadeldrucker_Meldevordruck_A5.pdf", await deps.generatePlainMeldevordruckPrintBlob(funkUebung));

    return zip.generateAsync({ type: "blob" });
}

export async function generateTeilnehmerPDFsAsZipBlob(
    funkUebung: FunkUebung,
    teilnehmer: string,
    deps: PdfZipDeps
): Promise<Blob> {
    const zip = new JSZip();
    const safeTeilnehmer = deps.sanitizeFileName(teilnehmer);
    const basePath = `Teilnehmer/${safeTeilnehmer}`;

    const teilnehmerBlobs = await deps.generateTeilnehmerPDFsBlob(funkUebung);
    const uebersichtBlob = teilnehmerBlobs.get(teilnehmer);
    if (uebersichtBlob) {
        zip.file(`${basePath}/Übersicht_${safeTeilnehmer}.pdf`, uebersichtBlob);
    }

    const nachrichtA5 = await deps.generateNachrichtenvordruckPDFForTeilnehmer(funkUebung, teilnehmer);
    zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_A5.pdf`, nachrichtA5.blob);

    const nachrichtNadelA5 = await deps.generateNachrichtenvordruckPDFForTeilnehmer(funkUebung, teilnehmer, true, true);
    zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_Nadeldrucker_A5.pdf`, nachrichtNadelA5.blob);

    const nachrichtA4Blobs = await deps.generateNachrichtenvordruckA4PDFsBlob(funkUebung);
    const nachrichtA4 = nachrichtA4Blobs.get(teilnehmer);
    if (nachrichtA4) {
        zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_A4.pdf`, nachrichtA4);
    }

    const meldeA5 = await deps.generateMeldevordruckPDFForTeilnehmer(funkUebung, teilnehmer);
    zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_A5.pdf`, meldeA5.blob);

    const meldeNadelA5 = await deps.generateMeldevordruckPDFForTeilnehmer(funkUebung, teilnehmer, true, true);
    zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_Nadeldrucker_A5.pdf`, meldeNadelA5.blob);

    const meldeA4Blobs = await deps.generateMeldevordruckA4PDFsBlob(funkUebung);
    const meldeA4 = meldeA4Blobs.get(teilnehmer);
    if (meldeA4) {
        zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_A4.pdf`, meldeA4);
    }

    return zip.generateAsync({ type: "blob" });
}

export function createZipDownloadName(funkUebung: FunkUebung, sanitizeFileName: (name: string) => string): string {
    return `${sanitizeFileName(funkUebung.name)}_${formatNatoDate(new Date())}.zip`;
}
