/**
 * Registry der mitgelieferten Einspielungen (Stabsrahmenübungen für eine
 * Führungsstelle). Die Inhalte liegen als JSON unter assets/einspielungen/ und
 * werden erst bei Auswahl per fetch geladen — wie Szenarien und Vorlagen
 * wandern sie nicht ins Bundle (Performance-Budget).
 *
 * tests/einspielungen/EinspielungBestand.test.ts hält Registry und Dateien
 * synchron: jede Datei braucht einen Eintrag, jeder Eintrag eine Datei, und
 * der Titel hier muss dem Titel im JSON entsprechen.
 */
export interface EinspielungRegistryEintrag {
    titel: string;
    filename: string;
}

// Entwurf: Die Einträge kommen zusammen mit den Drehbüchern unter
// assets/einspielungen/ dazu (geplant: hochwasser-fuehrungsstelle und
// bombenfund-fuehrungsstelle), sobald das Konzept abgestimmt ist.
export const EINSPIELUNGEN: Record<string, EinspielungRegistryEintrag> = {};
