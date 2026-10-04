/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { BasePDF } from "./BasePDF";
import { FunkUebung } from "../models/FunkUebung";
import type { FuehrungsstellenKonfiguration, FuehrungsstellenUebung } from "../types/FuehrungsstellenUebung";
import { formatNatoDate } from "../utils/date";

/**
 * Blatt „Ausgangslage und Auftrag“ für die beübte Führungsstelle einer
 * Führungsstellen-Übung (THW-Review 2026-10-04, workflow F8).
 *
 * Lage und Auftrag standen bisher nur im Drehbuch, gemischt mit Rollen und
 * den erwarteten Reaktionen, das die beübte Stelle nicht kennen darf. Dieses
 * Blatt enthält deshalb nur, was sie zu Übungsbeginn wissen muss: Lage,
 * Auftrag und wen sie über Funk erreicht – keine Erwartungen, keine
 * Einspielungen. Hochformat A4, zum Aushändigen.
 */
export class Ausgangslage extends BasePDF {
    private readonly drehbuch: FuehrungsstellenUebung;
    private readonly konfiguration: FuehrungsstellenKonfiguration;
    private readonly rand = 15;

    constructor(funkUebung: FunkUebung, drehbuch: FuehrungsstellenUebung, pdfInstance: jsPDF) {
        super(funkUebung, pdfInstance);
        if (!funkUebung.fuehrungsstelle) {
            throw new Error("Die Übung ist keine Führungsstellen-Übung.");
        }
        this.drehbuch = drehbuch;
        this.konfiguration = funkUebung.fuehrungsstelle;
    }

    private get breite(): number {
        return this.pdfWidth - 2 * this.rand;
    }

    draw(): void {
        let y = 25;
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text("Ausgangslage und Auftrag", this.pdfWidth / 2, y, { align: "center" });
        y += 7;
        this.pdf.setFontSize(12);
        this.pdf.text(`${this.funkUebung.name} – „${this.drehbuch.titel}“`, this.pdfWidth / 2, y, { align: "center" });
        y += 6;
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(10);
        const beginn = this.konfiguration.beginn ? `${this.konfiguration.beginn} Uhr` : "________ Uhr";
        this.pdf.text(
            `Datum: ${formatNatoDate(this.funkUebung.datum, false)}   ·   Übungsbeginn: ${beginn}   ·   Rufgruppe: ${this.funkUebung.rufgruppe}`,
            this.pdfWidth / 2, y, { align: "center" }
        );

        this.drawTabelle([["Funkverbindungen der beübten Stelle", ""]], this.funkverbindungen(), y + 6, true);
        this.drawTabelle([["Lage"]], [[this.drehbuch.lage]], this.naechsteY());
        this.drawTabelle([["Auftrag"]], [[this.drehbuch.auftrag]], this.naechsteY());
        this.drawFusszeile();
    }

    /** Eigener Rufname und die Stellen, mit denen die beübte Stelle funkt. */
    private funkverbindungen(): string[][] {
        const mitStelle = (rufname: string) => {
            const stelle = this.konfiguration.stellen?.[rufname];
            return stelle ? `${rufname} (${stelle})` : rufname;
        };
        return [
            ["Eigener Funkrufname", mitStelle(this.konfiguration.beuebteStelle)],
            ["Übergeordnete Stelle", mitStelle(this.konfiguration.uebergeordnet)],
            ...this.konfiguration.unterstellt.map((rufname, index) => [`Einsatzabschnitt ${index + 1}`, mitStelle(rufname)])
        ];
    }

    private drawTabelle(head: string[][], body: string[][], startY: number, zweispaltig = false): void {
        (this.pdf as any).autoTable({
            head,
            body,
            startY,
            theme: zweispaltig ? "grid" : "plain",
            margin: { left: this.rand, right: this.rand, top: 20, bottom: 25 },
            tableWidth: this.breite,
            ...(zweispaltig ? { columnStyles: { 0: { cellWidth: this.breite * 0.35 } } } : {}),
            styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
            headStyles: zweispaltig
                ? { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: "bold" }
                : { fontStyle: "bold", fontSize: 12 }
        });
    }

    private naechsteY(): number {
        return ((this.pdf as any).lastAutoTable?.finalY ?? 40) + 6;
    }

    private drawFusszeile(): void {
        const seiten = (this.pdf as any).getNumberOfPages();
        for (let seite = 1; seite <= seiten; seite++) {
            this.pdf.setPage(seite);
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setDrawColor(0);
            this.pdf.line(this.rand, this.pdfHeight - 15, this.pdfWidth - this.rand, this.pdfHeight - 15);
            this.pdf.setFontSize(10);
            const text = `Seite ${seite} von ${seiten}`;
            this.pdf.text(text, this.pdfWidth - this.rand - this.pdf.getTextWidth(text), this.pdfHeight - 10);
            this.pdf.setFontSize(6);
            this.pdf.text(
                `Für die beübte Stelle · Übung ID: ${this.funkUebung.id} · Generator: https://sprechfunk-uebung.de/`,
                this.rand, this.pdfHeight - 10
            );
        }
    }
}
