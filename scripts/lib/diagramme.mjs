// Die Diagramme der Inhaltsseiten (AP-10).
//
// Je Seiten-Slug ein Eintrag. `alt` beschreibt, was zu sehen ist – nicht das
// Zielkeyword: „Aufbau eines Funkrufnamens aus Kennwort, Ort und Kennzahlen“
// statt „Funkrufnamen BOS Funk Generator“. Ein Alternativtext ist für Menschen
// da, die das Bild nicht sehen, nicht für Suchmaschinen.
//
// Inhalte sind bewusst knapp: ein Diagramm, das einen Absatz ersetzt, hilft.
// Ein Diagramm, das einen Absatz wiederholt, ist Ballast.

import { aufbau, gegenueber, kette, svg, text, zeitachse } from "./svg-diagramm.mjs";

/** Sichtlinie mit Hindernis – eigenes Layout, weil kein Primitiv passt. */
function sichtlinie() {
    const breite = 560;
    const hoehe = 190;
    const boden = 150;
    return {
        breite,
        hoehe,
        inhalt: [
            `<line x1="70" y1="${boden}" x2="70" y2="70" class="d-arrow"/>`,
            `<line x1="490" y1="${boden}" x2="490" y2="70" class="d-arrow"/>`,
            text(70, boden + 22, "Funkstelle A", { klasse: "d-caption", maxZeichen: 16 }),
            text(490, boden + 22, "Funkstelle B", { klasse: "d-caption", maxZeichen: 16 }),
            `<rect x="250" y="95" width="60" height="${boden - 95}" rx="4" class="d-box d-box-betont"/>`,
            text(280, boden + 22, "Hügel", { klasse: "d-caption", maxZeichen: 12 }),
            `<line x1="70" y1="70" x2="490" y2="70" class="d-arrow" stroke-dasharray="6 4"/>`,
            text(280, 56, "Sichtverbindung: Funk kommt an", { klasse: "d-caption", maxZeichen: 34 }),
            `<line x1="70" y1="120" x2="248" y2="120" class="d-arrow"/>`,
            text(160, 136, "verdeckt: kein Funk", { klasse: "d-caption", maxZeichen: 22 }),
            `<line x1="0" y1="${boden}" x2="${breite}" y2="${boden}" class="d-tick"/>`
        ].join("\n    ")
    };
}

/** Kennzahlen einer Funkspruch-Vorlage als beschrifteter Aufbau. */
const vorlagenProfil = (anzahl, laenge, schwerpunkt) => () => aufbau([
    { wert: String(anzahl), bedeutung: "Nachrichten" },
    { wert: `${laenge} Z.`, bedeutung: "mittlere Länge" },
    { wert: schwerpunkt, bedeutung: "Schwerpunkt", betont: true }
]);

/**
 * Die Diagramme. `bauen` liefert { inhalt, breite, hoehe }; das umschließende
 * SVG samt <title>/<desc> baut renderDiagramm() unten.
 */
