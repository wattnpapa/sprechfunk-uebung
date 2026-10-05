import type { GeneratorController } from "./index";
import { meldeFehler } from "./controllerStatus";
import { normalizeFunksprueche } from "./controllerHilfen";
import { uiFeedback } from "../core/UiFeedback";
import { SZENARIEN } from "../data/szenarien";
import { parseSzenario } from "../services/SzenarioService";
import { szenarioMaxTeilnehmer, szenarioSpruchAnzahl, type Szenario } from "../types/Szenario";

/**
 * Spruchquellen des Generators: Szenario-Drehbücher sowie Funksprüche aus
 * Vorlagen oder einer hochgeladenen Datei.
 */

const VORLAGE_FEHLT = {
    feld: "funkspruchVorlage",
    text: "Bitte mindestens eine Vorlage auswählen, die zu deiner Einheit passt."
};

/** Lädt und validiert ein Szenario-JSON; Ergebnisse werden gecacht. */
export async function fetchSzenario(ctrl: GeneratorController, slug: string): Promise<Szenario> {
    const cached = ctrl.szenarioCache.get(slug);
    if (cached) {
        return cached;
    }
    const eintrag = SZENARIEN[slug];
    if (!eintrag) {
        throw new Error(`Unbekanntes Szenario: ${slug}`);
    }
    const response = await fetch(eintrag.filename);
    if (!response.ok) {
        throw new Error(`Szenario ${slug} nicht ladbar (HTTP ${response.status})`);
    }
    const szenario = parseSzenario(slug, await response.json());
    ctrl.szenarioCache.set(slug, szenario);
    return szenario;
}

async function loadSelectedSzenario(ctrl: GeneratorController): Promise<Szenario | null> {
    const slug = ctrl.view.getSelectedSzenario();
    if (!slug || !SZENARIEN[slug]) {
        meldeFehler(ctrl, "Bitte ein Szenario auswählen.", [{ feld: "szenarioAuswahl", text: "Bitte ein Szenario auswählen." }]);
        return null;
    }
    try {
        return await fetchSzenario(ctrl, slug);
    } catch (error) {
        console.error("Szenario konnte nicht geladen werden:", error);
        meldeFehler(ctrl, "Das Szenario konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.");
        return null;
    }
}

function validateSzenarioTeilnehmerzahl(ctrl: GeneratorController, szenario: Szenario): boolean {
    const anzahl = ctrl.funkUebung.teilnehmerListe.length;
    const min = Math.max(2, szenario.minTeilnehmer);
    const max = szenarioMaxTeilnehmer(szenario);
    if (anzahl < min || anzahl > max) {
        meldeFehler(
            ctrl,
            `Das Szenario "${szenario.titel}" ist für ${min} bis ${max} Teilnehmer ausgelegt ` +
            `(aktuell: ${anzahl}). Bitte Teilnehmerliste anpassen oder anderes Szenario wählen.`
        );
        return false;
    }
    return true;
}

export async function generiereSzenarioUebung(ctrl: GeneratorController): Promise<boolean> {
    const szenario = await loadSelectedSzenario(ctrl);
    if (!szenario || !validateSzenarioTeilnehmerzahl(ctrl, szenario)) {
        return false;
    }
    // Drehbuch statt Pool: Lösungswörter und Spruchquellen entfallen.
    ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);
    ctrl.funkUebung.funksprueche = [];
    ctrl.funkUebung.verwendeteVorlagen = [];
    ctrl.generationService.generate(ctrl.funkUebung, szenario);
    return true;
}

export async function updateSzenarioInfo(ctrl: GeneratorController): Promise<void> {
    const token = ++ctrl.szenarioInfoToken;
    const slug = ctrl.view.getSelectedSzenario();
    if (!slug || !SZENARIEN[slug]) {
        ctrl.view.renderSzenarioInfo([]);
        return;
    }
    try {
        const szenario = await fetchSzenario(ctrl, slug);
        if (token !== ctrl.szenarioInfoToken) {
            return; // Inzwischen wurde ein anderes Szenario gewählt.
        }
        const min = Math.max(2, szenario.minTeilnehmer);
        const max = szenarioMaxTeilnehmer(szenario);
        ctrl.view.renderSzenarioInfo([
            szenario.beschreibung,
            `Für ${min} bis ${max} Teilnehmer · ${szenarioSpruchAnzahl(szenario)} Funksprüche insgesamt.`
        ]);
    } catch (error) {
        if (token !== ctrl.szenarioInfoToken) {
            return;
        }
        console.error("Szenario-Info konnte nicht geladen werden:", error);
        ctrl.view.renderSzenarioInfo(["Szenario konnte nicht geladen werden."]);
    }
}

