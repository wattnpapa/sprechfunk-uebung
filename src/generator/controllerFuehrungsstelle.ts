import type { GeneratorController } from "./index";
import type { AbschnittZeile, FuehrungsstellenRollenFormular } from "./GeneratorView";
import { pruefeFuehrungsstellenRollen } from "./GeneratorValidierung";
import { baueBlattBeuebteStelle, druckeBlatt } from "./beuebteStelleBlatt";
import { meldeFehler } from "./controllerStatus";
import { uiFeedback } from "../core/UiFeedback";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";
import { ladeFuehrungsstellenUebung } from "../services/FuehrungsstellenUebungService";
import {
    fuehrungsstellenMaxAbschnitte,
    fuehrungsstellenNachrichtenAnzahl,
    type FuehrungsstellenUebung
} from "../types/FuehrungsstellenUebung";

/**
 * Führungsstellen-Übung im Generator: Drehbuch laden, Rollen prüfen,
 * Abschnittsliste pflegen, Blatt für die beübte Stelle drucken.
 */

/**
 * Vorbelegung der Rollen: drei leere Einsatzabschnitte. Beispiel-
 * Funkrufnamen stehen nur als Platzhalter im Formular – als echte Werte
 * landeten sie sonst unbemerkt auf den Vordrucken (THW-Review workflow F7).
 */
export const FUEHRUNGSSTELLE_VORBELEGUNG: FuehrungsstellenRollenFormular = {
    beuebteStelle: "",
    uebergeordnet: "",
    unterstellt: ["", "", ""],
    stellen: {}
};

const ROLLEN_FEHLER_TEXT = "Jede Stelle der Führungsstellen-Übung braucht einen eigenen Funkrufnamen.";

export async function loadFuehrungsstellenUebung(ctrl: GeneratorController, slug: string): Promise<FuehrungsstellenUebung | null> {
    try {
        return await ladeFuehrungsstellenUebung(slug);
    } catch (error) {
        console.error("Drehbuch konnte nicht geladen werden:", error);
        meldeFehler(ctrl, "Das Drehbuch konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.");
        return null;
    }
}

/** Drehbuch der gespeicherten Übung; null ohne Auswahl oder wenn das Laden scheitert. */
export async function ladeDrehbuchDerUebung(ctrl: GeneratorController): Promise<FuehrungsstellenUebung | null> {
    const slug = ctrl.funkUebung.fuehrungsstelle?.slug;
    if (!slug) {
        return null;
    }
    return loadFuehrungsstellenUebung(ctrl, slug);
}

function sichereTeilnehmerVorFuehrungsstelle(ctrl: GeneratorController): void {
    if (ctrl.teilnehmerVorFuehrungsstelle) {
        return;
    }
    ctrl.teilnehmerVorFuehrungsstelle = {
        liste: [...ctrl.funkUebung.teilnehmerListe],
        stellen: { ...(ctrl.funkUebung.teilnehmerStellen ?? {}) }
    };
}

export function stelleTeilnehmerWiederHer(ctrl: GeneratorController): void {
    const gesichert = ctrl.teilnehmerVorFuehrungsstelle;
    if (!gesichert) {
        return;
    }
    ctrl.funkUebung.teilnehmerListe = [...gesichert.liste];
    ctrl.funkUebung.teilnehmerStellen = { ...gesichert.stellen };
    ctrl.teilnehmerVorFuehrungsstelle = null;
}

/** Auswahl und Besetzung prüfen; liefert den Slug oder null (Meldung ist dann gezeigt). */
function pruefeAuswahlUndRollen(ctrl: GeneratorController): string | null {
    const slug = ctrl.funkUebung.fuehrungsstelle?.slug ?? "";
    if (!slug || !FUEHRUNGSSTELLEN_UEBUNGEN[slug]) {
        meldeFehler(ctrl, "Bitte ein Drehbuch auswählen.", [{ feld: "fuehrungsstelleAuswahl", text: "Bitte ein Drehbuch auswählen." }]);
        return null;
    }
    const rollenFehler = pruefeFuehrungsstellenRollen(ctrl.funkUebung.fuehrungsstelle ?? {
        beuebteStelle: "", uebergeordnet: "", unterstellt: []
    });
    if (rollenFehler.length > 0) {
        meldeFehler(ctrl, ROLLEN_FEHLER_TEXT, rollenFehler);
        return null;
    }
    return slug;
}

