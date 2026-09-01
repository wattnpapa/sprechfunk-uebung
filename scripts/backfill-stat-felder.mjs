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
 *
 * Altdokumente aus der Zeit vor den Zugangscodes besitzen weder `uebungCode`
 * noch `teilnehmerIds`. Beide sind in firestore.rules Pflichtfelder, und die
 * Regeln prüfen beim Update das komplette Dokument — ohne die Codes lehnt
 * Firestore jede Änderung an diesen Dokumenten ab, auch das reine Nachtragen
 * der stat*-Felder. Das Skript vergibt sie deshalb mit, nach denselben Regeln
 * wie GenerationService.ensureJoinCodes: gleiches Alphabet, Web-Crypto als
 * Zufallsquelle, Übungscode eindeutig gegenüber dem gesamten Bestand.
 */
import { webcrypto } from "node:crypto";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { firebaseConfig } from "../src/firebase-config.js";

const apply = process.argv.includes("--apply");

/** Muss mit GenerationService.SHORT_CODE_ALPHABET und den *_CODE_LENGTH-Konstanten übereinstimmen. */
const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const UEBUNG_CODE_LENGTH = 6;
const TEILNEHMER_CODE_LENGTH = 4;

function secureRandomIndex(obergrenze) {
    const maxGueltig = 256 - (256 % obergrenze);
    const puffer = new Uint8Array(1);
    for (;;) {
        webcrypto.getRandomValues(puffer);
        if (puffer[0] < maxGueltig) {
            return puffer[0] % obergrenze;
        }
    }
}

function generateShortCode(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += SHORT_CODE_ALPHABET[secureRandomIndex(SHORT_CODE_ALPHABET.length)];
    }
    return result;
}

function generateUniqueShortCode(length, vergeben) {
    let code = generateShortCode(length);
    while (vergeben.has(code)) {
        code = generateShortCode(length);
    }
    vergeben.add(code);
    return code;
}

function isValidShortCode(code, length) {
    return typeof code === "string" && code.length === length
        && [...code.toUpperCase()].every(zeichen => SHORT_CODE_ALPHABET.includes(zeichen));
}

/**
 * Fehlende Zugangscodes nachtragen. Vorhandene, gültige Codes bleiben
 * unangetastet; `alleUebungCodes` hält den Bestand für die Eindeutigkeit.
 */
function buildZugangscodes(data, alleUebungCodes) {
    const felder = {};
    if (!isValidShortCode(data.uebungCode, UEBUNG_CODE_LENGTH)) {
        felder.uebungCode = generateUniqueShortCode(UEBUNG_CODE_LENGTH, alleUebungCodes);
    }
    const teilnehmerListe = Array.isArray(data.teilnehmerListe) ? data.teilnehmerListe : [];
    const vorhanden = data.teilnehmerIds && typeof data.teilnehmerIds === "object" ? data.teilnehmerIds : {};
    const vollstaendig = teilnehmerListe.every(name =>
        Object.entries(vorhanden).some(([code, wert]) => wert === name && isValidShortCode(code, TEILNEHMER_CODE_LENGTH))
    );
    if (!("teilnehmerIds" in data) || !vollstaendig) {
        const benutzt = new Set();
        const next = {};
        for (const name of teilnehmerListe) {
            const wieder = Object.entries(vorhanden)
                .find(([code, wert]) => wert === name && isValidShortCode(code, TEILNEHMER_CODE_LENGTH))?.[0];
            const code = wieder && !benutzt.has(wieder)
                ? wieder
                : generateUniqueShortCode(TEILNEHMER_CODE_LENGTH, benutzt);
            benutzt.add(code);
            next[code] = name;
        }
        felder.teilnehmerIds = next;
    }
    return felder;
}

function extractDatum(rohwert) {
    if (!rohwert) {
        return undefined;
    }
    const datum = typeof rohwert.toDate === "function" ? rohwert.toDate() : new Date(rohwert);
    if (!(datum instanceof Date) || isNaN(datum.getTime())) {
        return undefined;
    }
    return datum;
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

    const datum = extractDatum(data.datum);
    if (datum !== undefined) {
        felder.statMonat = datum.getMonth();
        felder.statJahr = datum.getFullYear();
    }
    return felder;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const snapshot = await getDocs(collection(db, "uebungen"));
console.log(`${snapshot.size} Übungen gefunden.${apply ? "" : " Probelauf – es wird nichts geschrieben."}`);

let geschrieben = 0;
let uebersprungen = 0;
let mitCodes = 0;
const fehler = [];

const alleUebungCodes = new Set(
    snapshot.docs.map(d => d.data().uebungCode).filter(code => isValidShortCode(code, UEBUNG_CODE_LENGTH))
);

for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const zugangscodes = buildZugangscodes(data, alleUebungCodes);
    if (Object.keys(zugangscodes).length > 0) {
        mitCodes++;
    }
    const felder = { ...zugangscodes, ...buildStatistikFelder(data) };

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

console.log(`\nAktualisiert: ${geschrieben} (davon ${mitCodes} mit nachgetragenen Zugangscodes), `
    + `bereits aktuell: ${uebersprungen}, Fehler: ${fehler.length}`);
for (const f of fehler) {
    console.error(`  ${f.id}: ${f.message}`);
}

process.exit(fehler.length > 0 ? 1 : 0);
