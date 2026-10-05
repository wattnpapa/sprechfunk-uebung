/**
 * „Zuletzt in diesem Browser erstellt“ auf der Startseite des Generators.
 *
 * Wer `/` in einem neuen Tab öffnet, fand seine eben erzeugte Übung nur über
 * den aufgehobenen Bearbeiten-Link oder die öffentliche Liste aller Übungen
 * (THW-Review 2026-10-05, workflow W6, new-user P3-5). Gemerkt werden nur
 * ID, Name, Übungscode und Zeitpunkt, und nur in diesem Browser.
 */

export const ZULETZT_SCHLUESSEL = "generatorZuletzt:v1";
export const ZULETZT_MAX = 5;

export interface ZuletztEintrag {
    id: string;
    name: string;
    uebungCode: string;
    erstelltAm: string;
}

type Speicher = Pick<Storage, "getItem" | "setItem">;

function speicher(): Speicher | null {
    try {
        return (globalThis as { localStorage?: Speicher }).localStorage ?? null;
    } catch {
        return null;
    }
}

function istEintrag(wert: unknown): wert is ZuletztEintrag {
    if (!wert || typeof wert !== "object") {
        return false;
    }
    const e = wert as Record<string, unknown>;
    return typeof e["id"] === "string" && e["id"] !== ""
        && typeof e["name"] === "string"
        && typeof e["uebungCode"] === "string"
        && typeof e["erstelltAm"] === "string";
}

export function ladeZuletzt(): ZuletztEintrag[] {
    try {
        const roh = speicher()?.getItem(ZULETZT_SCHLUESSEL);
        const liste: unknown = roh ? JSON.parse(roh) : [];
        return Array.isArray(liste) ? liste.filter(istEintrag).slice(0, ZULETZT_MAX) : [];
    } catch {
        return [];
    }
}

/** Neueste zuerst; eine schon gemerkte ID rückt nach oben statt doppelt zu stehen. */
export function merkeUebung(eintrag: ZuletztEintrag): void {
    const liste = [eintrag, ...ladeZuletzt().filter(e => e.id !== eintrag.id)].slice(0, ZULETZT_MAX);
    try {
        speicher()?.setItem(ZULETZT_SCHLUESSEL, JSON.stringify(liste));
    } catch {
        // Voll oder gesperrt: Die Liste ist nur eine Bequemlichkeit.
    }
}

function zeitText(iso: string): string {
    const datum = new Date(iso);
    return Number.isNaN(datum.getTime())
        ? ""
        : datum.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Zeichnet die Liste; auf einer geladenen Übung und ohne Einträge bleibt sie verborgen. */
export function renderZuletzt(sichtbar: boolean): void {
    const box = typeof document !== "undefined" && typeof document.getElementById === "function"
        ? document.getElementById("generatorZuletzt")
        : null;
    const liste = box?.querySelector("ul");
    if (!box || !liste) {
        return;
    }
    const eintraege = sichtbar ? ladeZuletzt() : [];
    liste.textContent = "";
    eintraege.forEach(eintrag => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#/generator/${encodeURIComponent(eintrag.id)}`;
        link.textContent = eintrag.name || "Übung ohne Namen";
        li.appendChild(link);
        const zusatz = [eintrag.uebungCode ? `Übungscode ${eintrag.uebungCode}` : "", zeitText(eintrag.erstelltAm)]
            .filter(Boolean)
            .join(" · ");
        if (zusatz) {
            li.appendChild(document.createTextNode(` – ${zusatz}`));
        }
        liste.appendChild(li);
    });
    box.hidden = eintraege.length === 0;
}
