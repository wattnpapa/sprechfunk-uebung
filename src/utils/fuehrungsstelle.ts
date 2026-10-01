import type {
    FuehrungsstellenKonfiguration,
    FuehrungsstellenUebung,
    Meldeart,
    UebermittlungsWeg
} from "../types/FuehrungsstellenUebung";
import { verteileStraenge } from "../types/FuehrungsstellenUebung";
import { escapeHtml } from "./html";
import { parseHHMMtoMs } from "./xzeit";

/** Beschriftung des Übermittlungswegs für Drehbuch und Ansichten. */
export function uebermittlungsWegLabel(weg: UebermittlungsWeg | undefined): string {
    switch (weg) {
    case "funk":
        return "Funk";
    case "drucker":
        return "Ausdruck";
    case "email":
        return "E-Mail";
    default:
        return "";
    }
}

/** Bootstrap-Badge-Klasse zum Weg; Funk ist der Normalfall und bleibt unauffällig. */
export function uebermittlungsWegBadgeClass(weg: UebermittlungsWeg | undefined): string {
    switch (weg) {
    case "drucker":
        return "badge bg-warning text-dark";
    case "email":
        return "badge bg-info text-dark";
    default:
        return "badge bg-secondary";
    }
}

export function meldeartLabel(art: Meldeart | undefined): string {
    switch (art) {
    case "betrieb":
        return "Betrieb";
    case "lagemeldung":
        return "Lagemeldung";
    case "anforderung":
        return "Anforderung";
    case "rueckfrage":
        return "Rückfrage";
    case "auftrag":
        return "Auftrag";
    case "information":
        return "Information";
    case "vollzug":
        return "Vollzug";
    default:
        return "";
    }
}

/** Minute ab Übungsbeginn als "+H:MM", z. B. "+0:05" oder "+2:40". */
export function formatFuehrungsstellenOffset(minuten: number): string {
    const gerundet = Math.max(0, Math.round(minuten));
    const stunden = Math.floor(gerundet / 60);
    const rest = gerundet % 60;
    return `+${stunden}:${String(rest).padStart(2, "0")}`;
}

/**
 * Uhrzeit einer Nachricht, wenn ein Übungsbeginn "HH:MM" bekannt ist; sonst
 * null. Läuft über Mitternacht hinaus weiter (Tageswechsel ist egal).
 */
export function formatFuehrungsstellenUhrzeit(minuten: number, beginn: string | undefined): string | null {
    if (!beginn) {
        return null;
    }
    const basisMs = parseHHMMtoMs(beginn, new Date(2000, 0, 1));
    if (basisMs === null) {
        return null;
    }
    const zeit = new Date(basisMs + Math.max(0, Math.round(minuten)) * 60000);
    return `${String(zeit.getHours()).padStart(2, "0")}:${String(zeit.getMinutes()).padStart(2, "0")}`;
}

/** Offset plus Uhrzeit in Klammern, wenn ein Beginn bekannt ist: "+0:45 (10:45)". */
export function formatFuehrungsstellenZeit(minuten: number, beginn: string | undefined): string {
    const offset = formatFuehrungsstellenOffset(minuten);
    const uhrzeit = formatFuehrungsstellenUhrzeit(minuten, beginn);
    return uhrzeit ? `${offset} (${uhrzeit})` : offset;
}

/**
 * Funkrufname je Strang-Schlüssel nach der Reihum-Verteilung der Stränge auf
 * die konfigurierten Einsatzabschnitte.
 */
export function strangAbschnittNamen(
    uebung: Pick<FuehrungsstellenUebung, "straenge">,
    konfiguration: Pick<FuehrungsstellenKonfiguration, "unterstellt">
): Record<string, string> {
    const zuordnung = verteileStraenge(uebung.straenge.length, konfiguration.unterstellt.length);
    const namen: Record<string, string> = {};
    uebung.straenge.forEach((strang, index) => {
        namen[strang.key] = konfiguration.unterstellt[zuordnung[index] ?? 0] ?? "";
    });
    return namen;
}

/**
 * Ersetzt {{el}}, {{stab}}, {{ea}} und {{ea:<strang>}} durch Funkrufnamen.
 * `eigenerAbschnitt` ist der Abschnitt, der den Strang der Nachricht führt
 * (für {{ea}}); beim Stab entfällt er.
 */
export function ersetzeFuehrungsstellenPlatzhalter(
    text: string,
    konfiguration: Pick<FuehrungsstellenKonfiguration, "beuebteStelle" | "uebergeordnet">,
    strangNamen: Record<string, string>,
    eigenerAbschnitt?: string
): string {
    // Ein Durchgang mit Funktions-Ersetzung: Funkrufnamen mit „$" oder einem
    // eingesetzten Platzhalter werden weder von String.replace gedeutet noch
    // ein zweites Mal ersetzt.
    return text.replace(/\{\{(el|stab|ea)(?::([a-z0-9-]+))?\}\}/g, (treffer, rolle: string, key: string | undefined) => {
        if (rolle === "el") {
            return konfiguration.beuebteStelle;
        }
        if (rolle === "stab") {
            return konfiguration.uebergeordnet;
        }
        if (key !== undefined) {
            return strangNamen[key] ?? treffer;
        }
        return eigenerAbschnitt ?? konfiguration.uebergeordnet;
    });
}

export interface FuehrungsstellenHinweise {
    /** Badges für Weg und Meldeart sowie der Betreff — vor den Nachrichtentext. */
    kopf: string;
    /** Erwartete Reaktion der beübten Stelle — unter den Nachrichtentext. */
    fuss: string;
}

/**
 * HTML-Bausteine, mit denen Teilnehmer- und Leitungsansicht eine Nachricht
 * einer Führungsstellen-Übung kennzeichnen. Für Nachrichten ohne diese
 * Felder bleiben beide Teile leer, die Ansichten ändern sich also nicht.
 */
export function renderFuehrungsstellenHinweise(nachricht: {
    weg?: UebermittlungsWeg | undefined;
    meldeart?: Meldeart | undefined;
    betreff?: string | undefined;
    erwartung?: string | undefined;
}): FuehrungsstellenHinweise {
    const badges = [
        nachricht.weg
            ? `<span class="${uebermittlungsWegBadgeClass(nachricht.weg)} me-1">${uebermittlungsWegLabel(nachricht.weg)}</span>`
            : "",
        nachricht.meldeart
            ? `<span class="badge bg-light text-dark border me-1">${meldeartLabel(nachricht.meldeart)}</span>`
            : ""
    ].join("");
    const betreff = nachricht.betreff ? `<div class="fw-semibold">${escapeHtml(nachricht.betreff)}</div>` : "";
    const erwartung = nachricht.erwartung
        ? `<div class="small text-muted mt-1 fuehrungsstelle-erwartung">Erwartet: ${escapeHtml(nachricht.erwartung)}</div>`
        : "";
    return { kopf: `${badges}${betreff}`, fuss: erwartung };
}
