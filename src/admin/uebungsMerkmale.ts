import type { Uebung } from "../types/Uebung";
import { FUNKSPRUCH_VORLAGEN } from "../data/funkspruchVorlagen";
import { SZENARIEN } from "../data/szenarien";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";

/** Anzeigetext für eine Tabellenzelle plus optionalem Tooltip mit Details. */
export interface UebungsMerkmal {
    label: string;
    detail?: string;
}

/**
 * Spielmodus einer Übung in der Schreibweise des Generators. Übungen ohne
 * gespeicherten Modus stammen aus der Zeit vor der X-Zeit-Einführung und
 * liefen damit klassisch.
 */
export function spielModusMerkmal(
    uebung: Pick<Uebung, "spielModus" | "xZeitIntervallMinuten" | "fuehrungsstelle">
): UebungsMerkmal {
    if (uebung.fuehrungsstelle) {
        // Die Minuten kommen aus dem Drehbuch, nicht aus einem Intervall.
        return { label: "X-Zeit", detail: "Zeiten aus dem Drehbuch" };
    }
    if (uebung.spielModus === "xZeit") {
        const intervall = uebung.xZeitIntervallMinuten;
        return intervall !== undefined
            ? { label: "X-Zeit", detail: `Intervall: ${intervall} Minuten` }
            : { label: "X-Zeit" };
    }
    return { label: "Klassisch" };
}

/**
 * Herkunft der Funksprüche: Führungsstellen-Übung, Szenario, mitgelieferte
 * Vorlagen oder eigene Liste. Die Quelle wird nicht eigens gespeichert,
 * sondern ergibt sich aus den persistierten Feldern — Führungsstellen-Übungen
 * tragen die Rollenbesetzung, Szenario-Übungen einen Slug, Vorlagen-Übungen
 * die Vorlagenschlüssel, alles andere kam per Upload.
 */
export function funkspruchQuelleMerkmal(
    uebung: Pick<Uebung, "szenarioSlug" | "verwendeteVorlagen" | "fuehrungsstelle">
): UebungsMerkmal {
    if (uebung.fuehrungsstelle) {
        const slug = uebung.fuehrungsstelle.slug;
        return { label: "Führungsstelle", detail: FUEHRUNGSSTELLEN_UEBUNGEN[slug]?.titel ?? slug };
    }
    if (uebung.szenarioSlug) {
        const titel = SZENARIEN[uebung.szenarioSlug]?.titel ?? uebung.szenarioSlug;
        return { label: "Szenario", detail: titel };
    }
    const vorlagen = uebung.verwendeteVorlagen ?? [];
    if (vorlagen.length > 0) {
        const namen = vorlagen.map(key => FUNKSPRUCH_VORLAGEN[key]?.text ?? key);
        return {
            label: vorlagen.length === 1 ? "Vorlage" : `Vorlagen (${vorlagen.length})`,
            detail: namen.join("\n")
        };
    }
    return { label: "Eigene" };
}
