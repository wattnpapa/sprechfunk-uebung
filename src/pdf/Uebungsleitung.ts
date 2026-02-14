import { jsPDF } from "jspdf";
import { FunkUebung } from "../models/FunkUebung";
import { BasePDF } from "./BasePDF";
import { UebungsleitungStorage } from "../types/Storage";
import { formatNatoDate } from "../utils/date";

export class Uebungsleitung extends BasePDF {
    private storage: UebungsleitungStorage | null;

    constructor(funkUebung: FunkUebung, pdf: jsPDF, storage: UebungsleitungStorage | null = null) {
        super(funkUebung, pdf);
        this.storage = storage;
    }

    draw() {
        const margin = 15;
        const width = 297 - 2 * margin;
        let currentY = 20;

        // Header
        this.addText(`Übungsleitung: ${this.funkUebung.name}`, margin, currentY, 18, "bold");
        this.addText(`Datum: ${formatNatoDate(this.funkUebung.datum)}`, margin + width - 50, currentY, 10, "normal", "right");
        
        currentY += 15;

        // Teilnehmer Status
        this.addText("Teilnehmer Status", margin, currentY, 14, "bold");
        currentY += 10;

        const headers = ["Teilnehmer", "Angemeldet", "Lösungswort", "Stärke", "Notizen"];
        const data = this.funkUebung.teilnehmerListe.map(t => {
            const status = this.storage?.teilnehmer[t];
            return [
                t,
                status?.angemeldetUm ? formatNatoDate(status.angemeldetUm) : "-",
                status?.loesungswortGesendet || "-",
                (status?.teilstaerken || []).join("/") || "-",
                status?.notizen || "-"
            ];
        });

        this.addTable(headers, data, currentY, margin, [50, 40, 40, 40, 80]);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentY = (this.pdf as any).lastAutoTable.finalY + 20;

        // Nachrichten Status
        this.pdf.addPage();
        currentY = 20;
        this.addText("Nachrichten Status", margin, currentY, 14, "bold");
        currentY += 10;

        const msgHeaders = ["Nr", "Sender", "Empfänger", "Nachricht", "Abgesetzt"];
        const msgData: string[][] = [];

        Object.entries(this.funkUebung.nachrichten).forEach(([sender, msgs]) => {
            msgs.forEach(msg => {
                const key = `${sender}__${msg.id}`;
                const status = this.storage?.nachrichten[key];
                msgData.push([
                    msg.id.toString(),
                    sender,
                    msg.empfaenger.join(", "),
                    msg.nachricht,
                    status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : "-"
                ]);
            });
        });

        // Sort by Nr
        msgData.sort((a, b) => parseInt(a[0] ?? "0", 10) - parseInt(b[0] ?? "0", 10));

        this.addTable(msgHeaders, msgData, currentY, margin, [15, 40, 50, 120, 40]);
    }

    // Blob helper
    blob(): Blob {
        return this.pdf.output("blob");
    }
}
