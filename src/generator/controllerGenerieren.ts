import type { GeneratorController } from "./index";
import type { FunkspruchQuelle } from "./GeneratorView";
import {
    type FeldFehler,
    pruefeFuehrungsstellenRollen,
    pruefeKopfdaten,
    pruefeTeilnehmerListe,
    pruefeVerteilung,
    pruefeXZeit
} from "./GeneratorValidierung";
import { verwerfeEntwurf } from "./GeneratorEntwurf";
import {
    alsNeueUebungVorbereiten,
    erfolgsText,
    type GenerierModus,
    leseZahlAusFormular,
    mitZeitlimit,
    nameFuerNeueUebung,
    rueckfrageText,
    setzeAdresseAufUebung,
    setzeNameImFormular,
    sichereZustand,
    speicherFehlerText
} from "./controllerHilfen";
import { aktualisiereModusAnzeige, istGespeichert, meldeFehler } from "./controllerStatus";
import { generiereFuehrungsstellenUebung } from "./controllerFuehrungsstelle";
import { generiereSzenarioUebung, loadFunkspruecheFromSelectedSource, warnIfSpruchPoolTooSmall } from "./controllerQuellen";
import { setzeLiveStatusZurueck } from "./liveStatusZuruecksetzen";
import { merkeUebung } from "./GeneratorZuletzt";
import { store } from "../state/store";
import type { FunkUebung } from "../models/FunkUebung";
import { uiFeedback } from "../core/UiFeedback";

/** Ergebnis der Eingabeprüfung: gesammelte Feldfehler und Meldungen. */
interface Pruefung {
    fehler: FeldFehler[];
    meldungen: string[];
}

function istOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Erzeugt die Übung und speichert sie.
 *
 * Für eine schon gespeicherte Übung gibt es zwei Wege (THW-Review
 * destructive-action P0-2, workflow F1): `neu` (Standard) legt eine
 * eigene Übung mit neuer ID und neuen Codes an, die bisherige bleibt mit
 * ihren Links und Ausdrucken bestehen. `ueberschreiben` ersetzt die
 * Funksprüche unter denselben Codes und nennt vorher die Folgen.
 *
 * Scheitert etwas (Eingabe, Vorlage, Speichern), bleibt der vorherige
 * Stand im Speicher, und die Meldung steht sichtbar an der Aktionsleiste.
 */
export async function startUebung(ctrl: GeneratorController, modus: GenerierModus): Promise<void> {
    if (ctrl.laeuft) {
        return;
    }
    ctrl.hinweise.entferneFeldFehler();
    ctrl.hinweise.zeigeFehlerBox(null);

    const warGespeichert = istGespeichert(ctrl);
    // Nur der folgenschwere Weg fragt nach. „Als neue Übung“ lässt die
    // bisherige unverändert; eine Rückfrage dort trainierte nur das
    // reflexhafte „OK“ (THW-Review 2026-10-05, destructive-action P3-1).
    const ueberschreiben = warGespeichert && modus === "ueberschreiben";
    if (ueberschreiben && !uiFeedback.confirm(rueckfrageText(ctrl.funkUebung.name))) {
        return;
    }

    if (istOffline()) {
        meldeFehler(
            ctrl,
            "Keine Internetverbindung. Ohne Verbindung lässt sich die Übung nicht speichern, " +
            "und Teilnehmer-Links würden nicht funktionieren. Stell die Verbindung her und versuche es erneut."
        );
        return;
    }

    const sicherung = sichereZustand(ctrl.funkUebung, ctrl.buildInfo);
    ctrl.laeuft = true;
    ctrl.hinweise.setzeBeschaeftigt(true);
    let ergebnis: { erfolg: boolean; statusZurueckgesetzt: boolean };
    try {
        ergebnis = await generiereSpeichereUndSetzeZurueck(ctrl, sicherung, { modus, warGespeichert });
    } finally {
        ctrl.laeuft = false;
        ctrl.hinweise.setzeBeschaeftigt(false);
    }
    if (!ergebnis.erfolg) {
        ctrl.funkUebung = sicherung;
        return;
    }
    zeigeErgebnis(ctrl, modus, warGespeichert, ergebnis.statusZurueckgesetzt);
}

