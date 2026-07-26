/**
 * Einmaliges Backfill der denormalisierten stat*-Felder.
 *
 * Seit der Umstellung von `getAdminStats()` auf Aggregations-Queries werden die
 * Kennzahlen des Admin-Dashboards aus Feldern gelesen, die beim Speichern einer
 * Übung mitgeschrieben werden. Dokumente aus der Zeit davor besitzen diese
 * Felder nicht und fehlen deshalb in den Summen und im Monatsdiagramm.
 *
 * Aufruf (benötigt src/firebase-config.js mit echten Zugangsdaten):
 *   node scripts/backfill-stat-felder.mjs            # Probelauf, schreibt nichts
 *   node scripts/backfill-stat-felder.mjs --apply    # schreibt die Felder
 *
 * Das Skript liest die Collection einmal komplett — das ist der Vollscan, den
 * die Anwendung im Normalbetrieb gerade vermeidet. Genau dafür läuft es einmalig
 * und nicht bei jedem Seitenaufruf.
 */
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { firebaseConfig } from "../src/firebase-config.js";

const apply = process.argv.includes("--apply");

function extractMonat(rohwert) {
    if (!rohwert) {
        return undefined;
    }
    const datum = typeof rohwert.toDate === "function" ? rohwert.toDate() : new Date(rohwert);
    if (!(datum instanceof Date) || isNaN(datum.getTime())) {
        return undefined;
    }
    return datum.getMonth();
}

function hatEintraege(wert) {
    return Boolean(wert) && typeof wert === "object" && Object.keys(wert).length > 0;
}

/** Muss mit FirebaseService.buildStatistikFelder übereinstimmen. */
function buildStatistikFelder(data) {
    const teilnehmerListe = Array.isArray(data.teilnehmerListe) ? data.teilnehmerListe : [];
    const nachrichten = data.nachrichten || {};

    let nachrichtenAnzahl = 0;
    for (const msgs of Object.values(nachrichten)) {
        if (Array.isArray(msgs)) {
            nachrichtenAnzahl += msgs.length;
        }
    }

    const felder = {
        statTeilnehmerAnzahl: teilnehmerListe.length,
        statNachrichtenAnzahl: nachrichtenAnzahl,
        statBytes: JSON.stringify(data).length,
        statHatLoesungswoerter: hatEintraege(data.loesungswoerter),
        statHatLoesungsStaerken: hatEintraege(data.loesungsStaerken),
        statHatBuchstabieren: Number(data.buchstabierenAn || 0) > 0
    };

    const monat = extractMonat(data.datum);
    if (monat !== undefined) {
        felder.statMonat = monat;
    }
    return felder;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const snapshot = await getDocs(collection(db, "uebungen"));
console.log(`${snapshot.size} Übungen gefunden.${apply ? "" : " Probelauf – es wird nichts geschrieben."}`);

let geschrieben = 0;
let uebersprungen = 0;
const fehler = [];

for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const felder = buildStatistikFelder(data);

    const bereitsVollstaendig = Object.entries(felder).every(([key, wert]) => data[key] === wert);
    if (bereitsVollstaendig) {
        uebersprungen++;
        continue;
    }

    if (!apply) {
        console.log(`  ${docSnap.id}: ${JSON.stringify(felder)}`);
        geschrieben++;
        continue;
    }

    try {
        await updateDoc(doc(db, "uebungen", docSnap.id), felder);
        geschrieben++;
    } catch (error) {
        // Häufigster Grund: Das Altdokument verletzt die Strukturprüfung aus
        // firestore.rules (unbekanntes Feld, falscher Typ). Dann muss das
        // Dokument von Hand bereinigt oder gelöscht werden.
        fehler.push({ id: docSnap.id, message: error?.message ?? String(error) });
    }
}

console.log(`\nAktualisiert: ${geschrieben}, bereits aktuell: ${uebersprungen}, Fehler: ${fehler.length}`);
for (const f of fehler) {
    console.error(`  ${f.id}: ${f.message}`);
}

process.exit(fehler.length > 0 ? 1 : 0);
