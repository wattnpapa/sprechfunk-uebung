// src/utils/buchstabieren.ts

/**
 * Regel der Übung (siehe Fußzeile der Vordrucke):
 * "Wörter in GROSSBUCHSTABEN müssen buchstabiert werden."
 *
 * Ein Wort ist genau dann eine Buchstabier-Aufgabe, wenn es
 * - mindestens 5 Zeichen lang ist,
 * - mindestens zwei Buchstaben enthält (schließt "12345" oder "B-1234" aus) und
 * - keinen Kleinbuchstaben enthält.
 */
const MIN_LAENGE = 5;
const MIN_BUCHSTABEN = 2;

const BUCHSTABE = /\p{L}/u;
const KLEINBUCHSTABE = /\p{Ll}/u;

function zaehleBuchstaben(wort: string): number {
    let anzahl = 0;
    for (const zeichen of wort) {
        if (BUCHSTABE.test(zeichen)) {
            anzahl++;
        }
    }
    return anzahl;
}

/** Prüft, ob ein einzelnes Wort buchstabiert werden muss. */
export function istBuchstabierWort(wort: string): boolean {
    return wort.length >= MIN_LAENGE
        && zaehleBuchstaben(wort) >= MIN_BUCHSTABEN
        && !KLEINBUCHSTABE.test(wort);
}

/** Prüft, ob ein Funkspruch mindestens eine Buchstabier-Aufgabe enthält. */
export function enthaeltBuchstabierAufgabe(text: string): boolean {
    return text.split(/\s+/).some(istBuchstabierWort);
}

/** Zählt die Funksprüche mit Buchstabier-Aufgabe. */
export function zaehleBuchstabierAufgaben(texte: string[]): number {
    return texte.filter(enthaeltBuchstabierAufgabe).length;
}

/**
 * Wandelt GROSSSCHREIBUNG in Normalschreibweise um: aus "MJÖLNIR" wird "Mjölnir",
 * aus "METEOR-FELD" wird "Meteor-Feld". Bindestrich-Teile werden einzeln behandelt,
 * Ziffern und Satzzeichen bleiben unverändert.
 */
function normalisiereWort(wort: string): string {
    return wort
        .split("-")
        .map(teil => {
            const zeichen = [...teil];
            const ersterBuchstabe = zeichen.findIndex(z => BUCHSTABE.test(z));
            if (ersterBuchstabe === -1) {
                return teil;
            }
            return zeichen.slice(0, ersterBuchstabe + 1).join("")
                + zeichen.slice(ersterBuchstabe + 1).join("").toLowerCase();
        })
        .join("-");
}

/**
 * Entfernt alle Buchstabier-Aufgaben aus einem Funkspruch, indem großgeschriebene
 * Wörter in Normalschreibweise überführt werden. Der Rest des Textes bleibt unberührt.
 */
export function entferneBuchstabierAufgaben(text: string): string {
    return text.replace(/\S+/g, wort => (istBuchstabierWort(wort) ? normalisiereWort(wort) : wort));
}

/**
 * Macht aus einem Funkspruch eine Buchstabier-Aufgabe, indem das Wort mit den meisten
 * Buchstaben großgeschrieben wird. Gibt `null` zurück, wenn kein Wort geeignet ist.
 */
export function erzeugeBuchstabierAufgabe(text: string): string | null {
    let bestesWort: string | null = null;
    let besteLaenge = 0;

    for (const wort of text.match(/\S+/g) || []) {
        if (!istBuchstabierWort(wort.toUpperCase())) {
            continue;
        }
        const laenge = zaehleBuchstaben(wort);
        if (laenge > besteLaenge) {
            bestesWort = wort;
            besteLaenge = laenge;
        }
    }

    if (!bestesWort) {
        return null;
    }

    let ersetzt = false;
    return text.replace(/\S+/g, wort => {
        if (!ersetzt && wort === bestesWort) {
            ersetzt = true;
            return wort.toUpperCase();
        }
        return wort;
    });
}