export async function loadFunkspruecheFromSelectedSource(ctrl: GeneratorController): Promise<boolean> {
    const source = ctrl.view.getSelectedSource();
    if (source === "vorlagen") {
        return loadFunkspruecheFromVorlagen(ctrl);
    }
    return loadFunkspruecheFromUpload(ctrl);
}

function ladeVorlagenTexte(ctrl: GeneratorController, selected: string[]): Promise<string[]> {
    return Promise.all(selected.map(k => {
        const template = ctrl.templatesFunksprueche[k];
        if (!template) {
            throw new Error(`Template nicht gefunden: ${k}`);
        }
        return fetch(template.filename).then(r => {
            if (r.ok === false) {
                throw new Error(`Vorlage ${k} nicht ladbar (HTTP ${r.status})`);
            }
            return r.text();
        });
    }));
}

async function loadFunkspruecheFromVorlagen(ctrl: GeneratorController): Promise<boolean> {
    const selected = ctrl.view.getSelectedTemplates();
    if (selected.length === 0) {
        meldeFehler(ctrl, "Bitte mindestens eine Funkspruch-Vorlage auswählen.", [VORLAGE_FEHLT]);
        return false;
    }
    ctrl.funkUebung.verwendeteVorlagen = selected;

    const missing = selected.filter(k => !ctrl.templatesFunksprueche[k]);
    if (missing.length > 0) {
        meldeFehler(ctrl, "Mindestens eine Vorlage ist nicht verfügbar. Bitte Auswahl prüfen.");
        return false;
    }

    try {
        const texts = await ladeVorlagenTexte(ctrl, selected);
        // Reihenfolge bleibt die der Vorlagen: GenerationService mischt den
        // Spruch-Pool ohnehin selbst, und zwar mit dem Seed der Übung. Ein
        // Vorab-Mischen hier würde die Reproduzierbarkeit wieder aushebeln.
        ctrl.funkUebung.funksprueche = normalizeFunksprueche(texts.flatMap(t => t.split("\n")));
        return true;
    } catch (error) {
        // Ohne Netz kam hier bisher nur ein Konsoleneintrag (THW-Review
        // offline-resilience P1-2): Der Klick tat scheinbar nichts.
        console.error(error);
        meldeFehler(
            ctrl,
            "Die Funkspruch-Vorlagen konnten nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut."
        );
        return false;
    }
}

async function loadFunkspruecheFromUpload(ctrl: GeneratorController): Promise<boolean> {
    const file = ctrl.view.getUploadedFile();
    if (!file) {
        meldeFehler(ctrl, "Bitte eine Datei mit Funksprüchen wählen.", [{ feld: "funksprueche", text: "Bitte eine .txt-Datei wählen." }]);
        return false;
    }
    const text = await file.text();
    ctrl.funkUebung.funksprueche = normalizeFunksprueche(text.split("\n"));
    return true;
}

/** Warnt, wenn der Spruch-Pool kleiner ist als der Bedarf der Übung. */
export function warnIfSpruchPoolTooSmall(ctrl: GeneratorController): void {
    const anmeldungOffset = ctrl.funkUebung.anmeldungAktiv ? 1 : 0;
    const proTeilnehmer = Math.max(0, ctrl.funkUebung.spruecheProTeilnehmer - anmeldungOffset);
    const bedarf = ctrl.funkUebung.teilnehmerListe.length * proTeilnehmer;
    const vorhanden = ctrl.funkUebung.funksprueche.length;
    if (bedarf > 0 && vorhanden < bedarf) {
        uiFeedback.info(
            `Nur ${vorhanden} eindeutige Funksprüche für ${bedarf} benötigte Nachrichten – ` +
            "einzelne Sprüche wiederholen sich zwangsläufig. Wähle mehr Vorlagen aus oder " +
            "reduziere 'Funksprüche pro Teilnehmer'."
        );
    }
}
