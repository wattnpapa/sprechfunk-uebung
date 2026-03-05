/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { FunkUebung } from "../models/FunkUebung";
import { formatNatoDate } from "../utils/date";
import { UebungsleitungStorage } from "../types/Storage";

function drawDebriefHeader(pdf: jsPDF, funkUebung: FunkUebung, teilnehmer: string): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 16;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`Debriefing: ${teilnehmer}`, pageWidth / 2, y, { align: "center" });
    y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`${funkUebung.name} | ${formatNatoDate(funkUebung.datum, false)} | ID: ${funkUebung.id}`, pageWidth / 2, y, { align: "center" });
    return y + 6;
}

function fallbackValue(value: string | undefined): string {
    return value && value.length > 0 ? value : "–";
}

function joinOrDash(values: unknown[] | undefined): string {
    if (!values || values.length === 0) {
        return "–";
    }
    const joined = values.join("/");
    return joined.length > 0 ? joined : "–";
}

function formatDateOrDash(value: string | undefined): string {
    return value ? formatNatoDate(value) : "–";
}

function buildDebriefSummaryRow(
    funkUebung: FunkUebung,
    teilnehmer: string,
    participantStatus: UebungsleitungStorage["teilnehmer"][string]
): [string, string, string, string] {
    const sollWort = fallbackValue(funkUebung.loesungswoerter?.[teilnehmer]);
    const istWort = fallbackValue(participantStatus?.loesungswortGesendet);
    const sollStaerke = fallbackValue(funkUebung.loesungsStaerken?.[teilnehmer]);
    const istStaerke = joinOrDash(participantStatus?.teilstaerken);
    const anmeldung = formatDateOrDash(participantStatus?.angemeldetUm);
    return [
        anmeldung,
        `${sollWort} / ${istWort}`,
        `${sollStaerke} / ${istStaerke}`,
        participantStatus?.notizen ?? ""
    ];
}

function buildDebriefSentRows(
    funkUebung: FunkUebung,
    storage: UebungsleitungStorage,
    teilnehmer: string
): string[][] {
    const rows = (funkUebung.nachrichten[teilnehmer] ?? []).map(msg => {
        const key = `${teilnehmer}__${msg.id}`;
        const status = storage.nachrichten[key];
        return [
            String(msg.id),
            msg.empfaenger.join(", "),
            msg.nachricht,
            status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : "offen",
            status?.notiz ?? ""
        ];
    });
    return rows.length ? rows : [["–", "–", "Keine gesendeten Nachrichten", "–", "–"]];
}

function buildDebriefReceivedRows(funkUebung: FunkUebung, teilnehmer: string): [string, string, string][] {
    const rows: [string, string, string][] = [];
    Object.entries(funkUebung.nachrichten).forEach(([sender, list]) => {
        if (sender === teilnehmer) {
            return;
        }
        list.forEach(msg => {
            if (msg.empfaenger.includes("Alle") || msg.empfaenger.includes(teilnehmer)) {
                rows.push([String(msg.id), sender, msg.nachricht]);
            }
        });
    });
    return rows.length ? rows : [["–", "–", "Keine empfangenen Nachrichten"]];
}

export async function generateTeilnehmerDebriefPdfBlob(
    funkUebung: FunkUebung,
    storage: UebungsleitungStorage,
    teilnehmer: string
): Promise<Blob> {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const marginX = 10;
    const y = drawDebriefHeader(pdf, funkUebung, teilnehmer);
    const participantStatus = storage.teilnehmer[teilnehmer] ?? {};

    (pdf as any).autoTable({
        startY: y,
        head: [["Anmeldung", "Lösungswort (Soll/Ist)", "Stärke (Soll/Ist)", "Notiz"]],
        body: [buildDebriefSummaryRow(funkUebung, teilnehmer, participantStatus)],
        margin: { left: marginX, right: marginX },
        tableWidth: "auto",
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0] },
        headStyles: { fillColor: [200, 200, 200] }
    });

    (pdf as any).autoTable({
        startY: (pdf as any).lastAutoTable.finalY + 6,
        head: [["Nr", "Empfänger", "Nachricht", "Abgesetzt", "Notiz Übungsleitung"]],
        body: buildDebriefSentRows(funkUebung, storage, teilnehmer),
        margin: { left: marginX, right: marginX },
        tableWidth: "auto",
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
        headStyles: { fillColor: [200, 200, 200] }
    });

    (pdf as any).autoTable({
        startY: (pdf as any).lastAutoTable.finalY + 6,
        head: [["Nr", "Von", "Empfangene Nachricht"]],
        body: buildDebriefReceivedRows(funkUebung, teilnehmer),
        margin: { left: marginX, right: marginX, bottom: 16 },
        tableWidth: "auto",
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
        headStyles: { fillColor: [200, 200, 200] }
    });

    return pdf.output("blob");
}
