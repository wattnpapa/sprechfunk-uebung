import { escapeHtml } from "../utils/html";
import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import { formatCountdown, parseHHMMtoMs } from "../utils/xzeit";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";
import { nachrichtHtml, renderArtBadge } from "./teilnehmerFormat";

/** Anzeigezustand der Fokus-Karte im getakteten Modus. */
export interface FokusZustand {
    kind: "keineBasis" | "fertig" | "faellig" | "warten";
    aktuelle?: Nachricht & { xZeitSlot: number };
    weitereFaellig: number;
    offen: number;
    countdownMs: number;
    /** Zuletzt abgesetzte Meldung, damit sie sich zurücknehmen lässt. */
    zuletztAbgesetzt?: number;
    /** Minuten seit Fälligkeit der ältesten offenen Meldung (nur „faellig“). */
    rueckstandMin?: number;
}

/** Die zuletzt als abgesetzt markierte Nachricht (nach Zeitstempel). */
function findeZuletztAbgesetzt(nachrichten: Nachricht[], storage: TeilnehmerStorage): number | undefined {
    let beste: { id: number; um: string } | undefined;
    for (const n of nachrichten) {
        const eintrag = storage.nachrichten[n.id];
        if (!eintrag?.uebertragen) {
            continue;
        }
        const um = eintrag.uebertragenUm ?? "";
        if (!beste || um > beste.um) {
            beste = { id: n.id, um };
        }
    }
    return beste?.id;
}

function buildFokusZustandOhneVerlauf(
    nachrichten: Nachricht[],
    storage: TeilnehmerStorage,
    xZeitBasis: string | undefined
): FokusZustand {
    const offen = nachrichten
        .filter((n): n is Nachricht & { xZeitSlot: number } =>
            n.xZeitSlot !== undefined && !storage.nachrichten[n.id]?.uebertragen)
        .sort((a, b) => a.xZeitSlot - b.xZeitSlot);

    if (!offen.length) {
        return { kind: "fertig", weitereFaellig: 0, offen: 0, countdownMs: 0 };
    }

    const basisMs = xZeitBasis ? parseHHMMtoMs(xZeitBasis) : null;
    if (basisMs === null) {
        // Vorschau auf den ersten Spruch: Empfänger und Zeitpunkt, nicht der Text.
        const erste = offen[0];
        return { kind: "keineBasis", ...(erste ? { aktuelle: erste } : {}), weitereFaellig: 0, offen: offen.length, countdownMs: 0 };
    }

    const now = Date.now();
    const faellig = offen.filter(n => basisMs + n.xZeitSlot * 60000 <= now);
    if (faellig.length && faellig[0]) {
        return {
            kind: "faellig",
            aktuelle: faellig[0],
            weitereFaellig: faellig.length - 1,
            offen: offen.length,
            countdownMs: 0,
            rueckstandMin: Math.floor((now - (basisMs + faellig[0].xZeitSlot * 60000)) / 60000)
        };
    }

    const naechste = offen[0];
    if (!naechste) {
        return { kind: "fertig", weitereFaellig: 0, offen: 0, countdownMs: 0 };
    }
    return {
        kind: "warten",
        aktuelle: naechste,
        weitereFaellig: 0,
        offen: offen.length,
        countdownMs: basisMs + naechste.xZeitSlot * 60000 - now
    };
}

export function buildFokusZustand(
    nachrichten: Nachricht[],
    storage: TeilnehmerStorage,
    xZeitBasis: string | undefined
): FokusZustand {
    const zustand = buildFokusZustandOhneVerlauf(nachrichten, storage, xZeitBasis);
    const zuletzt = findeZuletztAbgesetzt(nachrichten, storage);
    return zuletzt !== undefined ? { ...zustand, zuletztAbgesetzt: zuletzt } : zustand;
}

/** Merkmal, an dem sich ein Zustandswechsel der Fokus-Karte erkennen lässt. */
export function fokusSignatur(zustand: FokusZustand): string {
    return [
        zustand.kind,
        zustand.aktuelle?.id ?? "",
        zustand.weitereFaellig,
        zustand.offen,
        zustand.zuletztAbgesetzt ?? "",
        zustand.rueckstandMin ?? ""
    ].join("|");
}

/** Zeile „Zuletzt abgesetzt: Meldung N – Zurücknehmen“ unter der Fokus-Karte. */
function renderFokusZuletzt(zustand: FokusZustand): string {
    if (zustand.zuletztAbgesetzt === undefined) {
        return "";
    }
    const id = zustand.zuletztAbgesetzt;
    return `
                        <div class="teilnehmer-fokus-zuletzt">
                            <span class="small text-muted">Zuletzt abgesetzt: Meldung ${id}</span>
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-fokus-zuruecknehmen="${id}">Zurücknehmen</button>
                        </div>`;
}

