/**
 * Registry der mitgelieferten Szenarien. Die Inhalte liegen als JSON unter
 * assets/szenarien/ und werden erst bei Auswahl per fetch geladen — genau wie
 * die Funkspruch-Vorlagen nicht ins Bundle wandern (Performance-Budget).
 *
 * tests/szenarien/SzenarioBestand.test.ts hält Registry und Dateien synchron:
 * jede Datei braucht einen Eintrag, jeder Eintrag eine Datei, und der Titel
 * hier muss dem Titel im JSON entsprechen.
 */
export interface SzenarioRegistryEintrag {
    titel: string;
    filename: string;
}

export const SZENARIEN: Record<string, SzenarioRegistryEintrag> = {
    "unwetter-sturm": { titel: "Sturmtief über dem Landkreis", filename: "assets/szenarien/unwetter-sturm.json" },
    "hochwasser-deich": { titel: "Hochwasser und Deichverteidigung", filename: "assets/szenarien/hochwasser-deich.json" },
    "stromausfall-stadt": { titel: "Flächiger Stromausfall", filename: "assets/szenarien/stromausfall-stadt.json" },
    "vermisstensuche-wald": { titel: "Vermisstensuche im Waldgebiet", filename: "assets/szenarien/vermisstensuche-wald.json" },
    "waldbrand-unterstuetzung": { titel: "Vegetationsbrand am Stadtrand", filename: "assets/szenarien/waldbrand-unterstuetzung.json" },
    "sanitaet-stadtfest": { titel: "Sanitätswachdienst Stadtfest", filename: "assets/szenarien/sanitaet-stadtfest.json" },
    "bombenfund-evakuierung": { titel: "Bombenfund und Evakuierung", filename: "assets/szenarien/bombenfund-evakuierung.json" },
    "schneelage-verkehr": { titel: "Schneelage und Verkehrschaos", filename: "assets/szenarien/schneelage-verkehr.json" },
    "bereitstellungsraum-manv": { titel: "Bereitstellungsraum bei MANV", filename: "assets/szenarien/bereitstellungsraum-manv.json" },
    "oelschaden-gewaesser": { titel: "Ölschaden auf dem Kanal", filename: "assets/szenarien/oelschaden-gewaesser.json" }
};