/**
 * Nach einem Überschreiben wird der Live-Status gleich mit zurückgesetzt,
 * solange der Knopf noch gesperrt ist.
 */
async function generiereSpeichereUndSetzeZurueck(
    ctrl: GeneratorController,
    sicherung: FunkUebung,
    lauf: { modus: GenerierModus; warGespeichert: boolean }
): Promise<{ erfolg: boolean; statusZurueckgesetzt: boolean }> {
    const erfolg = await generiereUndSpeichere(ctrl, lauf.warGespeichert && lauf.modus === "neu", lauf.warGespeichert);
    if (!erfolg || !lauf.warGespeichert || lauf.modus !== "ueberschreiben") {
        return { erfolg, statusZurueckgesetzt: true };
    }
    const statusZurueckgesetzt = await setzeLiveStatusZurueck(store.getState().db ?? null, ctrl.funkUebung.id, {
        alt: sicherung,
        neu: ctrl.funkUebung
    });
    return { erfolg, statusZurueckgesetzt };
}

/** Anzeigen; die Adresse zeigt jetzt auf diese Übung. */
function zeigeErgebnis(ctrl: GeneratorController, modus: GenerierModus, warGespeichert: boolean, statusZurueckgesetzt: boolean): void {
    ctrl.isFreshExercise = false;
    ctrl.ergebnisVeraltet = false;
    verwerfeEntwurf();
    ctrl.hinweise.zeigeEntwurfHinweis(null);
    setzeAdresseAufUebung(ctrl.funkUebung.id);
    setzeNameImFormular(ctrl.funkUebung.name);
    merkeUebung({
        id: ctrl.funkUebung.id,
        name: ctrl.funkUebung.name,
        uebungCode: ctrl.funkUebung.uebungCode,
        erstelltAm: new Date().toISOString()
    });
    ctrl.renderUebungResult();
    aktualisiereModusAnzeige(ctrl);
    if (warGespeichert) {
        ctrl.hinweise.zeigeErgebnisHinweis(
            erfolgsText(modus, ctrl.funkUebung.uebungCode, statusZurueckgesetzt),
            !statusZurueckgesetzt
        );
    }
}

async function generiereUndSpeichere(ctrl: GeneratorController, alsNeueUebung: boolean, warGespeichert: boolean): Promise<boolean> {
    // 1. Daten aus View übernehmen
    const bisherigerName = ctrl.funkUebung.name;
    const source = uebernimmFormular(ctrl);
    if (alsNeueUebung) {
        alsNeueUebungVorbereiten(ctrl.funkUebung, ctrl.buildInfo);
        // Gleicher Name wie die bisherige Übung: Zusatz „(2)“, damit sich
        // beide in der Liste unterscheiden (THW-Review 2026-10-05, error-recovery P2-2).
        ctrl.funkUebung.name = nameFuerNeueUebung(ctrl.funkUebung.name, bisherigerName);
    }

    // 2./3. Prüfen und generieren, je nach Quelle
    if (!(await generiereNachQuelle(ctrl, source))) {
        return false;
    }

    // 4. Übungscode gegen den Bestand absichern und speichern
    try {
        const codeIstFrei = await mitZeitlimit(ctrl.generationService.ensureUniqueUebungCode(
            ctrl.funkUebung,
            code => ctrl.firebaseService.isUebungCodeVergeben(code, ctrl.funkUebung.id)
        ));
        if (!codeIstFrei) {
            meldeFehler(ctrl, "Es konnte kein freier Übungscode vergeben werden. Bitte erneut versuchen.");
            return false;
        }
        await mitZeitlimit(ctrl.firebaseService.saveUebung(ctrl.funkUebung));
    } catch (error) {
        console.error("Übung konnte nicht gespeichert werden:", error);
        meldeFehler(ctrl, speicherFehlerText(error, warGespeichert));
        return false;
    }
    return true;
}

