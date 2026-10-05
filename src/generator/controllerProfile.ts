import type { GeneratorController } from "./index";
import { entwurfHatInhalt } from "./GeneratorEntwurf";
import {
    bereinigeProfilName,
    entwurfAusProfil,
    erstelleProfil,
    findeProfil,
    type GeneratorProfil,
    ladeProfile,
    leseProfilDatei,
    loescheProfil,
    profilAlsJson,
    profilDateiname,
    type ProfilBestand,
    speichereProfil
} from "./GeneratorProfile";
import { erfasseEntwurf, istGespeichert } from "./controllerStatus";
import { FUNKSPRUCH_VORLAGEN } from "../data/funkspruchVorlagen";
import { SZENARIEN } from "../data/szenarien";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";
import { uiFeedback } from "../core/UiFeedback";

/**
 * Profile im Generator: aktuelle Eingaben unter einem Namen im Browser
 * ablegen, wieder laden, als Datei herunterladen und aus einer Datei laden.
 * Laden öffnet immer eine neue Übung; eine gespeicherte Übung bleibt so,
 * wie sie ist.
 */

function bestand(): ProfilBestand {
    return {
        vorlagen: new Set(Object.keys(FUNKSPRUCH_VORLAGEN)),
        szenarien: new Set(Object.keys(SZENARIEN)),
        fuehrungsstellen: new Set(Object.keys(FUEHRUNGSSTELLEN_UEBUNGEN))
    };
}

function zeigeProfile(ctrl: GeneratorController, ausgewaehlt?: string): void {
    ctrl.profilView.zeigeProfile(ladeProfile(), ausgewaehlt);
}

export function profilSpeichern(ctrl: GeneratorController, eingabe: string): void {
    const name = bereinigeProfilName(eingabe);
    if (!name) {
        uiFeedback.error("Gib dem Profil einen Namen, z. B. „Grundausbildung OV“.");
        return;
    }
    const entwurf = erfasseEntwurf(ctrl);
    if (!entwurfHatInhalt(entwurf)) {
        uiFeedback.error("Es gibt noch nichts zu speichern: Trag zuerst Kopfdaten oder Teilnehmer ein.");
        return;
    }
    if (findeProfil(name) && !uiFeedback.confirm(`Profil „${name}“ gibt es schon. Überschreiben?`)) {
        return;
    }
    if (!speichereProfil(erstelleProfil(name, entwurf))) {
        uiFeedback.error("Der Browser lässt kein Speichern zu (privates Fenster oder Speicher voll). " +
            "Lade das Profil stattdessen als Datei herunter.");
        exportiereProfil(ctrl, erstelleProfil(name, entwurf));
        return;
    }
    zeigeProfile(ctrl, name);
    uiFeedback.success(`Profil „${name}“ gespeichert.`);
}

function rueckfrageLaden(ctrl: GeneratorController, name: string): boolean {
    if (istGespeichert(ctrl)) {
        return uiFeedback.confirm(
            `Profil „${name}“ laden?\n\nDas öffnet eine neue Übung. Die angezeigte gespeicherte Übung bleibt mit ihren Links unverändert.`
        );
    }
    if (entwurfHatInhalt(erfasseEntwurf(ctrl))) {
        return uiFeedback.confirm(`Profil „${name}“ laden?\n\nDeine aktuellen Eingaben im Formular werden ersetzt.`);
    }
    return true;
}

