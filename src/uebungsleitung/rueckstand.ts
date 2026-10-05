/**
 * Rückstand einer Rolle im X-Zeit-Modus – dieselbe Rechnung wie im Plan der
 * Übungsleitung („überfällig n min“ / „jetzt fällig“), damit Rollenspieler
 * und Leitung dasselbe Lagebild sehen (THW-Review 2026-10-05, workflow W2).
 *
 * Bewusst ohne DOM: Die Teilnehmeransicht ruft {@link rueckstandFuerRolle}
 * und {@link rueckstandText} mit ihren eigenen Nachrichten auf.
 */
import { formatCountdown, parseHHMMtoMs } from "../utils/xzeit";
import { berechneFaelligkeit, faelligFensterMs } from "./lagebild";

export interface RueckstandNachricht {
    id: number;
    xZeitSlot?: number;
}

export interface Rueckstand {
    /** Offen und länger als ein Fälligkeitsfenster über der Soll-Zeit. */
    ueberfaellig: number;
    /** Offen, Soll-Zeit erreicht, aber noch im Fälligkeitsfenster. */
    faellig: number;
    /** Minuten seit der Soll-Zeit der ältesten offenen, schon fälligen Nachricht. */
    aeltesteSeitMinuten: number | null;
    /** Die zuerst nachzuholende Nachricht (älteste Soll-Zeit unter den fälligen). */
    ersteFaelligeId: number | null;
    /** Nächste noch nicht fällige offene Nachricht und Abstand bis dahin. */
    naechsteId: number | null;
    naechsteInMs: number | null;
}

/**
 * @param istErledigt `true` für abgesetzte, von der Leitung bestätigte oder
 *                    bewusst ausgelassene Nachrichten
 * @param basisMs     verbindliche X-Zeit-Basis in Millisekunden
 */
export function rueckstandFuerRolle(
    nachrichten: RueckstandNachricht[],
    istErledigt: (id: number) => boolean,
    basisMs: number,
    zeit: { jetztMs: number; intervallMinuten?: number }
): Rueckstand {
    const fenster = faelligFensterMs(zeit.intervallMinuten);
    const ergebnis: Rueckstand = {
        ueberfaellig: 0, faellig: 0, aeltesteSeitMinuten: null, ersteFaelligeId: null, naechsteId: null, naechsteInMs: null
    };
    let aeltesteSollMs = Infinity;
    nachrichten
        .filter((n): n is Required<RueckstandNachricht> => n.xZeitSlot !== undefined && !istErledigt(n.id))
        .forEach(n => {
            const f = berechneFaelligkeit(n.xZeitSlot, basisMs, zeit.jetztMs, fenster);
            if (f.zustand === "spaeter") {
                const inMs = f.sollMs - zeit.jetztMs;
                if (ergebnis.naechsteInMs === null || inMs < ergebnis.naechsteInMs) {
                    ergebnis.naechsteInMs = inMs;
                    ergebnis.naechsteId = n.id;
                }
                return;
            }
            ergebnis[f.zustand === "ueberfaellig" ? "ueberfaellig" : "faellig"]++;
            if (f.sollMs < aeltesteSollMs) {
                aeltesteSollMs = f.sollMs;
                ergebnis.ersteFaelligeId = n.id;
                ergebnis.aeltesteSeitMinuten = f.minuten;
            }
        });
    return ergebnis;
}

/**
 * Klartext für die Rolle, solange etwas nachhängt – sonst `null` (dann gilt
 * der normale Countdown). Beispiel: „3 überfällig, älteste seit 94 min –
 * Nr. 1 jetzt einspielen“.
 */
export function rueckstandText(r: Rueckstand): string | null {
    if (r.ersteFaelligeId === null) {
        return null;
    }
    const teile: string[] = [];
    if (r.ueberfaellig > 0) {
        teile.push(`${r.ueberfaellig} überfällig, älteste seit ${r.aeltesteSeitMinuten ?? 0} min`);
    }
    if (r.faellig > 0) {
        teile.push(`${r.faellig} jetzt fällig`);
    }
    return `${teile.join(", ")} – Nr. ${r.ersteFaelligeId} jetzt einspielen`;
}

/**
 * Countdown-Zeile der Rolle: erst der Rückstand, dann die nächste künftige
 * Einspielung. Ohne gültige Basis `null` (dann zeigt die Rolle nichts an).
 *
 * Beispiel: „2 überfällig, älteste seit 94 min – Nr. 1 jetzt einspielen ·
 * Nächste in 6:54“; ohne Rückstand nur „Nächste in 6:54“.
 */
export function rolleCountdownText(
    nachrichten: RueckstandNachricht[],
    istErledigt: (id: number) => boolean,
    xZeitBasis: string,
    zeit: { jetzt?: Date; intervallMinuten?: number } = {}
): string | null {
    const jetzt = zeit.jetzt ?? new Date();
    const basisMs = parseHHMMtoMs(xZeitBasis, jetzt);
    if (basisMs === null) {
        return null;
    }
    const r = rueckstandFuerRolle(nachrichten, istErledigt, basisMs, {
        jetztMs: jetzt.getTime(),
        ...(zeit.intervallMinuten !== undefined ? { intervallMinuten: zeit.intervallMinuten } : {})
    });
    const naechste = r.naechsteInMs !== null ? `Nächste in ${formatCountdown(r.naechsteInMs)}` : null;
    const rueckstand = rueckstandText(r);
    if (rueckstand) {
        return naechste ? `${rueckstand} · ${naechste}` : rueckstand;
    }
    return naechste ?? "Keine ausstehenden Nachrichten";
}