/** Formularwerte in die Übung übernehmen; liefert die gewählte Quelle. */
function uebernimmFormular(ctrl: GeneratorController): FunkspruchQuelle {
    const formData = ctrl.view.getFormData();
    Object.assign(ctrl.funkUebung, formData);
    ctrl.readLoesungswoerterFromView();
    const source = ctrl.view.getSelectedSource();
    ctrl.funkUebung.szenarioSlug = source === "szenario"
        ? (ctrl.view.getSelectedSzenario() || undefined)
        : undefined;
    ctrl.funkUebung.fuehrungsstelle = source === "fuehrungsstelle"
        ? { slug: ctrl.view.getSelectedFuehrungsstelle(), ...ctrl.view.getFuehrungsstellenRollen() }
        : undefined;
    ctrl.funkUebung.istStandardKonfiguration =
        ctrl.isFreshExercise && ctrl.createConfigFingerprint(ctrl.funkUebung) === ctrl.initialConfigFingerprint;
    return source;
}

/** Prüft die Eingaben der Quelle und generiert; false bricht ab (Meldung ist dann gezeigt). */
async function generiereNachQuelle(ctrl: GeneratorController, source: FunkspruchQuelle): Promise<boolean> {
    if (!pruefeEingaben(ctrl, source)) {
        return false;
    }
    if (source === "fuehrungsstelle") {
        // Rollen statt Teilnehmerliste: Der GenerationService prüft die
        // Besetzung gegen das Drehbuch und baut die Teilnehmerliste selbst.
        return generiereFuehrungsstellenUebung(ctrl);
    }
    if (source === "szenario") {
        return generiereSzenarioUebung(ctrl);
    }
    return generiereZufallsUebung(ctrl);
}

function pruefeRollen(ctrl: GeneratorController, pruefung: Pruefung): void {
    if (!ctrl.funkUebung.fuehrungsstelle) {
        return;
    }
    const rollen = pruefeFuehrungsstellenRollen(ctrl.funkUebung.fuehrungsstelle);
    if (rollen.length > 0) {
        pruefung.fehler.push(...rollen);
        pruefung.meldungen.push("Jede Stelle der Führungsstellen-Übung braucht einen eigenen Funkrufnamen.");
    }
}

function pruefeVorlagenAuswahl(ctrl: GeneratorController, pruefung: Pruefung): void {
    if (leseVorlagenSicher(ctrl).length === 0) {
        pruefung.fehler.push({ feld: "funkspruchVorlage", text: "Bitte mindestens eine Vorlage auswählen, die zu deiner Einheit passt." });
        pruefung.meldungen.push("Bitte mindestens eine Funkspruch-Vorlage auswählen.");
    }
}

/** Prüft Teilnehmer und (bei Vorlagen/Upload) die Verteilung; liefert die bereinigten Namen. */
function pruefeTeilnehmerUndVerteilung(ctrl: GeneratorController, source: FunkspruchQuelle, pruefung: Pruefung): string[] | null {
    let namen: string[] | null = null;
    const teilnehmer = pruefeTeilnehmerListe(ctrl.funkUebung.teilnehmerListe || []);
    if (teilnehmer.meldung) {
        pruefung.fehler.push(...teilnehmer.fehler);
        pruefung.meldungen.push(teilnehmer.meldung);
    } else {
        namen = teilnehmer.namen;
    }
    if (source === "vorlagen" || source === "upload") {
        const verteilung = verteilungsFehler(ctrl);
        if (verteilung.length > 0) {
            pruefung.fehler.push(...verteilung);
            pruefung.meldungen.push(`Ungültige Verteilung: ${verteilung[0]?.text ?? ""}`);
        }
    }
    return namen;
}

