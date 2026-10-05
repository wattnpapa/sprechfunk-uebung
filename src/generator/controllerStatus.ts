import type { GeneratorController } from "./index";
import type { FeldFehler } from "./GeneratorValidierung";
import type { FuehrungsstellenRollenFormular, FunkspruchQuelle } from "./GeneratorView";
import type { LoesungswortOption } from "./GeneratorStateService";
import { type GeneratorEntwurf, speichereEntwurf } from "./GeneratorEntwurf";
import { ENTWURF_VERZOEGERUNG_MS, formularFuerEntwurf, setzeZentralesWortImFormular } from "./controllerHilfen";
import { leseLoesungswoerterAusFormular } from "./controllerLoesungswort";
import { uiFeedback } from "../core/UiFeedback";

/**
 * Formularänderungen des Generators: Entwurf, Statusleiste, veraltetes
 * Ergebnis, Modusanzeige und die sichtbare Fehlermeldung.
 */

const OPTION_LABEL: Record<LoesungswortOption, string> = { none: "Keine", central: "Zentral", individual: "Individuell" };

/** Eine Übung mit Nachrichten ist gespeichert: geladen oder erfolgreich generiert. */
export function istGespeichert(ctrl: GeneratorController): boolean {
    return !!ctrl.funkUebung.nachrichten && Object.keys(ctrl.funkUebung.nachrichten).length > 0;
}

export function aktualisiereModusAnzeige(ctrl: GeneratorController): void {
    ctrl.hinweise.zeigeModus({
        gespeichert: istGespeichert(ctrl),
        name: ctrl.funkUebung.name,
        uebungCode: ctrl.funkUebung.uebungCode
    });
}

/**
 * Fehler bleibt an der Aktionsleiste stehen. Eingabefehler stehen zusätzlich
 * am Feld und bekommen keinen Toast mehr: Fehler-Toasts bleiben stehen, bis
 * man sie wegtippt, und stapelten sich bei jedem Versuch – auch längst
 * behobene (THW-Review 2026-10-05, error-recovery P2-1, workflow W9).
 * Andere Fehler (Verbindung, Speichern) kommen weiter zusätzlich als Toast.
 */
export function meldeFehler(ctrl: GeneratorController, text: string, feldFehler: FeldFehler[] = []): void {
    ctrl.hinweise.zeigeFehlerBox(text);
    if (feldFehler.length > 0) {
        ctrl.hinweise.zeigeFeldFehler(feldFehler);
        return;
    }
    uiFeedback.error(text);
}

export function formularGeaendert(ctrl: GeneratorController): void {
    if (ctrl.wendeAn) {
        return;
    }
    if (istGespeichert(ctrl) && !ctrl.ergebnisVeraltet) {
        ctrl.ergebnisVeraltet = true;
        ctrl.hinweise.markiereErgebnisVeraltet(true);
    }
    aktualisiereStatusleiste(ctrl);
    planeEntwurf(ctrl);
}

function planeEntwurf(ctrl: GeneratorController): void {
    if (!ctrl.isFreshExercise || istGespeichert(ctrl)) {
        return;
    }
    if (ctrl.entwurfTimer !== null) {
        clearTimeout(ctrl.entwurfTimer);
    }
    ctrl.entwurfTimer = setTimeout(() => {
        ctrl.entwurfTimer = null;
        speichereAktuellenEntwurf(ctrl);
    }, ENTWURF_VERZOEGERUNG_MS);
}

function quellenTeil(ctrl: GeneratorController, quelle: FunkspruchQuelle): Pick<GeneratorEntwurf, "szenarioSlug" | "fuehrungsstelle"> {
    if (quelle === "szenario") {
        return { szenarioSlug: ctrl.view.getSelectedSzenario() };
    }
    if (quelle === "fuehrungsstelle") {
        return { fuehrungsstelle: { slug: ctrl.view.getSelectedFuehrungsstelle(), ...ctrl.view.getFuehrungsstellenRollen() } };
    }
    return {};
}

