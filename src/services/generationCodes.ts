import type { FunkUebung } from "../models/FunkUebung";

export const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const UEBUNG_CODE_LENGTH = 6;
export const TEILNEHMER_CODE_LENGTH = 4;

export function isValidShortCode(code: string | undefined, length: number): boolean {
    if (!code || code.length !== length) {
        return false;
    }
    return [...code.toUpperCase()].every(char => SHORT_CODE_ALPHABET.includes(char));
}

/**
 * Gleichverteilter Zufallsindex aus der Web-Crypto-API.
 * Bytes oberhalb des größten Vielfachen von `obergrenze` werden verworfen,
 * damit kein Modulo-Bias entsteht (Rejection Sampling).
 */
function secureRandomIndex(obergrenze: number): number {
    const crypto = globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== "function") {
        throw new Error(
            "Zugangscodes erfordern crypto.getRandomValues; diese Umgebung stellt die Web-Crypto-API nicht bereit."
        );
    }

    const maxWert = 256 - (256 % obergrenze);
    const puffer = new Uint8Array(1);
    let wert = maxWert;
    while (wert >= maxWert) {
        crypto.getRandomValues(puffer);
        wert = puffer[0] ?? maxWert;
    }

    return wert % obergrenze;
}

/**
 * Zugangscodes stammen bewusst NICHT aus der seedbaren Zufallsquelle.
 *
 * Der Seed einer Übung wird im Übungsdokument gespeichert, und dieses
 * Dokument ist ohne Authentifizierung lesbar (siehe firestore.rules). Aus
 * einer seedbaren Quelle erzeugte Codes ließen sich damit von jedem
 * nachrechnen, der den Seed sieht. Reproduzierbar soll die
 * Nachrichtenverteilung sein, nicht die Zugangsdaten.
 */
export function generateShortCode(length: number): string {
    const alphabet = SHORT_CODE_ALPHABET;
    let result = "";
    for (let i = 0; i < length; i++) {
        result += alphabet[secureRandomIndex(alphabet.length)];
    }
    return result;
}

function generateUniqueShortCode(length: number, used: Set<string>): string {
    let code = generateShortCode(length);
    while (used.has(code)) {
        code = generateShortCode(length);
    }
    return code;
}

/** Vergibt Übungs- und Teilnehmercodes; gültige vorhandene Codes bleiben erhalten. */
export function ensureJoinCodes(uebung: FunkUebung): void {
    if (!isValidShortCode(uebung.uebungCode, UEBUNG_CODE_LENGTH)) {
        uebung.uebungCode = generateShortCode(UEBUNG_CODE_LENGTH);
    } else {
        uebung.uebungCode = uebung.uebungCode.toUpperCase();
    }

    const existing = uebung.teilnehmerIds || {};
    const next: Record<string, string> = {};
    const used = new Set<string>();

    uebung.teilnehmerListe.forEach(name => {
        const reused = Object.entries(existing).find(([code, value]) =>
            value === name && isValidShortCode(code, TEILNEHMER_CODE_LENGTH)
        )?.[0];

        const code = reused && !used.has(reused)
            ? reused
            : generateUniqueShortCode(TEILNEHMER_CODE_LENGTH, used);

        used.add(code);
        next[code] = name;
    });

    uebung.teilnehmerIds = next;
}