/**
 * Prüft Kopfdaten, Teilnehmer und Verteilung auf einmal und markiert alle
 * betroffenen Felder, statt nur den ersten Fehler als Toast zu zeigen
 * (THW-Review error-recovery P2-1).
 */
function pruefeEingaben(ctrl: GeneratorController, source: FunkspruchQuelle): boolean {
    const fehler: FeldFehler[] = [...kopfdatenFehler(ctrl)];
    const pruefung: Pruefung = { fehler, meldungen: fehler.length > 0 ? [fehler[0]?.text ?? ""] : [] };
    let namen: string[] | null = null;
    if (source === "fuehrungsstelle") {
        pruefeRollen(ctrl, pruefung);
    }
    if (source === "vorlagen") {
        pruefeVorlagenAuswahl(ctrl, pruefung);
    }
    if (source !== "fuehrungsstelle") {
        namen = pruefeTeilnehmerUndVerteilung(ctrl, source, pruefung);
    }
    if (fehler.length > 0) {
        meldeFehler(ctrl, pruefung.meldungen.join(" "), fehler);
        return false;
    }
    if (namen) {
        ctrl.funkUebung.teilnehmerListe = namen;
    }
    return true;
}

/** Gewählte Vorlagen; ohne lesbare Auswahl prüft später loadFunkspruecheFromVorlagen. */
function leseVorlagenSicher(ctrl: GeneratorController): string[] {
    try {
        return ctrl.view.getSelectedTemplates();
    } catch {
        return ["?"];
    }
}

function kopfdatenFehler(ctrl: GeneratorController): FeldFehler[] {
    const fehler = pruefeKopfdaten({ leitung: ctrl.funkUebung.leitung ?? "" });
    if (ctrl.funkUebung.spielModus === "xZeit") {
        fehler.push(...pruefeXZeit({
            aktiv: true,
            intervall: leseZahlAusFormular("xZeitIntervallMinuten"),
            startOffset: leseZahlAusFormular("xZeitStartOffsetMinuten")
        }));
    }
    return fehler;
}

async function generiereZufallsUebung(ctrl: GeneratorController): Promise<boolean> {
    if (!ctrl.validateSpruchVerteilung()) {
        return false;
    }
    if (!(await loadFunkspruecheFromSelectedSource(ctrl))) {
        return false;
    }
    warnIfSpruchPoolTooSmall(ctrl);
    ctrl.generationService.generate(ctrl.funkUebung);
    return true;
}

export function validateSpruchVerteilung(ctrl: GeneratorController): boolean {
    const fehler = verteilungsFehler(ctrl);
    if (fehler.length === 0) {
        return true;
    }
    meldeFehler(ctrl, `Ungültige Verteilung: ${fehler[0]?.text ?? ""}`.trim(), fehler);
    return false;
}

function verteilungsFehler(ctrl: GeneratorController): FeldFehler[] {
    return pruefeVerteilung({
        spruecheProTeilnehmer: ctrl.funkUebung.spruecheProTeilnehmer,
        spruecheAnAlle: ctrl.funkUebung.spruecheAnAlle,
        spruecheAnMehrere: ctrl.funkUebung.spruecheAnMehrere,
        anmeldungAktiv: ctrl.funkUebung.anmeldungAktiv,
        prozent: {
            prozentAnAlle: leseZahlAusFormular("prozentAnAlle"),
            prozentAnMehrere: leseZahlAusFormular("prozentAnMehrere"),
            prozentAnBuchstabieren: leseZahlAusFormular("prozentAnBuchstabieren"),
            ...(ctrl.funkUebung.nachrichtenArtAktiv
                ? { prozentSprueche: leseZahlAusFormular("prozentSprueche") }
                : {})
        }
    });
}
