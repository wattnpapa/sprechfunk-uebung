/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { BasePDF } from "./BasePDF";
import { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import {
    verteileStraenge,
    type FuehrungsstellenKonfiguration,
    type FuehrungsstellenUebung
} from "../types/FuehrungsstellenUebung";
import { formatNatoDate } from "../utils/date";
import {
    formatFuehrungsstellenOffset,
    formatFuehrungsstellenUhrzeit,
    meldeartLabel,
    uebermittlungsWegLabel
} from "../utils/fuehrungsstelle";

/**
 * Drehbuch einer Führungsstellen-Übung für die Übungsleitung: Deckblatt mit
 * Lage, Auftrag und Rollenbesetzung, Rollenkarten mit dem Hintergrund jeder
 * Einsatzstelle und des Stabs, dann die Zeitachse aller Nachrichten mit Weg,
 * Meldeart und der Reaktion, die von der beübten Stelle erwartet wird.
 * Querformat A4 wie Uebungsleitung.pdf.
 */
export class Drehbuch extends BasePDF {
    private readonly drehbuch: FuehrungsstellenUebung;
    private readonly konfiguration: FuehrungsstellenKonfiguration;
    private readonly pageMarginTop = 25;
    private readonly pageMarginBottom = 25;
    private readonly pageMarginLeft = 10;
    private readonly pageMarginRight = 10;
    private readonly tableFontSize = 8;

    private get contentWidth(): number {
        return this.pdfWidth - this.pageMarginLeft - this.pageMarginRight;
    }

    constructor(funkUebung: FunkUebung, drehbuch: FuehrungsstellenUebung, pdfInstance: jsPDF) {
        super(funkUebung, pdfInstance);
        if (!funkUebung.fuehrungsstelle) {
            throw new Error("Die Übung ist keine Führungsstellen-Übung.");
        }
        this.drehbuch = drehbuch;
        this.konfiguration = funkUebung.fuehrungsstelle;
    }

    draw(): void {
        const generierungszeit = formatNatoDate(this.funkUebung.createDate);
        let y = this.drawDeckblattKopf();
        y = this.drawRollenTabelle(y);
        this.drawAbsatzTabelle("Lage", this.drehbuch.lage, y + 6);
        this.drawAbsatzTabelle("Auftrag der beübten Führungsstelle", this.drehbuch.auftrag, this.naechsteY());
        this.pdf.addPage();
        this.drawRollenkarten();
        this.pdf.addPage();
        this.drawZeitachse();
        this.drawHeaderAndFooter(generierungszeit);
    }

    private naechsteY(): number {
        return ((this.pdf as any).lastAutoTable?.finalY ?? this.pageMarginTop) + 6;
    }

    private drawDeckblattKopf(): number {
        let y = this.pageMarginTop;
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text(`Drehbuch: ${this.funkUebung.name}`, this.pdfWidth / 2, y, { align: "center" });
        y += 8;
        this.pdf.setFontSize(12);
        this.pdf.text(`Führungsstellen-Übung „${this.drehbuch.titel}“`, this.pdfWidth / 2, y, { align: "center" });
        y += 7;
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(10);
        const beginn = this.konfiguration.beginn ? `${this.konfiguration.beginn} Uhr` : "________ Uhr";
        const kopf = `Datum: ${formatNatoDate(this.funkUebung.datum, false)}   ·   Übungsbeginn: ${beginn}   ·   `
            + `Dauer: ${this.drehbuch.dauerMinuten} Minuten   ·   Rufgruppe: ${this.funkUebung.rufgruppe}`;
        this.pdf.text(kopf, this.pdfWidth / 2, y, { align: "center" });
        return y + 6;
    }

    /** Wer spielt wen: beübte Stelle, Abschnitte mit ihren Einsatzstellen, Stab. */
    private drawRollenTabelle(startY: number): number {
        const zuordnung = verteileStraenge(this.drehbuch.straenge.length, this.konfiguration.unterstellt.length);
        const rows: string[][] = [
            ["Beübte Führungsstelle", this.rufnameMitStelle(this.konfiguration.beuebteStelle), "wird beübt, kennt das Drehbuch nicht", ""]
        ];
        this.konfiguration.unterstellt.forEach((name, abschnittIndex) => {
            const einsatzstellen = this.drehbuch.straenge
                .filter((_, strangIndex) => zuordnung[strangIndex] === abschnittIndex)
                .map(strang => strang.bezeichnung)
                .join("\n");
            rows.push([`Einsatzabschnitt ${abschnittIndex + 1}`, this.rufnameMitStelle(name), einsatzstellen, ""]);
        });
        rows.push(["Übergeordnete Stelle", this.rufnameMitStelle(this.konfiguration.uebergeordnet), this.drehbuch.uebergeordnet.bezeichnung, ""]);

        (this.pdf as any).autoTable({
            head: [["Rolle", "Funkrufname / Stellenname", "Einsatzstellen / Bezeichnung", "Gespielt von"]],
            body: rows,
            startY,
            theme: "grid",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: this.pageMarginBottom },
            tableWidth: this.contentWidth,
            columnStyles: {
                0: { cellWidth: this.contentWidth * 0.2 },
                1: { cellWidth: this.contentWidth * 0.22 },
                2: { cellWidth: this.contentWidth * 0.38 },
                3: { cellWidth: this.contentWidth * 0.2 }
            },
            styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
            headStyles: { fillColor: [200, 200, 200] }
        });
        return this.naechsteY();
    }

    /** Funkrufname, darunter der eingetragene Stellenname. */
    private rufnameMitStelle(funkrufname: string): string {
        const stelle = this.konfiguration.stellen?.[funkrufname];
        return stelle ? `${funkrufname}\n${stelle}` : funkrufname;
    }

    /** Fließtext als einspaltige Tabelle, damit autoTable den Seitenumbruch übernimmt. */
    private drawAbsatzTabelle(titel: string, text: string, startY: number): void {
        (this.pdf as any).autoTable({
            head: [[titel]],
            body: [[text]],
            startY,
            theme: "plain",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: this.pageMarginBottom },
            tableWidth: this.contentWidth,
            styles: { fontSize: 9, cellPadding: 1.5, overflow: "linebreak" },
            headStyles: { fontStyle: "bold", fontSize: 11 }
        });
    }

    /** Hintergrund je Rolle: Was die Einspielung weiß, um Rückfragen zu beantworten. */
    private drawRollenkarten(): void {
        const zuordnung = verteileStraenge(this.drehbuch.straenge.length, this.konfiguration.unterstellt.length);
        const rows: string[][] = [[
            `${this.drehbuch.uebergeordnet.bezeichnung}\n${this.konfiguration.uebergeordnet}`,
            this.drehbuch.uebergeordnet.hintergrund
        ]];
        this.drehbuch.straenge.forEach((strang, strangIndex) => {
            const abschnitt = this.konfiguration.unterstellt[zuordnung[strangIndex] ?? 0] ?? "";
            rows.push([`${strang.bezeichnung}\n${abschnitt}`, strang.hintergrund]);
        });
        (this.pdf as any).autoTable({
            head: [["Rolle", "Hintergrund für die Einspielung"]],
            body: rows,
            startY: this.pageMarginTop + 5,
            theme: "grid",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: this.pageMarginBottom },
            tableWidth: this.contentWidth,
            columnStyles: { 0: { cellWidth: this.contentWidth * 0.25 }, 1: { cellWidth: this.contentWidth * 0.75 } },
            styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private drawZeitachse(): void {
        const w = this.contentWidth;
        const spalten = [10, 24, 34, 16, 20, 0, 0, 14];
        const fest = spalten.reduce((summe, breite) => summe + breite, 0);
        spalten[5] = (w - fest) * 0.6;
        spalten[6] = (w - fest) * 0.4;

        (this.pdf as any).autoTable({
            head: [["Nr", "Zeit", "Von", "Weg", "Art", "Nachricht", "Erwartete Reaktion der Führungsstelle", "Erledigt"]],
            body: this.zeitachsenZeilen(),
            startY: this.pageMarginTop + 5,
            theme: "grid",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: this.pageMarginBottom },
            tableWidth: w,
            columnStyles: Object.fromEntries(spalten.map((breite, index) => [index, { cellWidth: breite }])),
            styles: {
                fontSize: this.tableFontSize,
                cellPadding: 1.5,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                overflow: "linebreak",
                valign: "top"
            },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private zeitachsenZeilen(): (string | number)[][] {
        const alle: { sender: string; nachricht: Nachricht }[] = [];
        this.funkUebung.teilnehmerListe.forEach(sender => {
            (this.funkUebung.nachrichten[sender] ?? []).forEach(nachricht => alle.push({ sender, nachricht }));
        });
        alle.sort((a, b) =>
            (a.nachricht.szenarioNr ?? a.nachricht.id) - (b.nachricht.szenarioNr ?? b.nachricht.id)
            || a.sender.localeCompare(b.sender)
        );
        return alle.map(({ sender, nachricht }, index) => {
            const minute = nachricht.xZeitSlot ?? 0;
            const uhrzeit = formatFuehrungsstellenUhrzeit(minute, this.konfiguration.beginn);
            const zeit = uhrzeit
                ? `${formatFuehrungsstellenOffset(minute)}\n${uhrzeit}`
                : formatFuehrungsstellenOffset(minute);
            const text = nachricht.betreff
                ? `Betreff: ${nachricht.betreff}\n${nachricht.nachricht}`
                : nachricht.nachricht;
            return [
                nachricht.szenarioNr ?? index + 1,
                zeit,
                sender,
                uebermittlungsWegLabel(nachricht.weg),
                meldeartLabel(nachricht.meldeart),
                text,
                nachricht.erwartung ?? "",
                ""
            ];
        });
    }

    private drawHeaderAndFooter(generierungszeit: string): void {
        const totalPages = (this.pdf as any).getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            this.pdf.setPage(pageNumber);
            if (pageNumber > 1) {
                this.drawPageHeader();
            }
            this.drawPageFooter(pageNumber, totalPages, generierungszeit);
        }
    }

    private drawPageHeader(): void {
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(10);
        const links = `Drehbuch · beübte Stelle: ${this.konfiguration.beuebteStelle} · Rufgruppe: ${this.funkUebung.rufgruppe}`;
        this.pdf.text(links, this.pageMarginLeft, 20);
        const rechts = `${this.funkUebung.name} - ${formatNatoDate(this.funkUebung.datum, false)}`;
        const breite = this.pdf.getTextWidth(rechts);
        this.pdf.text(rechts, this.pdfWidth - this.pageMarginLeft - breite, 20);
        this.pdf.setDrawColor(0);
        this.pdf.line(this.pageMarginLeft, 22, this.pdfWidth - this.pageMarginRight, 22);
    }

    private drawPageFooter(pageNumber: number, totalPages: number, generierungszeit: string): void {
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(8);
        this.pdf.setDrawColor(0);
        this.pdf.line(this.pageMarginLeft, this.pdfHeight - 15, this.pdfWidth - this.pageMarginRight, this.pdfHeight - 15);
        this.pdf.setFontSize(10);
        const seite = `Seite ${pageNumber} von ${totalPages}`;
        this.pdf.text(seite, this.pdfWidth - this.pageMarginLeft - this.pdf.getTextWidth(seite), this.pdfHeight - 10);
        this.pdf.setFontSize(6);
        const leftText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
        this.pdf.textWithLink(leftText, this.pageMarginLeft, this.pdfHeight - 10, { url: "https://sprechfunk-uebung.de//" });
    }
}

