import type { GeneratorController } from "./index";
import type { FunkspruchQuelle } from "./GeneratorView";
import { ladePdfGenerator, type PdfGeneratorService } from "../services/pdfGeneratorLazy";
import { uiFeedback } from "../core/UiFeedback";
import { ladeDrehbuchDerUebung, stelleTeilnehmerWiederHer } from "./controllerFuehrungsstelle";
import { updateSzenarioInfo } from "./controllerQuellen";
import { pruefeZugangsCodes } from "./GeneratorValidierung";

/** Verdrahtet die Ereignisse der GeneratorView mit dem Controller. */

/** Der Druckteil ließ sich nicht laden; ladePdfGenerator hat das schon gemeldet. */
class DruckteilNichtGeladen extends Error {}

async function ladeDruckteil(): Promise<PdfGeneratorService> {
    try {
        return await ladePdfGenerator();
    } catch (error) {
        throw new DruckteilNichtGeladen(String(error));
    }
}

/**
 * Druckdaten ohne Netz: Bisher passierte beim Klick gar nichts
 * (THW-Review offline-resilience P0-2). Jetzt kommt eine Meldung – genau
 * eine je Ursache: Scheitert schon das Laden des Druckteils, steht dessen
 * Meldung bereits da (THW-Review 2026-10-05, offline-resilience P3-2).
 */
async function mitDruckFehlermeldung(aktion: () => Promise<void>): Promise<void> {
    try {
        await aktion();
    } catch (error) {
        console.error("Druckdaten konnten nicht erstellt werden:", error);
        if (error instanceof DruckteilNichtGeladen) {
            return;
        }
        uiFeedback.error("Die Druckdaten konnten nicht erstellt werden. Prüfe die Internetverbindung und versuche es erneut.");
    }
}

function quelleGewechselt(ctrl: GeneratorController, source: FunkspruchQuelle): void {
    if (source === "szenario" || source === "fuehrungsstelle") {
        // Lösungswörter sind mit Drehbuch deaktiviert — Auswahl,
        // Shuffle-Button und die Spalte in der Teilnehmertabelle sollen
        // das auch zeigen, nicht nur der Hinweistext.
        ctrl.view.selectLoesungswortOption("none");
        ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);
        ctrl.loesungswortOption = "none";
    }
    if (source !== "fuehrungsstelle") {
        stelleTeilnehmerWiederHer(ctrl);
    }
    // Immer neu zeichnen, damit Tabelle und Teilnehmerliste der Übung
    // nach einem Quellenwechsel nicht auseinanderlaufen.
    ctrl.renderTeilnehmer(false);
    if (source === "szenario") {
        void updateSzenarioInfo(ctrl);
    }
    if (source === "fuehrungsstelle") {
        void ctrl.updateFuehrungsstelleInfo();
    }
}

function bindPrimaryActions(ctrl: GeneratorController): void {
    ctrl.view.bindPrimaryActions({
        onAddTeilnehmer: () => ctrl.addTeilnehmer(),
        onStartUebung: () => ctrl.startUebung("neu"),
        onChangePage: (step: number) => ctrl.changePage(step),
        onCopyJson: () => ctrl.copyJSONToClipboard(),
        onZipAllPdfs: () => mitDruckFehlermeldung(async () => {
            const pdfGenerator = await ladeDruckteil();
            await pdfGenerator.generateAllPDFsAsZip(ctrl.funkUebung);
        }),
        onDownloadUebersichtPdf: () => mitDruckFehlermeldung(async () => {
            const pdfGenerator = await ladeDruckteil();
            await pdfGenerator.generateAllTeilnehmerUebersichtPrint(ctrl.funkUebung);
        }),
        onDrehbuchPdf: () => mitDruckFehlermeldung(async () => {
            const drehbuch = await ladeDrehbuchDerUebung(ctrl);
            if (!drehbuch) {
                return;
            }
            const pdfGenerator = await ladeDruckteil();
            await pdfGenerator.generateDrehbuchPDF(ctrl.funkUebung, drehbuch);
        })
    });
}

function bindFuehrungsstellenEvents(ctrl: GeneratorController): void {
    ctrl.view.bindFuehrungsstelleChange(() => {
        void ctrl.updateFuehrungsstelleInfo();
    });
    ctrl.view.bindFuehrungsstellenAbschnittEvents(
        () => ctrl.aendereAbschnitte(zeilen => [...zeilen, ctrl.naechsterAbschnitt(zeilen)]),
        index => ctrl.aendereAbschnitte(zeilen => zeilen.filter((_, i) => i !== index))
    );
}

function bindTeilnehmerEvents(ctrl: GeneratorController): void {
    ctrl.view.bindTeilnehmerEvents(
        (index, newVal) => ctrl.updateTeilnehmerName(index, newVal),
        (index, newVal) => ctrl.updateTeilnehmerStelle(index, newVal),
        index => ctrl.removeTeilnehmer(index),
        checked => {
            ctrl.showStellenname = checked;
            ctrl.renderTeilnehmer(false);
        }
    );
}

function bindQuickJoin(ctrl: GeneratorController): void {
    ctrl.view.bindQuickJoin((uebungCode, teilnehmerCode) => {
        ctrl.hinweise.entferneFeldFehler();
        const fehler = pruefeZugangsCodes(uebungCode, teilnehmerCode);
        if (fehler.length > 0) {
            ctrl.hinweise.zeigeFeldFehler(fehler);
            return;
        }
        window.location.hash = `#/teilnehmer?${new URLSearchParams({
            uc: uebungCode,
            tc: teilnehmerCode
        }).toString()}`;
    });
}

export function bindEvents(ctrl: GeneratorController): void {
    ctrl.view.bindDistributionInputs(data => {
        Object.assign(ctrl.funkUebung, data);
    });
    ctrl.view.bindSourceToggle(source => quelleGewechselt(ctrl, source));
    ctrl.view.bindSzenarioChange(() => {
        void updateSzenarioInfo(ctrl);
    });
    bindFuehrungsstellenEvents(ctrl);
    ctrl.view.bindLoesungswortOptionChange(() => ctrl.wechsleLoesungswortOption());
    bindTeilnehmerEvents(ctrl);
    ctrl.view.bindAnmeldungToggle(checked => {
        ctrl.funkUebung.anmeldungAktiv = checked;
    });
    ctrl.view.bindNachrichtenArtToggle(aktiv => {
        ctrl.funkUebung.nachrichtenArtAktiv = aktiv;
    });
    ctrl.view.bindSpielModusToggle();
    bindPrimaryActions(ctrl);
    bindQuickJoin(ctrl);
    ctrl.hinweise.bindAktionen({
        onUeberschreiben: () => void ctrl.startUebung("ueberschreiben"),
        onBlattBeuebteStelle: () => void ctrl.druckeBlattBeuebteStelle()
    });
    ctrl.hinweise.bindFormularAenderung(() => ctrl.formularGeaendert());
}
