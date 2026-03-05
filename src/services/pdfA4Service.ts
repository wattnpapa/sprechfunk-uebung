/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import type { Nachricht } from "../types/Nachricht";
import { DeckblattTeilnehmer } from "../pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "../models/FunkUebung.js";
import { Meldevordruck } from "../pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "../pdf/Nachrichtenvordruck.js";

type DrawMessageFn = (teilnehmer: string, pdf: jsPDF, msg: Nachricht, offsetX: number) => void;

function drawA4SplitLine(pdf: jsPDF): void {
    pdf.setDrawColor(150);
    pdf.setLineWidth(0.2);
    (pdf as any).setLineDash([1, 1], 0);
    pdf.line(148, 0, 148, 210);
    (pdf as any).setLineDash([], 0);
}

function drawPairDeckblatt(pdf: jsPDF, funkUebung: FunkUebung, left: string, right?: string): void {
    new DeckblattTeilnehmer(left, funkUebung, pdf).draw(0);
    if (right) {
        new DeckblattTeilnehmer(right, funkUebung, pdf).draw(148);
    }
}

function drawMessageAtIndex(options: {
    teilnehmer: string;
    nachrichten: Nachricht[];
    index: number;
    pdf: jsPDF;
    offsetX: number;
    drawMessage: DrawMessageFn;
}): void {
    const { teilnehmer, nachrichten, index, pdf, offsetX, drawMessage } = options;
    if (index >= nachrichten.length) {
        return;
    }
    const msg = nachrichten[index];
    if (msg) {
        drawMessage(teilnehmer, pdf, msg, offsetX);
    }
}

function drawPairMessages(options: {
    pdf: jsPDF;
    funkUebung: FunkUebung;
    left: string;
    right: string | undefined;
    drawMessage: DrawMessageFn;
}): void {
    const { pdf, funkUebung, left, right, drawMessage } = options;
    const leftMsgs = funkUebung.nachrichten[left] || [];
    const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
    const max = Math.max(leftMsgs.length, rightMsgs.length);
    for (let j = 0; j < max; j++) {
        pdf.addPage();
        drawMessageAtIndex({ teilnehmer: left, nachrichten: leftMsgs, index: j, pdf, offsetX: 0, drawMessage });
        if (right) {
            drawMessageAtIndex({ teilnehmer: right, nachrichten: rightMsgs, index: j, pdf, offsetX: 148, drawMessage });
        }
        drawA4SplitLine(pdf);
    }
}

function generateAllA4PairPrintBlob(
    funkUebung: FunkUebung,
    drawMessage: DrawMessageFn
): Blob {
    const pdf = new jsPDF("l", "mm", "a4");
    const parts = funkUebung.teilnehmerListe;
    for (let i = 0; i < parts.length; i += 2) {
        const left = parts[i];
        const right = parts[i + 1];
        if (!left) {
            continue;
        }
        if (i > 0) {
            pdf.addPage();
        }
        drawA4SplitLine(pdf);
        drawPairDeckblatt(pdf, funkUebung, left, right);
        drawPairMessages({ pdf, funkUebung, left, right, drawMessage });
    }
    return pdf.output("blob");
}

export async function generateAllNachrichtenvordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
    return generateAllA4PairPrintBlob(funkUebung, (teilnehmer, pdf, msg, offsetX) => {
        new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX);
    });
}

export async function generateAllMeldevordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
    return generateAllA4PairPrintBlob(funkUebung, (teilnehmer, pdf, msg, offsetX) => {
        new Meldevordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX);
    });
}

function generateA4BlobsByTeilnehmer(
    funkUebung: FunkUebung,
    drawMessage: DrawMessageFn
): Map<string, Blob> {
    const blobs = new Map<string, Blob>();
    for (const teilnehmer of funkUebung.teilnehmerListe) {
        const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
        const totalA5Pages = 1 + nachrichten.length;
        const half = Math.ceil(totalA5Pages / 2);
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const renderIndex = (pageIndex: number, offsetX: number) => {
            if (pageIndex < 0 || pageIndex >= totalA5Pages) {
                return;
            }
            if (pageIndex === 0) {
                new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw(offsetX || 0);
                return;
            }
            const msg = nachrichten[pageIndex - 1];
            if (msg) {
                drawMessage(teilnehmer, pdf, msg, offsetX || 0);
            }
        };

        for (let s = 0; s < half; s++) {
            if (s > 0) {
                pdf.addPage();
            }
            const leftIndex = s;
            const rightIndex = s + half;
            renderIndex(leftIndex, 0);
            if (rightIndex < totalA5Pages) {
                renderIndex(rightIndex, 148);
            }
            drawA4SplitLine(pdf);
        }

        blobs.set(teilnehmer, pdf.output("blob"));
    }
    return blobs;
}

export async function generateNachrichtenvordruckA4PDFsBlob(funkUebung: FunkUebung): Promise<Map<string, Blob>> {
    return generateA4BlobsByTeilnehmer(funkUebung, (teilnehmer, pdf, msg, offsetX) => {
        new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX);
    });
}

export async function generateMeldevordruckA4PDFsBlob(funkUebung: FunkUebung): Promise<Map<string, Blob>> {
    return generateA4BlobsByTeilnehmer(funkUebung, (teilnehmer, pdf, msg, offsetX) => {
        new Meldevordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX);
    });
}