export function speichereAktuellenEntwurf(ctrl: GeneratorController): void {
    if (!ctrl.isFreshExercise || istGespeichert(ctrl)) {
        return;
    }
    const formular = ctrl.view.getFormData();
    const quelle = ctrl.view.getSelectedSource();
    const option = ctrl.view.getSelectedLoesungswortOption();
    const entwurf: GeneratorEntwurf = {
        version: 1,
        gespeichertAm: new Date().toISOString(),
        formular: formularFuerEntwurf(formular),
        quelle,
        vorlagen: ctrl.view.getSelectedTemplates(),
        ...quellenTeil(ctrl, quelle),
        teilnehmerListe: [...ctrl.funkUebung.teilnehmerListe],
        teilnehmerStellen: { ...(ctrl.funkUebung.teilnehmerStellen ?? {}) },
        loesungswortOption: option,
        loesungswoerter: option === "none" ? {} : leseLoesungswoerterAusFormular(ctrl, option)
    };
    speichereEntwurf(entwurf);
}

function leseQuelle(ctrl: GeneratorController): FunkspruchQuelle {
    try {
        return ctrl.view.getSelectedSource();
    } catch {
        return "vorlagen";
    }
}

function leseFuehrungsstellenRollen(ctrl: GeneratorController): FuehrungsstellenRollenFormular | null {
    try {
        return ctrl.view.getFuehrungsstellenRollen();
    } catch {
        return null;
    }
}

function zaehleTeilnehmer(ctrl: GeneratorController, quelle: FunkspruchQuelle): number {
    if (quelle !== "fuehrungsstelle") {
        return ctrl.funkUebung.teilnehmerListe.filter(name => (name ?? "").trim() !== "").length;
    }
    const rollen = leseFuehrungsstellenRollen(ctrl);
    return rollen
        ? [rollen.beuebteStelle, rollen.uebergeordnet, ...rollen.unterstellt].filter(n => n.trim() !== "").length
        : 0;
}

function istDrehbuch(quelle: FunkspruchQuelle): boolean {
    return quelle === "szenario" || quelle === "fuehrungsstelle";
}

/** Statusleiste vor dem Generieren aus dem Formular, danach aus dem Ergebnis. */
export function aktualisiereStatusleiste(ctrl: GeneratorController): void {
    if (istGespeichert(ctrl) && !ctrl.ergebnisVeraltet) {
        return; // renderUebungResult hat die echten Werte gesetzt.
    }
    const quelle = leseQuelle(ctrl);
    const teilnehmer = zaehleTeilnehmer(ctrl, quelle);
    const proTeilnehmer = ctrl.funkUebung.spruecheProTeilnehmer;
    const nachrichten = !istDrehbuch(quelle) && teilnehmer > 0 && proTeilnehmer > 0
        ? `ca. ${teilnehmer * proTeilnehmer}`
        : "–";
    ctrl.hinweise.aktualisiereStatusleiste({
        teilnehmer,
        nachrichten,
        loesungswoerter: istDrehbuch(quelle) ? "Keine" : OPTION_LABEL[ctrl.loesungswortOption],
        dauer: "nach dem Generieren"
    });
}

export function zeigeWiederhergestelltenEntwurf(ctrl: GeneratorController, entwurf: GeneratorEntwurf): void {
    if (entwurf.quelle === "upload") {
        ctrl.view.setSelectedSource("upload");
    }
    if (entwurf.loesungswortOption !== "none") {
        ctrl.view.selectLoesungswortOption(entwurf.loesungswortOption);
        if (entwurf.loesungswortOption === "central") {
            setzeZentralesWortImFormular(Object.values(entwurf.loesungswoerter)[0] ?? "");
        }
        ctrl.renderTeilnehmer(false);
    }
    const zeitpunkt = new Date(entwurf.gespeichertAm);
    ctrl.hinweise.zeigeEntwurfHinweis(
        Number.isNaN(zeitpunkt.getTime()) ? new Date() : zeitpunkt,
        () => ctrl.entwurfVerwerfen()
    );
}