export const DIAGRAMME = {
    "anleitung": {
        titel: "Sechs Schritte zur fertigen Übung",
        beschreibung: "Ablauf im Generator: Kopfdaten, Teilnehmer, Nachrichten-Einstellungen, Quelle der Funksprüche, Lösungswörter, Erzeugen.",
        alt: "Ablaufkette mit sechs Schritten von den Kopfdaten über Teilnehmer, Einstellungen, Vorlage und Lösungswörter bis zum Erzeugen der Übung",
        bauen: () => kette([
            "Kopfdaten", "Teilnehmer", "Einstellungen", "Vorlage", "Lösungswörter",
            { text: "Erzeugen", betont: true }
        ])
    },
    "funktionen": {
        titel: "Vom Teilnehmer zur Live-Übung",
        beschreibung: "Aus der Teilnehmerliste entsteht die Nachrichtenverteilung, daraus die Vordrucke und die Live-Übungsleitung.",
        alt: "Kette von der Teilnehmerliste über die Nachrichtenverteilung zu Vordrucken und Live-Übungsleitung",
        bauen: () => kette([
            "Teilnehmerliste", "Verteilung", "Vordrucke als PDF",
            { text: "Live-Übungsleitung", betont: true }
        ])
    },
    "buchstabiertafel": {
        titel: "Buchstabieren eines Namens",
        beschreibung: "Der Name MÜLLER wird Buchstabe für Buchstabe mit den Wörtern der Tafel gesprochen.",
        alt: "Der Name MÜLLER, darunter je Buchstabe das zugehörige Wort der Buchstabiertafel: Martha, Übermut, Ludwig, Ludwig, Emil, Richard",
        bauen: () => aufbau([
            { wert: "M", bedeutung: "Martha" },
            { wert: "Ü", bedeutung: "Übermut" },
            { wert: "L", bedeutung: "Ludwig" },
            { wert: "L", bedeutung: "Ludwig" },
            { wert: "E", bedeutung: "Emil" },
            { wert: "R", bedeutung: "Richard" }
        ])
    },
    "meldevordruck": {
        titel: "Felder des Meldevordrucks",
        beschreibung: "Ein Meldevordruck nimmt Nummer, Absender, Empfänger, Uhrzeit und den Nachrichtentext auf.",
        alt: "Fünf Felder des Meldevordrucks nebeneinander: Nummer, Absender, Empfänger, Uhrzeit und Nachrichtentext",
        bauen: () => aufbau([
            { wert: "Nr.", bedeutung: "laufende Nummer" },
            { wert: "Von", bedeutung: "Absender" },
            { wert: "An", bedeutung: "Empfänger" },
            { wert: "Zeit", bedeutung: "Uhrzeit" },
            { wert: "Text", bedeutung: "Nachricht", betont: true }
        ])
    },
    "funksprueche": {
        titel: "Vom Archiv in die eigene Übung",
        beschreibung: "Im Archiv suchen, die Vorlage als Textdatei herunterladen, im Generator hochladen, Übung erzeugen.",
        alt: "Kette in vier Schritten: im Archiv suchen, Textdatei herunterladen, im Generator hochladen, Übung erzeugen",
        bauen: () => kette([
            "Im Archiv suchen", "Textdatei laden", "Im Generator hochladen",
            { text: "Übung erzeugen", betont: true }
        ])
    },
    "funksprueche/vorlage/grundausbildung-einfach": {
        titel: "Profil der Vorlage Grundausbildung",
        beschreibung: "462 Nachrichten, im Schnitt kurz, Schwerpunkt auf dem Verfahren statt auf dem Inhalt.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 462 Nachrichten, im Schnitt 45 Zeichen lang und mit Schwerpunkt Verfahren",
        bauen: vorlagenProfil(462, 45, "Verfahren")
    },
    "funksprueche/vorlage/thw-essen": {
        titel: "Profil der Vorlage THW Essen",
        beschreibung: "92 Nachrichten mittlerer Länge, Schwerpunkt auf Erkundungsaufträgen mit Rückmeldung.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 92 Nachrichten, im Schnitt 131 Zeichen lang und mit Schwerpunkt Erkundung",
        bauen: vorlagenProfil(92, 131, "Erkundung")
    },
    "funksprueche/vorlage/thw-leer": {
        titel: "Profil der Vorlage THW Leer",
        beschreibung: "118 Nachrichten aus einer Flächenlage mit vielen kleinen Einsatzstellen.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 118 Nachrichten, im Schnitt 120 Zeichen lang und mit Schwerpunkt Flächenlage",
        bauen: vorlagenProfil(118, 120, "Flächenlage")
    },
    "funksprueche/vorlage/thw-lehrte": {
        titel: "Profil der Vorlage THW Lehrte",
        beschreibung: "752 Nachrichten, die längsten im Archiv, Schwerpunkt auf einer großen Unwetterlage.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 752 Nachrichten, im Schnitt 127 Zeichen lang und mit Schwerpunkt Unwetter",
        bauen: vorlagenProfil(752, 127, "Unwetter")
    },
    "funksprueche/vorlage/thw-melle": {
        titel: "Profil der Vorlage THW Melle",
        beschreibung: "400 Nachrichten mit hoher Fachdichte, Schwerpunkt auf der Arbeit einer Führungsstelle.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 400 Nachrichten, im Schnitt 110 Zeichen lang und mit Schwerpunkt Stabsrahmen",
        bauen: vorlagenProfil(400, 110, "Stabsrahmen")
    },
    "funksprueche/vorlage/thw-saarstedt": {
        titel: "Profil der Vorlage THW Saarstedt",
        beschreibung: "200 kurze Nachrichten mit Namen in Großbuchstaben, Schwerpunkt auf dem Buchstabieren.",
        alt: "Drei beschriftete Felder nebeneinander mit den Kennzahlen der Vorlage: 200 Nachrichten, im Schnitt 62 Zeichen lang und mit Schwerpunkt Buchstabieren",
        bauen: vorlagenProfil(200, 62, "Buchstabieren")
    },
    "funkuebung-feuerwehr": {
        titel: "Übung für die Feuerwehr vorbereiten",
        beschreibung: "Florian-Rufnamen eintragen, Umfang festlegen, Vorlage wählen, Druckunterlagen erzeugen.",
        alt: "Vier Schritte: Florian-Rufnamen eintragen, Umfang festlegen, Vorlage wählen, Druckunterlagen erzeugen",
        bauen: () => kette([
            "Florian-Rufnamen", "Umfang festlegen", "Vorlage wählen",
            { text: "Unterlagen drucken", betont: true }
        ])
    },
    "funkuebung-thw": {
        titel: "Übung für den Ortsverband vorbereiten",
        beschreibung: "HEROS-Rufnamen eintragen, Vorlage eines Ortsverbands wählen, Unterlagen erzeugen.",
        alt: "Vier Schritte: HEROS-Rufnamen eintragen, Umfang festlegen, Ortsverbands-Vorlage wählen, Unterlagen erzeugen",
        bauen: () => kette([
            "HEROS-Rufnamen", "Umfang festlegen", "OV-Vorlage wählen",
            { text: "Unterlagen drucken", betont: true }
        ])
    },
    "funkuebung-katastrophenschutz": {
        titel: "Getrennt üben oder gemeinsam",
        beschreibung: "Im Einsatz arbeiten mehrere Organisationen auf einer Rufgruppe, geübt wird meist getrennt.",
        alt: "Zwei Spalten im Vergleich: getrennte Übung je Organisation gegenüber gemeinsamer Übung auf einer Rufgruppe",
        bauen: () => gegenueber(
            { titel: "Getrennt geübt", punkte: ["je Organisation eigene Übung", "eigene Rufnamen", "keine Abstimmung nötig"] },
            { titel: "Gemeinsam geübt", punkte: ["eine Rufgruppe", "fremde Rufnamen im Verkehr", "Meldewege werden sichtbar"] }
        )
    },
    "funkuebung-dienstabend": {
        titel: "Ablauf eines Übungsabends",
        beschreibung: "Neunzig Minuten von der Einweisung über die Anmeldung und den Übungsbetrieb bis zur Nachbesprechung.",
        alt: "Zeitachse über 90 Minuten mit Einweisung, Anmeldung der Funkstellen, Übungsbetrieb und Nachbesprechung",
        bauen: () => ({
            breite: 560,
            hoehe: 90,
            inhalt: zeitachse(20, 40, 500, [
                { anteil: 0, label: "Einweisung" },
                { anteil: 0.17, label: "Anmeldung" },
                { anteil: 0.4, label: "Betrieb" },
                { anteil: 0.85, label: "Nachbesprechung" }
            ])
        })
    },
    "funkuebung-vorlage": {
        titel: "Starre Vorlage gegen erzeugte Übung",
        beschreibung: "Eine feste PDF-Vorlage enthält immer dieselben Texte, der Generator verteilt jedes Mal neu.",
        alt: "Zwei Spalten im Vergleich: feste PDF-Vorlage mit unveränderten Texten gegenüber jedes Mal neu erzeugter Übung",
        bauen: () => gegenueber(
            { titel: "Feste PDF-Vorlage", punkte: ["immer dieselben Texte", "feste Teilnehmerzahl", "nach drei Einsätzen bekannt"] },
            { titel: "Erzeugte Übung", punkte: ["Texte neu verteilt", "beliebige Teilnehmerzahl", "eigene Rufnamen"] }
        )
    },
    "funkuebung-planen": {
        titel: "Von der Zielsetzung zur Nachbesprechung",
        beschreibung: "Übungsziel festlegen, Teilnehmer sammeln, Nachrichtenplan erzeugen, Übung nachbesprechen.",
        alt: "Vier Schritte: Übungsziel festlegen, Teilnehmer sammeln, Nachrichtenplan erzeugen, Übung nachbesprechen",
        bauen: () => kette([
            "Übungsziel", "Teilnehmer", "Nachrichtenplan",
            { text: "Nachbesprechung", betont: true }
        ])
    },
    "funkuebung-szenarien": {
        titel: "Flächenlage gegen Einsatzlage",
        beschreibung: "Eine Flächenlage hat viele Einsatzstellen mit je wenigen Meldungen, eine Einsatzlage eine Stelle mit vielen.",
        alt: "Zwei Spalten im Vergleich: Flächenlage mit vielen Einsatzstellen gegenüber Einsatzlage mit einer Stelle und vielen Meldungen",
        bauen: () => gegenueber(
            { titel: "Flächenlage", punkte: ["viele Einsatzstellen", "je wenige Meldungen", "übt Priorisieren"] },
            { titel: "Einsatzlage", punkte: ["eine Einsatzstelle", "viele Meldungen", "übt Verkehrsabwicklung"] }
        )
    },
    "sprechfunk-regeln": {
        titel: "Ablauf einer Sprechfunkverbindung",
        beschreibung: "Jede Verbindung folgt der Kette aus Anruf, Anrufantwort, Nachricht und Bestätigung.",
        alt: "Ablaufkette einer Sprechfunkverbindung: Anruf, Anrufantwort, Nachricht, Bestätigung",
        bauen: () => kette([
            "Anruf", "Anrufantwort", { text: "Nachricht", betont: true }, "Bestätigung"
        ])
    },
    "betriebsworte": {
        titel: "Betriebsworte im Verlauf",
        beschreibung: "Die Betriebsworte markieren, wer als Nächstes spricht und wann der Verkehr beendet ist.",
        alt: "Drei Betriebsworte mit ihrer Bedeutung: kommen als Aufforderung zu antworten, verstanden als Bestätigung, Ende als Abschluss",
        bauen: () => aufbau([
            { wert: "kommen", bedeutung: "bitte antworten" },
            { wert: "verstanden", bedeutung: "Nachricht ist an" },
            { wert: "Ende", bedeutung: "Verkehr beendet", betont: true }
        ])
    },
    "uebungsfunkverkehr": {
        titel: "Übung und Tatsache unterscheiden",
        beschreibung: "Übungsverkehr wird gekennzeichnet, eine echte Meldung kommt mit dem Stichwort Tatsache durch.",
        alt: "Zwei Spalten im Vergleich: Vermerk Übung für Übungsnachrichten gegenüber Stichwort Tatsache für echte Meldungen",
        bauen: () => gegenueber(
            { titel: "Vermerk „Übung“", punkte: ["kennzeichnet Übungsverkehr", "vor jeder Nachricht", "verhindert Fehlalarm"] },
            { titel: "Stichwort „Tatsache“", punkte: ["echte Meldung", "hat Vorrang", "Übung pausiert"] }
        )
    },
    "bos-funk": {
        titel: "TMO und DMO",
        beschreibung: "TMO läuft über das Netz, DMO als Direktbetrieb zwischen den Endgeräten.",
        alt: "Zwei Spalten im Vergleich: TMO über das Netz mit großer Reichweite gegenüber DMO als Direktbetrieb ohne Netz",
        bauen: () => gegenueber(
            { titel: "TMO (Netzbetrieb)", punkte: ["über die Basisstationen", "große Reichweite", "Rufgruppen des Netzes"] },
            { titel: "DMO (Direktbetrieb)", punkte: ["Gerät zu Gerät", "kleine Reichweite", "auch ohne Netz nutzbar"] }
        )
    },
    "funkreichweite": {
        titel: "Reichweite endet an der Sichtlinie",
        beschreibung: "Meterwellen laufen im Wesentlichen geradeaus; ein Hindernis zwischen zwei Funkstellen kostet die Verbindung.",
        alt: "Zwei Funkstellen mit einem Hügel dazwischen: über die Sichtlinie kommt der Funk an, verdeckt endet die Verbindung",
        bauen: sichtlinie
    },
    "verkehrsarten": {
        titel: "Wechselverkehr und Gegenverkehr",
        beschreibung: "Im Wechselverkehr sendet immer nur eine Funkstelle, im Gegenverkehr sprechen beide gleichzeitig.",
        alt: "Zwei Spalten im Vergleich: Wechselverkehr mit abwechselndem Senden gegenüber Gegenverkehr mit gleichzeitigem Sprechen",
        bauen: () => gegenueber(
            { titel: "Wechselverkehr", punkte: ["nur eine Stelle sendet", "Sprechtaste wechselt", "Regelfall im BOS-Funk"] },
            { titel: "Gegenverkehr", punkte: ["beide senden zugleich", "wie ein Telefon", "braucht passende Technik"] }
        )
    },
    "antennen": {
        titel: "Die Funkstrecke hinter dem Gerät",
        beschreibung: "Vom Funkgerät über die Leitung zur Antenne: jedes Glied kann Reichweite kosten.",
        alt: "Drei Glieder der Funkstrecke nebeneinander: Funkgerät, Antennenleitung und Antenne mit dem jeweiligen Fehlerrisiko",
        bauen: () => aufbau([
            { wert: "Gerät", bedeutung: "Sendeleistung" },
            { wert: "Leitung", bedeutung: "Dämpfung, Biegeradius" },
            { wert: "Antenne", bedeutung: "Länge zur Frequenz", betont: true }
        ])
    },
    "funkrufnamen": {
        titel: "Aufbau eines Funkrufnamens",
        beschreibung: "Ein Funkrufname besteht aus Kennwort, Ort und Kennzahlen.",
        alt: "Aufbau eines Funkrufnamens aus drei Teilen: Kennwort Florian, Ort Musterstadt und Kennzahlen 33/44",
        bauen: () => aufbau([
            { wert: "Florian", bedeutung: "Kennwort" },
            { wert: "Musterstadt", bedeutung: "Ort" },
            { wert: "33/44", bedeutung: "Kennzahlen", betont: true }
        ])
    },
    "funkrufnamen-thw": {
        titel: "Aufbau eines THW-Funkrufnamens",
        beschreibung: "Das Kennwort ist immer HEROS, dahinter stehen Ortsverband und Ziffernfolge.",
        alt: "Aufbau eines THW-Funkrufnamens: Kennwort HEROS, Ortsverband und Ziffernfolge für Einheit und Fahrzeug",
        bauen: () => aufbau([
            { wert: "HEROS", bedeutung: "Kennwort THW" },
            { wert: "Musterstadt", bedeutung: "Ortsverband" },
            { wert: "24/51", bedeutung: "Einheit, Fahrzeug", betont: true }
        ])
    },
    "funkmeldesystem": {
        titel: "Statusmeldungen im Verlauf",
        beschreibung: "Vier häufige Statusmeldungen von der Übernahme des Einsatzes bis zurück auf die Wache.",
        alt: "Vier Statusmeldungen in ihrer Reihenfolge: Status 3 Einsatz übernommen, Status 4 an der Einsatzstelle, Status 1 einsatzbereit über Funk, Status 2 einsatzbereit auf Wache",
        bauen: () => kette([
            "3 – übernommen", "4 – an der Stelle", "1 – bereit über Funk",
            { text: "2 – auf Wache", betont: true }
        ])
    },
    "open-source": {
        titel: "Was Quelloffenheit ermöglicht",
        beschreibung: "Vom öffentlichen Quellcode über die Prüfung und Anpassung bis zum eigenen Betrieb.",
        alt: "Vier Schritte: Quellcode auf GitHub einsehen, prüfen, anpassen und auf eigener Infrastruktur betreiben",
        bauen: () => kette([
            "Code auf GitHub", "prüfen", "anpassen",
            { text: "selbst betreiben", betont: true }
        ])
    },
    "einbetten": {
        titel: "Zwei Wege der Weitergabe",
        beschreibung: "Derselbe Inhalt geht entweder als Widget in eine fremde Seite oder als PDF an die Pinnwand.",
        alt: "Gegenüberstellung: Widget im iframe mit Quellenzeile auf der einbettenden Seite gegenüber druckfertigem A4-Aushang mit QR-Code",
        bauen: () => gegenueber(
            { titel: "Als Widget", punkte: ["iframe in die eigene Seite", "lädt nichts nach", "Quellenzeile darunter"] },
            { titel: "Als Aushang", punkte: ["A4 zum Ausdrucken", "QR-Code auf die Seite", "EUPL-1.2, Weitergabe frei"] }
        )
    },
    "autor": {
        titel: "Woher die Inhalte kommen",
        beschreibung: "Von der Ausbildungspraxis über echte Übungen bis zu den Seiten dieser Website.",
        alt: "Vier Schritte: Ausbildungspraxis im THW, tatsächlich gefunkte Übungen, gesammelter Funkspruch-Bestand und die Inhalte dieser Website",
        bauen: () => kette([
            "Ausbildung im THW", "gefunkte Übungen", "Funkspruch-Bestand",
            { text: "Inhalte hier", betont: true }
        ])
    },
    "ueber-das-projekt": {
        titel: "Wie eine Angabe geprüft wird",
        beschreibung: "Jede fachliche Aussage durchläuft dieselben vier Stationen, bevor sie stehen bleibt.",
        alt: "Vier Schritte der Prüfung: Aussage formulieren, Quelle am Dokument prüfen, Fundstelle nennen und bei fehlendem Beleg kennzeichnen",
        bauen: () => kette([
            "Aussage", "Quelle prüfen", "Fundstelle nennen",
            { text: "ohne Beleg: kennzeichnen", betont: true }
        ])
    },
    "digitale-funkuebung": {
        titel: "Papier gegen Teilnehmer-Link",
        beschreibung: "Die Übungsunterlagen liegen entweder gedruckt vor oder im Browser hinter einem Link.",
        alt: "Zwei Spalten im Vergleich: gedruckte Unterlagen gegenüber persönlichem Link im Browser mit Fortschrittsanzeige",
        bauen: () => gegenueber(
            { titel: "Auf Papier", punkte: ["Vordrucke drucken", "unabhängig von Technik", "kein Fortschritt sichtbar"] },
            { titel: "Über den Link", punkte: ["im Browser, ohne App", "abhaken je Nachricht", "Leitung sieht den Stand"] }
        )
    },
    "regiebuch-funkuebung": {
        titel: "Eine Zeile des Nachrichtenplans",
        beschreibung: "Jede Zeile nennt Nummer, absetzende Funkstelle, Empfänger und Status.",
        alt: "Aufbau einer Zeile im Nachrichtenplan: laufende Nummer, absetzende Funkstelle, Empfänger und Status der Nachricht",
        bauen: () => aufbau([
            { wert: "14", bedeutung: "Nummer" },
            { wert: "Heros 24/51", bedeutung: "sendet" },
            { wert: "Heros 24/10", bedeutung: "empfängt" },
            { wert: "offen", bedeutung: "Status", betont: true }
        ])
    },
    "x-zeit": {
        titel: "Nachrichten auf der X-Zeit-Achse",
        beschreibung: "Bei Start-Offset 5 und Intervall 2 liegt die erste Nachricht auf X+7, die vierzigste auf X+85.",
        alt: "Zeitachse mit vier Marken: Anmeldung bei X plus 0, erste Nachricht bei X plus 7, Mitte bei X plus 43 und letzte bei X plus 85",
        bauen: () => ({
            breite: 560,
            hoehe: 90,
            inhalt: zeitachse(20, 40, 500, [
                { anteil: 0, label: "X+0 Anmeldung" },
                { anteil: 0.08, label: "X+7 erste" },
                { anteil: 0.5, label: "X+43" },
                { anteil: 1, label: "X+85 letzte" }
            ])
        })
    },
    "kostenlos-ohne-anmeldung": {
        titel: "Was es gibt und was nicht",
        beschreibung: "Ohne Konto entfallen Registrierung und Bezahlschranke, damit aber auch Zugriffsschutz und Rollen.",
        alt: "Zwei Spalten im Vergleich: was ohne Konto zum Vorteil entfällt gegenüber dem, was als Preis dafür fehlt, etwa Zugriffsschutz und Rechteverwaltung",
        bauen: () => gegenueber(
            { titel: "Entfällt zum Vorteil", punkte: ["keine Registrierung", "keine Zahlungsdaten", "keine Mengengrenzen"] },
            { titel: "Entfällt als Preis", punkte: ["kein Zugriffsschutz", "keine Rollen", "kein Anspruch auf Support"] }
        )
    },
    "alternative": {
        titel: "Mit Konto oder ohne",
        beschreibung: "Die Wege unterscheiden sich vor allem an der Registrierung und an den Mengengrenzen.",
        alt: "Zwei Spalten im Vergleich: Lösung ohne Benutzerkonto gegenüber kontobasierter Lösung mit Rollen und Beschaffung über Rechnung",
        bauen: () => gegenueber(
            { titel: "Ohne Konto", punkte: ["sofort nutzbar", "keine Mengengrenzen", "quelloffen"] },
            { titel: "Mit Konto", punkte: ["Rollen im Team", "Beschaffung über Rechnung", "Ansprechpartner"] }
        )
    },
    "wissen": {
        titel: "Die fünf Themenbereiche",
        beschreibung: "Der Wissensbereich gliedert sich in Übungen, Grundlagen, Rufnamen, Technik und Anwendung.",
        alt: "Fünf Themenbereiche des Wissensbereichs nebeneinander: Übungen, Grundlagen, Rufnamen, Technik und Anwendung",
        bauen: () => aufbau([
            { wert: "Übungen", bedeutung: "planen, durchführen" },
            { wert: "Grundlagen", bedeutung: "Regeln, Betriebsworte" },
            { wert: "Rufnamen", bedeutung: "Kennungen, FMS" },
            { wert: "Technik", bedeutung: "Reichweite, Antennen" },
            { wert: "Anwendung", bedeutung: "Vorlagen, Archiv", betont: true }
        ])
    },
    "faq": {
        titel: "Worauf sich die Fragen verteilen",
        beschreibung: "Die häufigsten Fragen betreffen den Ablauf einer Übung und den Umgang mit den Daten.",
        alt: "Zwei Spalten im Vergleich: Fragen zum Ablauf einer Übung gegenüber Fragen zu Daten, Kosten und Lizenz",
        bauen: () => gegenueber(
            { titel: "Zum Ablauf", punkte: ["Wie lange dauert es?", "Wie viele Sprüche?", "Welche Unterlagen?"] },
            { titel: "Zu Daten und Recht", punkte: ["Was wird gespeichert?", "Was kostet es?", "Welche Lizenz?"] }
        )
    }
};

/** Ist für den Slug ein Diagramm hinterlegt? */
export function hatDiagramm(slug) {
    return Object.hasOwn(DIAGRAMME, slug);
}

export const DIAGRAMM_SLUGS = Object.keys(DIAGRAMME);

/**
 * Baut das fertige SVG samt Bildunterschrift.
 *
 * Rückgabe ist ein <figure>: die Bildunterschrift steht sichtbar unter dem
 * Diagramm und wiederholt nicht den Alternativtext, sondern ordnet das Bild in
 * den Text ein.
 */
export function renderDiagramm(slug) {
    const eintrag = DIAGRAMME[slug];
    if (!eintrag) throw new Error(`Kein Diagramm für "${slug}" hinterlegt.`);

    const { inhalt, breite, hoehe } = eintrag.bauen();
    const id = `diagramm-${slug.replaceAll("/", "-")}`;

    return `        <figure class="seiten-diagramm-rahmen my-4" data-testid="seiten-diagramm">
${svg({ id, breite, hoehe, titel: eintrag.titel, beschreibung: eintrag.alt, inhalt })}
            <figcaption class="small text-body-secondary mt-2">${eintrag.beschreibung}</figcaption>
        </figure>`;
}
