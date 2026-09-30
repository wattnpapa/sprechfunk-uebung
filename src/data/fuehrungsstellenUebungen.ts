/**
 * Registry der mitgelieferten Führungsstellen-Übungen. Die Drehbücher liegen
 * als JSON unter assets/fuehrungsstellen/ und werden erst bei Auswahl per
 * fetch geladen — wie Szenarien und Vorlagen wandern sie nicht ins Bundle
 * (Performance-Budget).
 *
 * tests/fuehrungsstellen/FuehrungsstellenBestand.test.ts hält Registry und
 * Dateien synchron: jede Datei braucht einen Eintrag, jeder Eintrag eine
 * Datei, und der Titel hier muss dem Titel im JSON entsprechen.
 */
export interface FuehrungsstellenRegistryEintrag {
    titel: string;
    filename: string;
}

export const FUEHRUNGSSTELLEN_UEBUNGEN: Record<string, FuehrungsstellenRegistryEintrag> = {
    "hochwasser-fuehrungsstelle": {
        titel: "Hochwasser: Einsatzleitung mit mehreren Einsatzabschnitten",
        filename: "assets/fuehrungsstellen/hochwasser-fuehrungsstelle.json"
    },
    "bombenfund-fuehrungsstelle": {
        titel: "Bombenfund und Evakuierung: Einsatzleitung mit mehreren Einsatzabschnitten",
        filename: "assets/fuehrungsstellen/bombenfund-fuehrungsstelle.json"
    }
};