/** Schreibt ein Profil in eine neue Übung und zeichnet den Generator neu. */
export async function ladeProfilInFormular(ctrl: GeneratorController, profil: GeneratorProfil): Promise<void> {
    if (!rueckfrageLaden(ctrl, profil.name)) {
        return;
    }
    const { entwurf, entfernt } = entwurfAusProfil(profil, bestand());
    ctrl.profilZumLaden = { name: profil.name, entwurf };
    // Eine gespeicherte Übung steht mit ihrer ID in der Adresse. pushState löst
    // kein hashchange aus; Zurück führt wieder zu ihr.
    if (typeof window !== "undefined" && window.location?.hash !== "#/generator"
        && typeof window.history?.pushState === "function") {
        window.history.pushState(window.history.state, "", "#/generator");
    }
    await ctrl.handleRoute([]);
    zeigeProfile(ctrl, profil.name);
    if (entwurf.quelle === "upload") {
        uiFeedback.info("Das Profil nutzt eine eigene Funkspruch-Datei. Wähle sie unter „Quelle“ erneut aus.");
    }
    if (entfernt.length > 0) {
        uiFeedback.info(`Nicht mehr vorhanden und deshalb nicht übernommen: ${entfernt.join(", ")}.`);
    }
}

export async function profilLaden(ctrl: GeneratorController, name: string): Promise<void> {
    const profil = findeProfil(name);
    if (!profil) {
        uiFeedback.error("Dieses Profil gibt es in diesem Browser nicht mehr.");
        zeigeProfile(ctrl);
        return;
    }
    await ladeProfilInFormular(ctrl, profil);
}

function exportiereProfil(ctrl: GeneratorController, profil: GeneratorProfil): void {
    try {
        ctrl.profilView.herunterladen(profilAlsJson(profil), profilDateiname(profil.name));
    } catch (error) {
        console.error("Profil konnte nicht heruntergeladen werden:", error);
        uiFeedback.error("Die Profildatei konnte nicht erstellt werden.");
    }
}

export function profilExportieren(ctrl: GeneratorController, name: string): void {
    const profil = findeProfil(name);
    if (!profil) {
        uiFeedback.error("Wähle ein gespeichertes Profil aus.");
        return;
    }
    exportiereProfil(ctrl, profil);
}

export function profilLoeschen(ctrl: GeneratorController, name: string): void {
    const profil = findeProfil(name);
    if (!profil || !uiFeedback.confirm(`Profil „${profil.name}“ aus diesem Browser löschen?`)) {
        return;
    }
    if (!loescheProfil(profil.name)) {
        uiFeedback.error("Das Profil konnte nicht gelöscht werden.");
        return;
    }
    zeigeProfile(ctrl);
    uiFeedback.success(`Profil „${profil.name}“ gelöscht.`);
}

/**
 * Lädt eine Profildatei: Sie landet zusätzlich in den Profilen dieses
 * Browsers, damit sie beim nächsten Mal ohne Datei bereitsteht.
 */
export async function profilAusDatei(ctrl: GeneratorController, datei: Pick<File, "text">): Promise<void> {
    let text: string;
    try {
        text = await datei.text();
    } catch {
        uiFeedback.error("Die Datei konnte nicht gelesen werden.");
        return;
    }
    const ergebnis = leseProfilDatei(text);
    if (!ergebnis.ok) {
        uiFeedback.error(ergebnis.fehler);
        return;
    }
    const { profil } = ergebnis;
    const vorhanden = findeProfil(profil.name);
    const gleich = !!vorhanden && JSON.stringify(vorhanden.entwurf) === JSON.stringify(profil.entwurf);
    if (vorhanden && !gleich && !uiFeedback.confirm(
        `Profil „${profil.name}“ gibt es in diesem Browser schon. Mit dem Inhalt der Datei überschreiben?`
    )) {
        return;
    }
    if (!gleich) {
        speichereProfil(profil);
    }
    await ladeProfilInFormular(ctrl, profil);
}

/** Verdrahtet die Profil-Leiste; nach jedem render() neu, weil das Markup neu ist. */
export function bindeProfile(ctrl: GeneratorController): void {
    ctrl.profilView.bind({
        onSpeichern: name => profilSpeichern(ctrl, name),
        onLaden: name => void profilLaden(ctrl, name),
        onExportieren: name => profilExportieren(ctrl, name),
        onLoeschen: name => profilLoeschen(ctrl, name),
        onDatei: datei => void profilAusDatei(ctrl, datei)
    });
    zeigeProfile(ctrl);
    ctrl.profilView.setzeName(ctrl.funkUebung.name ?? "");
}
