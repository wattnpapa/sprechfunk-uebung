import type { LiveSyncState } from "../types/LiveStatus";
import { escapeHtml } from "../utils/html";
import { faelligkeitLabel, formatUhrzeit, type Faelligkeit, type LageTeilnehmer } from "./lagebild";
import { hhmmAus } from "./markup";
import { reaktionsBilanzText, type ReaktionsBilanz } from "./reaktion";

export interface LageAnzeige {
    teilnehmer: LageTeilnehmer[];
    naechste: { planNr: number; absNr?: number; sender: string; empfaenger: string[]; faelligkeit?: Faelligkeit }[];
    /** Vom Teilnehmer gemeldet, von der Leitung noch nicht bestätigt. */
    zuBestaetigen: number;
    hideAbgesetzt: boolean;
    ueberfaellig: number;
    /** Offen, Soll-Zeit gerade erreicht (noch im Fälligkeitsfenster). */
    faellig?: number;
    /** Führungsstellen-Übung: Reaktionen der beübten Stelle. */
    reaktionen?: ReaktionsBilanz | null;
    /** Verbindung dieses Leitungs-Arbeitsplatzes – sichtbar oben statt nur im Plan-Kopf. */
    verbindung?: { state: LiveSyncState; offen: number; letzteBestaetigungUm?: string };
    /** Gesetzte Status, die älter sind als die aktuelle Fassung der Übung. */
    veraltet?: { anzahl: number; fassungVom: string } | null;
    jetztMs?: number;
}

function teilnehmerChips(teilnehmer: LageTeilnehmer[]): string {
    if (!teilnehmer.length) {
        return "<span class=\"text-body-secondary\">Keine Nachrichten.</span>";
    }
    return teilnehmer.map(t => {
        const css = t.offen === 0 ? "lage-chip lage-chip--fertig" : "lage-chip";
        const bestaetigen = t.nurGemeldet > 0 ? `, ${t.nurGemeldet} zu bestätigen` : "";
        return `<span class="${css}" title="${escapeHtml(t.teilnehmer)}: ${t.offen} von ${t.gesamt} offen${bestaetigen}">${escapeHtml(t.teilnehmer)}: <strong>${t.offen === 0 ? "fertig" : `${t.offen} offen`}</strong>${bestaetigen}</span>`;
    }).join("");
}

function naechsteKnoepfe(naechste: LageAnzeige["naechste"]): string {
    if (!naechste.length) {
        return "<span class=\"text-body-secondary\">Alles erledigt.</span>";
    }
    return naechste.map(n => {
        const f = n.faelligkeit;
        const zeit = f ? ` · ${formatUhrzeit(f.sollMs)} · ${faelligkeitLabel(f)}` : "";
        // Die Nummer beim Absender mitnennen: Sie sagt der Teilnehmer am Funk
        // (THW-Review 2026-10-05, new-user P3-2).
        const abs = n.absNr !== undefined ? ` (Abs.-Nr. ${n.absNr})` : "";
        const css = f?.zustand === "ueberfaellig" ? "btn-outline-danger" : "btn-outline-secondary";
        return `<button type="button" class="btn btn-sm ${css} lage-naechste" data-action="zu-plan-nr" data-plan-nr="${n.planNr}" title="Nr. im Plan; Abs.-Nr. ist die Nummer beim Absender, die er am Funk nennt">Nr. ${n.planNr} · ${escapeHtml(n.sender)}${abs} → ${escapeHtml(n.empfaenger.join(", "))}${zeit}</button>`;
    }).join("");
}

function verbindungsHinweis(verbindung: LageAnzeige["verbindung"]): string {
    if (!verbindung || (verbindung.state !== "offline" && verbindung.state !== "fehler")) {
        return "";
    }
    const bestaetigt = verbindung.letzteBestaetigungUm
        ? ` Zuletzt vom Server bestätigt: ${hhmmAus(verbindung.letzteBestaetigungUm)}.`
        : "";
    const offen = verbindung.offen > 0 ? ` ${verbindung.offen} Änderung${verbindung.offen === 1 ? "" : "en"} warten.` : "";
    const text = verbindung.state === "offline"
        ? `Keine Verbindung – angezeigt wird der zuletzt bekannte Stand der Teilnehmer. Deine Markierungen bleiben auf diesem Gerät und werden nachgereicht.${offen}${bestaetigt}`
        : `Der Server lehnt Änderungen ab – sie werden nicht übertragen. Halte den Stand auf Papier fest.${bestaetigt}`;
    return `<div class="ul-hinweis ul-hinweis--warn mb-2" role="status" data-testid="lage-verbindung">⚠ ${escapeHtml(text)}</div>`;
}