/**
 * Vor dem Start: ein einziger Satz statt widersprüchlicher Anweisungen, dazu
 * an wen der erste Spruch geht – ohne Abhak-Knopf (field-user P2, 2026-10-05).
 */
function keineBasisHtml(zustand: FokusZustand): string {
    const n = zustand.aktuelle;
    const vorschau = n
        ? `<div class="mt-2">Dein erster Spruch: <strong>Nr. ${n.id}</strong> an ${escapeHtml(n.empfaenger.join(", "))}, ${n.xZeitSlot} min nach der X-Zeit.</div>`
        : "";
    return `
                <div class="card mb-3">
                    <div class="card-body text-center py-3">
                        <div class="text-muted">Noch keine X-Zeit – die Übungsleitung setzt sie, dann geht es hier los.</div>
                        ${vorschau}
                    </div>
                </div>`;
}

function fertigHtml(zuletzt: string): string {
    return `
                <div class="card border-success mb-3">
                    <div class="card-body text-center py-4">
                        <span class="fs-5">✅ Alle Meldungen abgesetzt.</span>
                        ${zuletzt}
                    </div>
                </div>`;
}

function wartenHtml(zustand: FokusZustand, n: Nachricht & { xZeitSlot: number }, zuletzt: string): string {
    return `
                <div class="card mb-3">
                    <div class="card-body text-center py-4">
                        <div class="text-muted">Nächste Meldung in</div>
                        <div class="display-5 font-monospace" id="fokusCountdown">${formatCountdown(zustand.countdownMs)}</div>
                        <div class="text-muted small mt-1">Nr. ${n.id} bei X+${n.xZeitSlot} min · noch ${zustand.offen} offen</div>
                        ${zuletzt}
                    </div>
                </div>`;
}

/**
 * Rückstand in der Fokus-Karte: eigene Warnfarbe mit Symbol und Rahmen.
 * `text-warning-emphasis` war im Dark Mode kaum lesbar (night-visibility
 * Befund 1, 2026-10-05).
 */
function rueckstandHtml(zustand: FokusZustand): string {
    const teile: string[] = [];
    if (zustand.weitereFaellig > 0) {
        teile.push(zustand.weitereFaellig === 1 ? "1 weitere Meldung fällig" : `${zustand.weitereFaellig} weitere Meldungen fällig`);
    }
    if ((zustand.rueckstandMin ?? 0) >= 1) {
        teile.push(`diese seit ${zustand.rueckstandMin} min`);
    }
    if (teile.length === 0) {
        return "";
    }
    return `<div class="teilnehmer-fokus-rueckstand mt-2"><span aria-hidden="true">⚠</span> ${teile.join(", ")}</div>`;
}

function faelligHtml(zustand: FokusZustand, n: Nachricht & { xZeitSlot: number }, zuletzt: string): string {
    const hinweise = renderFuehrungsstellenHinweise(n);
    const weitere = rueckstandHtml(zustand);
    return `
                <div class="card border-primary mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <span class="badge bg-primary">Meldung ${n.id} fällig · X+${n.xZeitSlot}</span>
                            <span class="text-muted small">noch ${zustand.offen} offen</span>
                        </div>
                        <div class="text-muted small mt-2">an: ${escapeHtml(n.empfaenger.join(", "))}</div>
                        <div class="fs-5 mt-1 mb-3">${renderArtBadge(n)}${hinweise.kopf}${nachrichtHtml(n.nachricht)}${hinweise.fuss}</div>
                        <button class="btn btn-primary btn-lg w-100 teilnehmer-fokus-absetzen" data-fokus-uebertragen="${n.id}">
                            Als abgesetzt markieren
                        </button>
                        ${weitere}
                        ${zuletzt}
                    </div>
                </div>`;
}

export function renderFokusHtml(zustand: FokusZustand): string {
    const zuletzt = renderFokusZuletzt(zustand);
    if (zustand.kind === "keineBasis") {
        return keineBasisHtml(zustand);
    }
    if (zustand.kind === "fertig") {
        return fertigHtml(zuletzt);
    }
    if (zustand.kind === "warten" && zustand.aktuelle) {
        return wartenHtml(zustand, zustand.aktuelle, zuletzt);
    }
    if (zustand.kind === "faellig" && zustand.aktuelle) {
        return faelligHtml(zustand, zustand.aktuelle, zuletzt);
    }
    return "";
}
