import { type FunkspruchVorlage, HERKUNFT_TEXT } from "../data/funkspruchVorlagen";

/**
 * Kurzbeschreibung der Funkspruch-Vorlagen unter der Auswahl: Lage, Umfang
 * und Herkunft je Sammlung. Vorher hießen fünf Sammlungen nur nach ihrem
 * Ortsverband, und welche Lage darin steckt, sah man erst nach dem
 * Generieren (THW-Review 2026-10-05, new-user P2-1).
 */

const INFO_ID = "funkspruchVorlageInfo";

export function vorlagenZusatz(vorlage: FunkspruchVorlage): string {
    const teile: string[] = [];
    if (typeof vorlage.anzahl === "number") {
        teile.push(`${vorlage.anzahl.toLocaleString("de-DE")} Sprüche`);
    }
    if (vorlage.herkunft) {
        teile.push(HERKUNFT_TEXT[vorlage.herkunft]);
    }
    return teile.join(" · ");
}

function eintrag(doc: Document, key: string, vorlage: FunkspruchVorlage, gewaehlt: boolean): HTMLLIElement {
    const li = doc.createElement("li");
    li.dataset["vorlage"] = key;
    li.classList.toggle("is-gewaehlt", gewaehlt);
    li.classList.toggle("is-nebenbei", !!vorlage.nebenbei);
    const name = doc.createElement("strong");
    name.textContent = vorlage.text;
    li.appendChild(name);
    if (gewaehlt) {
        const marke = doc.createElement("span");
        marke.className = "generator-vorlage-gewaehlt";
        marke.textContent = " (gewählt)";
        li.appendChild(marke);
    }
    if (vorlage.beschreibung) {
        li.appendChild(doc.createTextNode(`: ${vorlage.beschreibung}`));
    }
    const zusatz = vorlagenZusatz(vorlage);
    if (zusatz) {
        const klein = doc.createElement("span");
        klein.className = "d-block text-muted";
        klein.textContent = zusatz;
        li.appendChild(klein);
    }
    return li;
}

/** Zeichnet die Liste; ohne Auswahl ist sie aufgeklappt, mit Auswahl zu. */
export function renderVorlagenInfo(templates: Record<string, FunkspruchVorlage>, selected: string[], aufklappen?: boolean): void {
    const details = document.getElementById(INFO_ID) as HTMLDetailsElement | null;
    const liste = details?.querySelector("ul");
    if (!details || !liste) {
        return;
    }
    liste.textContent = "";
    Object.entries(templates).forEach(([key, vorlage]) => {
        liste.appendChild(eintrag(document, key, vorlage, selected.includes(key)));
    });
    if (aufklappen !== undefined) {
        details.open = aufklappen;
    }
}

/** Hält die „(gewählt)“-Marken bei jeder Änderung der Auswahl aktuell. */
export function bindeVorlagenInfo(select: HTMLSelectElement, templates: Record<string, FunkspruchVorlage>): void {
    if (select.dataset["vorlagenInfo"] === "an") {
        return;
    }
    select.dataset["vorlagenInfo"] = "an";
    select.addEventListener("change", () => {
        const gewaehlt = Array.from(select.selectedOptions).map(option => option.value);
        renderVorlagenInfo(templates, gewaehlt);
    });
}