function veraltetHinweis(veraltet: LageAnzeige["veraltet"]): string {
    if (!veraltet || veraltet.anzahl <= 0) {
        return "";
    }
    return `<div class="ul-hinweis ul-hinweis--alarm mb-2" role="alert" data-testid="lage-veraltet">
            ⚠ Diese Übung wurde am ${escapeHtml(veraltet.fassungVom)} neu verteilt. ${veraltet.anzahl} gesetzte Status gehören zur alten Fassung und passen nicht mehr zu den Texten.
            Sichere den Stand bei Bedarf als PDF und setze ihn dann zurück.
            <button type="button" class="btn btn-sm btn-outline-danger ms-1" data-action="zu-zuruecksetzen">Zum Zurücksetzen</button>
          </div>`;
}

function reaktionsZeile(reaktionen: ReaktionsBilanz | null | undefined, jetztMs: number): string {
    if (!reaktionen) {
        return "";
    }
    const seit = reaktionen.aeltesteAusstehendSeit ? Date.parse(reaktionen.aeltesteAusstehendSeit) : NaN;
    const alter = Number.isFinite(seit) ? ` (älteste ausstehend seit ${Math.max(0, Math.floor((jetztMs - seit) / 60000))} min)` : "";
    return `<div class="d-flex flex-wrap align-items-center gap-2 mb-2" data-testid="lage-reaktionen">
            <strong class="me-1">Beübte Stelle – Reaktionen:</strong>
            <span>${escapeHtml(reaktionsBilanzText(reaktionen))}${alter}</span>
          </div>`;
}

function rueckstandKnopf(lage: LageAnzeige): string {
    const faellig = lage.faellig ?? 0;
    if (lage.ueberfaellig <= 0 && faellig <= 0) {
        return "";
    }
    const teile = [
        lage.ueberfaellig > 0 ? `${lage.ueberfaellig} überfällig` : "",
        faellig > 0 ? `${faellig} jetzt fällig` : ""
    ].filter(Boolean).join(", ");
    const ziel = lage.ueberfaellig > 0 ? "ueberfaellig" : "faellig";
    const css = lage.ueberfaellig > 0 ? "btn-danger" : "btn-warning";
    return `<button type="button" class="btn btn-sm ${css}" data-action="zu-ueberfaellig" data-ziel="${ziel}" title="Zusammen ergibt das die Zahl „hinter Plan“ im Cockpit">${teile} – zur ersten</button>`;
}

function bestaetigenTeil(zuBestaetigen: number): string {
    if (zuBestaetigen <= 0) {
        return "";
    }
    return `<button type="button" class="btn btn-sm btn-outline-primary" data-action="gemeldete-bestaetigen" title="Übernimmt alle vom Teilnehmer gemeldeten Nachrichten mit der Uhrzeit, zu der der Teilnehmer getippt hat">${zuBestaetigen} gemeldete bestätigen (mit Meldezeit des Teilnehmers)</button>
            <small class="text-body-secondary w-100">„Gemeldet“ heißt: der Teilnehmer hat abgehakt. Bestätige, wenn du den Spruch gehört hast. Die Sammelbestätigung übernimmt seine Tippzeit, nicht die Zeit vom Papier.</small>`;
}

/**
 * Lagezeile oben: Verbindung, offen je Teilnehmer, was als Nächstes dran ist,
 * Rückstand und die Wege zu Filter und Auswertung (THW-Review command P1-3).
 */
export function renderLageHtml(lage: LageAnzeige): string {
    const jetztMs = lage.jetztMs ?? Date.now();
    return `
          ${verbindungsHinweis(lage.verbindung)}
          ${veraltetHinweis(lage.veraltet)}
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <strong class="me-1">Lage:</strong>
            ${teilnehmerChips(lage.teilnehmer)}
          </div>
          ${reaktionsZeile(lage.reaktionen, jetztMs)}
          <div class="d-flex flex-wrap align-items-center gap-2">
            <strong class="me-1">Als Nächstes:</strong>
            ${naechsteKnoepfe(lage.naechste)}
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
            ${rueckstandKnopf(lage)}
            ${bestaetigenTeil(lage.zuBestaetigen)}
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="lage-hide" aria-pressed="${lage.hideAbgesetzt}">${lage.hideAbgesetzt ? "Abgesetzte wieder zeigen" : "Abgesetzte ausblenden"}</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="zu-auswertung">Heatmap &amp; Timeline</button>
          </div>`;
}
