

import { doc, getDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

function getUebungIdFromHash(): string | null {
    // Erwartet: #/uebungsleitung/<id>
    const hash = window.location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/");

    if (parts[0] !== "uebungsleitung") return null;
    return parts[1] ?? null;
}

export async function initUebungsleitung(db: Firestore): Promise<void> {
    const metaEl = document.getElementById("uebungsleitungMeta");
    if (!metaEl) return;

    const uebungId = getUebungIdFromHash()

    if (!uebungId) {
        metaEl.innerHTML = `<div class="alert alert-danger">Keine Übungs-ID angegeben.</div>`;
        return;
    }

    try {
        const ref = doc(db, "uebungen", uebungId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            metaEl.innerHTML = `<div class="alert alert-warning">Übung nicht gefunden.</div>`;
            return;
        }

        const u = snap.data();

        // Übungsdaten global verfügbar machen
        (window as any).__AKTUELLE_UEBUNG__ = u;

        console.log(u);

        metaEl.innerHTML = `
            <div class="row">
                <div class="col-md-6 mb-2">
                    <strong>Name der Übung:</strong><br>${u.name || "–"}
                </div>
                <div class="col-md-6 mb-2">
                    <strong>Datum:</strong><br>${formatDate(u.datum)}
                </div>
                <div class="col-md-6 mb-2">
                    <strong>Rufgruppe:</strong><br>${u.rufgruppe || "–"}
                </div>
                <div class="col-md-6 mb-2">
                    <strong>Übungsleitung:</strong><br>${u.leitung || "–"}
                </div>
                <div class="col-md-6 mb-2">
                    <strong>Anzahl Teilnehmer:</strong><br>${u.teilnehmerListe?.length ?? 0}
                </div>
                <div class="col-md-6 mb-2">
                    <strong>Übungs-ID:</strong><br><code>${uebungId}</code>
                </div>
            </div>
        `;

        // Teilnehmerliste rendern
        renderTeilnehmerListe(u.teilnehmerListe || []);

        const nachrichtenListe = buildNachrichtenliste(u);
        renderNachrichtenliste(nachrichtenListe);
    } catch (err) {
        console.error("❌ Fehler beim Laden der Übung:", err);
        metaEl.innerHTML = `<div class="alert alert-danger">Fehler beim Laden der Übung.</div>`;
    }
}

function formatDate(value: any): string {
    try {
        const d: Date = value?.toDate ? value.toDate() : new Date(value);

        const day = String(d.getUTCDate()).padStart(2, "0");
        const hours = String(d.getUTCHours()).padStart(2, "0");
        const minutes = String(d.getUTCMinutes()).padStart(2, "0");

        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const month = months[d.getUTCMonth()];

        const year = String(d.getUTCFullYear()).slice(-2);

        return `${day}${month}${year}`;
    } catch {
        return "–";
    }
}

// Teilnehmerliste für Übungsleitung anzeigen (Read-only)
function renderTeilnehmerListe(teilnehmer: any[]): void {
    const container = document.getElementById("uebungsleitungTeilnehmer");
    if (!container) return;

    if (!teilnehmer || teilnehmer.length === 0) {
        container.innerHTML = `<em>Keine Teilnehmer vorhanden.</em>`;
        return;
    }

    // Lösungswörter & Stärken kommen als Map-ähnliche Objekte aus der Übung
    const uebung: any = (window as any).__AKTUELLE_UEBUNG__ || {};
    const loesungswoerter = uebung.loesungswoerter || {};
    const loesungsstaerken = uebung.loesungsStaerken || {};

    const rows = teilnehmer.map((name: string, index: number) => {
        const loesungswort = loesungswoerter[name];
        const staerke = loesungsstaerken[name];

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${name}</td>
                <td>${loesungswort ? `<code>${loesungswort}</code>` : "–"}</td>
                <td>${staerke ?? "–"}</td>
            </tr>
        `;
    }).join("");

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-striped table-bordered">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Teilnehmer</th>
                        <th>Lösungswort</th>
                        <th>Stärke</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

interface UebungsNachricht {
    nr: number;
    empfaenger: string[];
    sender: string;
    text: string;
    zeit?: string;
}

function buildNachrichtenliste(uebung: any): UebungsNachricht[] {
    const result: UebungsNachricht[] = [];
    const nachrichten = uebung.nachrichten || {};

    Object.entries(nachrichten).forEach(([sender, msgs]: any) => {
        (msgs as any[]).forEach((msg: any, index: number) => {
            result.push({
                nr: msg.id ?? index + 1,
                sender: sender,
                empfaenger: Array.isArray(msg.empfaenger)
                    ? msg.empfaenger
                    : msg.empfaenger
                        ? [msg.empfaenger]
                        : ["–"],
                text: msg.nachricht ?? "",
                zeit: msg.zeit ?? ""
            });
        });
    });

    result.sort((a, b) => a.nr - b.nr);
    return result;
}

function renderNachrichtenliste(nachrichten: UebungsNachricht[]): void {
    const container = document.getElementById("uebungsleitungNachrichten");
    if (!container) return;

    if (!nachrichten.length) {
        container.innerHTML = `<em>Keine Nachrichten vorhanden.</em>`;
        return;
    }

    console.log(nachrichten);

    const rows = nachrichten.map(n => `
        <tr>
            <td>${n.nr}</td>
            <td>${n.empfaenger.map(e => `<div>${e}</div>`).join("")}</td>
            <td>${n.sender}</td>
            <td class="nachricht-text">${escapeHtml(n.text).replace(/\\n/g, "<br>")}</td>
            <td>${n.zeit ?? ""}</td>
        </tr>
    `).join("");

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-bordered table-striped">
                <thead>
                    <tr>
                        <th>Nr</th>
                        <th>Empfänger</th>
                        <th>Sender</th>
                        <th>Nachricht</th>
                        <th>Zeit</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}