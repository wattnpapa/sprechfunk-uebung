// Typen für den QR-Encoder (qrcode.mjs). Der Encoder wird auch im Browser-
// Bundle genutzt (src/pdf/zugang.ts zeichnet den Teilnehmer-QR-Code in die
// Ausdrucke); diese Deklaration erlaubt den Import aus TypeScript, ohne die
// .mjs-Datei in das TypeScript-Programm (rootDir src) zu ziehen.

export interface QrErgebnis {
    matrix: boolean[][];
    groesse: number;
    version: number;
    maske: number;
}

export function kapazitaet(version: number): number;
export function qrMatrix(text: string): QrErgebnis;
export function qrSvg(text: string, optionen?: { rand?: number; farbe?: string }): string;