/** Führungsstellen-Übung erzeugen; false, wenn Auswahl oder Besetzung nicht passen. */
export async function generiereFuehrungsstellenUebung(ctrl: GeneratorController): Promise<boolean> {
    const slug = pruefeAuswahlUndRollen(ctrl);
    if (!slug) {
        return false;
    }
    const drehbuch = await loadFuehrungsstellenUebung(ctrl, slug);
    if (!drehbuch) {
        return false;
    }
    ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);
    ctrl.funkUebung.funksprueche = [];
    ctrl.funkUebung.verwendeteVorlagen = [];
    sichereTeilnehmerVorFuehrungsstelle(ctrl);
    try {
        ctrl.generationService.generateFuehrungsstelle(ctrl.funkUebung, drehbuch);
    } catch (error) {
        meldeFehler(ctrl, error instanceof Error ? error.message : "Die Führungsstellen-Übung konnte nicht erzeugt werden.");
        return false;
    }
    return true;
}

/** Blatt mit Lage und Auftrag für die beübte Stelle (ohne Drehbuch-Erwartungen). */
export async function druckeBlattBeuebteStelle(ctrl: GeneratorController): Promise<void> {
    const drehbuch = await ladeDrehbuchDerUebung(ctrl);
    if (!drehbuch) {
        return;
    }
    if (!druckeBlatt(baueBlattBeuebteStelle(ctrl.funkUebung, drehbuch))) {
        uiFeedback.error("Das Druckfenster wurde blockiert. Erlaube Pop-ups für diese Seite und versuche es erneut.");
    }
}

function zeigeDrehbuchInfo(ctrl: GeneratorController, drehbuch: FuehrungsstellenUebung): void {
    ctrl.fuehrungsstelleGrenzen = {
        min: Math.max(1, drehbuch.minAbschnitte),
        max: fuehrungsstellenMaxAbschnitte(drehbuch)
    };
    ctrl.aendereAbschnitte(namen => namen);
    ctrl.view.renderFuehrungsstelleInfo([
        drehbuch.beschreibung,
        `Für ${ctrl.fuehrungsstelleGrenzen.min} bis ${ctrl.fuehrungsstelleGrenzen.max} Einsatzabschnitte · ` +
        `${fuehrungsstellenNachrichtenAnzahl(drehbuch)} Nachrichten · ${drehbuch.dauerMinuten} Minuten.`
    ]);
}

/**
 * Beschreibung und Abschnittsspanne des gewählten Drehbuchs anzeigen und
 * die Abschnittsliste in die erlaubte Spanne bringen.
 */
export async function updateFuehrungsstelleInfo(ctrl: GeneratorController): Promise<void> {
    const token = ++ctrl.fuehrungsstelleInfoToken;
    const slug = ctrl.view.getSelectedFuehrungsstelle();
    if (!slug || !FUEHRUNGSSTELLEN_UEBUNGEN[slug]) {
        ctrl.view.renderFuehrungsstelleInfo([]);
        return;
    }
    try {
        const drehbuch = await ladeFuehrungsstellenUebung(slug);
        if (token !== ctrl.fuehrungsstelleInfoToken) {
            return; // Inzwischen wurde ein anderes Drehbuch gewählt.
        }
        zeigeDrehbuchInfo(ctrl, drehbuch);
    } catch (error) {
        if (token !== ctrl.fuehrungsstelleInfoToken) {
            return;
        }
        console.error("Drehbuch-Info konnte nicht geladen werden:", error);
        ctrl.view.renderFuehrungsstelleInfo(["Das Drehbuch konnte nicht geladen werden."]);
    }
}

/** Abschnittsliste ändern; die Zeilen kommen aus dem Formular, damit getippte Stellennamen erhalten bleiben. */
export function aendereAbschnitte(
    ctrl: GeneratorController,
    aenderung: (zeilen: AbschnittZeile[]) => AbschnittZeile[]
): void {
    const zeilen = aenderung(ctrl.view.getFuehrungsstellenAbschnitte());
    while (zeilen.length < ctrl.fuehrungsstelleGrenzen.min) {
        zeilen.push(ctrl.naechsterAbschnitt(zeilen));
    }
    ctrl.view.renderFuehrungsstellenAbschnitte(zeilen.slice(0, ctrl.fuehrungsstelleGrenzen.max), ctrl.fuehrungsstelleGrenzen);
}

/**
 * Die Führungsstellen-Übung dauert so lange wie ihr Drehbuch; die
 * Funkspruch-Schätzung (sprechen + mitschreiben) passt dort nicht
 * (THW-Review workflow F9: 428 statt 180 Minuten).
 */
export async function zeigeDrehbuchDauer(ctrl: GeneratorController, slug: string): Promise<void> {
    try {
        const drehbuch = await ladeFuehrungsstellenUebung(slug);
        if (ctrl.funkUebung.fuehrungsstelle?.slug === slug) {
            ctrl.hinweise.setzeDauer(`${drehbuch.dauerMinuten} Min (Drehbuch)`);
        }
    } catch {
        // Ohne Drehbuch bleibt die Schätzung stehen.
    }
}
