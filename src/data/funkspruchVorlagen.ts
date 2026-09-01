/**
 * Registry der mitgelieferten Funkspruch-Vorlagen. Die Texte liegen unter
 * assets/funksprueche/ und werden erst bei Auswahl per fetch geladen.
 *
 * Der Schlüssel wird in der Übung als `verwendeteVorlagen` gespeichert; die
 * Admin-Übersicht löst ihn darüber wieder in den Anzeigenamen auf.
 */
export interface FunkspruchVorlage {
    text: string;
    filename: string;
}

export const FUNKSPRUCH_VORLAGEN: Record<string, FunkspruchVorlage> = {
    grundausbildung: { text: "Einfache Funksprüche für die Grundausbildung", filename: "assets/funksprueche/funksprueche_grundausbildung_einfach.txt" },
    thwleer: { text: "Funksprüche THW Leer", filename: "assets/funksprueche/nachrichten_thw_leer.txt" },
    thwmelle: { text: "Funksprüche THW Melle", filename: "assets/funksprueche/nachrichten_thw_melle.txt" },
    thwessen: { text: "Funksprüche THW Essen", filename: "assets/funksprueche/nachrichten_thw_essen.txt" },
    thwlehrte: { text: "Funksprüche THW Lehrte", filename: "assets/funksprueche/nachrichten_thw_lehrte.txt" },
    thwsaarstedt: { text: "Funksprüche THW Saarstedt", filename: "assets/funksprueche/nachrichten_thw_saarstedt.txt" },
    vorlageLustig: { text: "Lustige Funksprüche (Chat GPT)", filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt" }
};
