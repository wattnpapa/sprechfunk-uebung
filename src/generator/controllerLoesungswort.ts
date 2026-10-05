import type { GeneratorController } from "./index";
import type { LoesungswortOption } from "./GeneratorStateService";
import { leseLoesungswortZeile, setzeZentralesWortImFormular } from "./controllerHilfen";
import { uiFeedback } from "../core/UiFeedback";

/**
 * Teilnehmerzeilen und Lösungswörter des Generators: Zeichnen, Entfernen
 * mit „Rückgängig“, Mischen und der Wechsel der Lösungswort-Option.
 */

export function renderTeilnehmer(ctrl: GeneratorController, triggerShuffle: boolean): void {
    const stellen = ctrl.funkUebung.teilnehmerStellen;
    if (!ctrl.showStellenname && stellen && Object.keys(stellen).length > 0) {
        ctrl.showStellenname = true;
    }

    ctrl.view.renderTeilnehmerSection(
        ctrl.funkUebung.teilnehmerListe,
        stellen || {},
        ctrl.funkUebung.loesungswoerter || {},
        ctrl.showStellenname
    );

    if (triggerShuffle) {
        ctrl.shuffleLoesungswoerter();
    }
}

/**
 * Entfernt eine Zeile ohne Rückfrage, bietet aber kurz „Rückgängig“ an
 * (THW-Review destructive-action P2-2, error-recovery P3-2).
 */
export function removeTeilnehmer(ctrl: GeneratorController, index: number): void {
    const name = ctrl.funkUebung.teilnehmerListe[index];
    if (name === undefined) {
        return;
    }
    const eintrag = {
        index,
        name,
        stelle: ctrl.funkUebung.teilnehmerStellen?.[name],
        loesungswort: leseLoesungswortZeile(index) ?? ctrl.funkUebung.loesungswoerter?.[name]
    };
    ctrl.stateService.removeTeilnehmer(ctrl.funkUebung, index);
    ctrl.renderTeilnehmer(false);
    ctrl.hinweise.zeigeEntferntHinweis(name.trim(), () => {
        ctrl.stateService.restoreTeilnehmer(ctrl.funkUebung, eintrag);
        ctrl.renderTeilnehmer(false);
        ctrl.formularGeaendert();
    });
}

export function shuffleLoesungswoerter(ctrl: GeneratorController): void {
    const option: LoesungswortOption = ctrl.view.getSelectedLoesungswortOption();
    const result = ctrl.stateService.shuffleLoesungswoerter(
        ctrl.funkUebung,
        option,
        ctrl.predefinedLoesungswoerter
    );
    if (result.error) {
        uiFeedback.error(result.error);
        return;
    }
    if (result.centralWord !== undefined) {
        setzeZentralesWortImFormular(result.centralWord);
    }
    ctrl.renderTeilnehmer(false);
}

function merkeWoerter(ctrl: GeneratorController, vorher: LoesungswortOption, neu: LoesungswortOption): void {
    if (vorher === "none" || vorher === neu) {
        return;
    }
    const woerter = leseLoesungswoerterAusFormular(ctrl, vorher);
    if (Object.keys(woerter).length > 0) {
        ctrl.loesungswortMerker[vorher] = woerter;
    }
}

/** Setzt gemerkte Wörter wieder ein; false, wenn für die Option keine passenden gemerkt sind. */
function setzeGemerkteWoerter(ctrl: GeneratorController, neu: LoesungswortOption): boolean {
    const gemerkt = ctrl.loesungswortMerker[neu];
    if (!gemerkt || !ctrl.funkUebung.teilnehmerListe.some(name => gemerkt[name])) {
        return false;
    }
    ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);
    ctrl.funkUebung.teilnehmerListe.forEach(name => {
        const wort = gemerkt[name];
        if (wort) {
            ctrl.funkUebung.loesungswoerter[name] = wort;
        }
    });
    if (neu === "central") {
        setzeZentralesWortImFormular(Object.values(gemerkt)[0] ?? "");
    }
    ctrl.renderTeilnehmer(false);
    return true;
}

/**
 * Wechsel der Lösungswort-Option. Eigene Wörter der verlassenen Option
 * werden gemerkt und beim Zurückwechseln wieder eingesetzt, statt sie
 * durch Zufallswörter zu ersetzen (THW-Review error-recovery P3-2).
 */
export function wechsleLoesungswortOption(ctrl: GeneratorController): void {
    ctrl.view.updateLoesungswortOptionUI();
    const neu = ctrl.view.getSelectedLoesungswortOption();
    merkeWoerter(ctrl, ctrl.loesungswortOption, neu);
    ctrl.loesungswortOption = neu;
    if (neu === "none") {
        ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);
        ctrl.renderTeilnehmer(false);
        return;
    }
    if (setzeGemerkteWoerter(ctrl, neu)) {
        return;
    }
    ctrl.shuffleLoesungswoerter();
}

function leseZentralesWort(): string {
    return (document.getElementById("zentralLoesungswortInput") as HTMLInputElement | null)
        ?.value.trim().toUpperCase() ?? "";
}

/** Lösungswörter, wie sie gerade im Formular stehen, je Teilnehmer. */
export function leseLoesungswoerterAusFormular(ctrl: GeneratorController, option: LoesungswortOption): Record<string, string> {
    const woerter: Record<string, string> = {};
    if (typeof document === "undefined" || option === "none") {
        return woerter;
    }
    if (option === "central") {
        const zentral = leseZentralesWort();
        if (zentral) {
            ctrl.funkUebung.teilnehmerListe.forEach(name => {
                woerter[name] = zentral;
            });
        }
        return woerter;
    }
    ctrl.funkUebung.teilnehmerListe.forEach((name, i) => {
        const wert = leseLoesungswortZeile(i);
        if (wert) {
            woerter[name] = wert;
        }
    });
    return woerter;
}

export function readLoesungswoerterFromView(ctrl: GeneratorController): void {
    const option: LoesungswortOption = ctrl.view.getSelectedLoesungswortOption();
    ctrl.stateService.resetLoesungswoerter(ctrl.funkUebung);

    if (option === "central") {
        const val = ctrl.view.getZentralesLoesungswort().trim().toUpperCase();
        ctrl.stateService.setZentralesLoesungswort(ctrl.funkUebung, val);
    } else if (option === "individual") {
        const woerter: string[] = [];
        ctrl.funkUebung.teilnehmerListe.forEach((_, i) => {
            const input = document.getElementById(`loesungswort-${i}`) as HTMLInputElement | null;
            if (input) {
                woerter.push(input.value.trim().toUpperCase());
            }
        });
        ctrl.stateService.setIndividuelleLoesungswoerter(ctrl.funkUebung, woerter);
    }
}
