let teilnehmerListe = [
    "Heros Oldenburg 16/11",
    "Heros Oldenburg 18/13",
    "Heros Oldenburg 86/25",
    "Florian Wesermarsch 14/23/4",
    "Akkon Oldenburg 12/67",
    "Rotkreuz Schortens 32/54",
    "Heros Wilhemshaven 22/51",
    "Heros Wilhemshaven 21/10",
    "Heros Leer 21/10",
    "Heros Emden 21/10"
];

const predefinedLoesungswoerter = [
    "Funkverkehr", "Rettungswagen", "Notruf", "Blaulicht", "Funkdisziplin",
    "Einsatzleitung", "Mikrofon", "Durchsage", "Sprechgruppe", "Digitalfunk",
    "Frequenz", "Funkstille", "Antennenmast", "Feuerwehr", "Katastrophenschutz",
    "Alarmierung", "Fernmelder", "Kommunikation", "Verständigung", "Sicherheitszone",
    "Einsatzplan", "Koordination", "Funkgerät", "Signalstärke", "Verbindung",
    "Repeater", "Einsatzbesprechung", "Lautstärke", "Funkkanal", "Empfang",
    "Relaisstation", "Funkraum", "Gruppenruf", "Rückmeldung", "Einsatzgebiet",
    "Wellenlänge", "Übertragung", "Ausfallsicherheit", "Rescue", "Einsatzwagen"
].map(word => word.toUpperCase());

let spruecheProTeilnehmer = 50;

let spruecheAnAlle = 3;
let spruecheAnMehrere = 2;

let leitung = "Heros Wind 10";
let rufgruppe = "T_OL_GOLD-1";
let nameDerUebung = "Sprechfunkübung Blauer Wind 2025";

let datum;
let natoDate;

let jsonUebungsDaten;
let htmlUebungsDaten = [];
let loesungswoerter = {};

let currentPageIndex = 0;

function updateVerteilung() {
    updateAbsolute('alle');
    updateAbsolute('mehrere');
}

function updateAbsolute(type) {
    let total = Number(document.getElementById("spruecheProTeilnehmer").value);
    let percentInput = document.getElementById(`prozentAn${capitalize(type)}`);
    let calcSpan = document.getElementById(`calcAn${capitalize(type)}`);
    let hiddenInput = document.getElementById(`spruecheAn${capitalize(type)}`);

    let percentageValue = Number(percentInput.value);
    let absoluteValue = Math.round((percentageValue / 100) * total);

    calcSpan.textContent = absoluteValue;
    hiddenInput.value = absoluteValue;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderInitData() {
    document.getElementById("spruecheProTeilnehmer").value = spruecheProTeilnehmer;
    document.getElementById("spruecheAnAlle").value = spruecheAnAlle;
    document.getElementById("spruecheAnMehrere").value = spruecheAnMehrere;
    document.getElementById("leitung").value = leitung;
    document.getElementById("rufgruppe").value = rufgruppe;
    document.getElementById("nameDerUebung").value = nameDerUebung;

    renderTeilnehmer();
}

function renderTeilnehmer(triggerShuffle = true) {
    const container = document.getElementById("teilnehmer-container");
    container.innerHTML = ""; // Vorherigen Inhalt leeren

    let option = document.querySelector('input[name="loesungswortOption"]:checked')?.id;
    let isZentral = option === "zentralLoesungswort";
    let isIndividuell = option === "individuelleLoesungswoerter";

    // Zeige/verstecke das zentrale Lösungswort-Eingabefeld
    document.getElementById("zentralLoesungswortContainer").style.display = isZentral ? "block" : "none";

    // Zeige/verstecke den Button für zufällige Verteilung
    document.getElementById("shuffleButton").style.display = (isZentral || isIndividuell) ? "block" : "none";

    // **Erstelle die Tabelle mit dynamischer Spalte für Lösungswörter**
    container.innerHTML = `
        <table class="table table-bordered">
            <thead class="table-dark">
                <tr>
                    <th>Teilnehmer</th>
                    ${isIndividuell ? "<th id='loesungswortHeader'>Lösungswort</th>" : ""}
                    <th style="width: 50px;">Aktion</th>
                </tr>
            </thead>
            <tbody id="teilnehmer-body"></tbody>
        </table>
    `;

    // **Jetzt erst das `tbody` abrufen**
    const tbody = document.getElementById("teilnehmer-body");

    if (!tbody) {
        console.error("Fehler: tbody-Element konnte nicht gefunden werden!");
        return;
    }

    // **Füge die Teilnehmer als Tabellenzeilen hinzu**
    teilnehmerListe.forEach((teilnehmer, index) => {
        const row = document.createElement("tr");

        let loesungswortInput = "";
        if (isIndividuell) {
            let wort = loesungswoerter[teilnehmer] || "";
            loesungswortInput = `<td><input type="text" class="form-control" id="loesungswort-${index}" value="${wort}" placeholder="Lösungswort" readonly></td>`;
        }

        row.innerHTML = `
            <td><input type="text" class="form-control" value="${teilnehmer}" oninput="updateTeilnehmer(${index}, this.value)"></td>
            ${loesungswortInput}
            <td><button class="btn btn-danger btn-sm" onclick="removeTeilnehmer(${index})"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    });

    // Falls `renderTeilnehmer` von einer Benutzerinteraktion kommt, neu verteilen
    if (triggerShuffle) {
        shuffleLoesungswoerter();
    }
}

function updateTeilnehmer(index, value) {
    teilnehmerListe[index] = value;
}

function addTeilnehmer() {
    teilnehmerListe.push("");
    renderTeilnehmer();
}

function removeTeilnehmer(index) {
    teilnehmerListe.splice(index, 1);
    renderTeilnehmer();
}

function toggleFunkspruchInput() {
    const useCustomList = document.getElementById("useCustomList").checked;
    document.getElementById("fileUploadContainer").style.display = useCustomList ? "block" : "none";
}

function startUebung() {
    const useCustomList = document.getElementById("useCustomList").checked;
    const file = document.getElementById("funksprueche").files[0];

    spruecheProTeilnehmer = Number(document.getElementById("spruecheProTeilnehmer").value);
    spruecheAnAlle = Number(document.getElementById("spruecheAnAlle").value);
    spruecheAnMehrere = Number(document.getElementById("spruecheAnMehrere").value);
    leitung = document.getElementById("leitung").value;
    rufgruppe = document.getElementById("rufgruppe").value;
    nameDerUebung = document.getElementById("nameDerUebung").value;

    datum = new Date(document.getElementById("datum").value + "T00:00:00");
    natoDate = formatNATODate(datum, false);

    // **Lösungswörter beim Start auslesen**
    loesungswoerter = {}; // Zurücksetzen

    let option = document.querySelector('input[name="loesungswortOption"]:checked')?.id || "keineLoesungswoerter";

    if (option === "zentralLoesungswort") {
        let zentralesWort = document.getElementById("zentralLoesungswortInput").value.trim();
        if (!zentralesWort) {
            // Falls leer, zufälliges Wort wählen
            zentralesWort = predefinedLoesungswoerter[Math.floor(Math.random() * predefinedLoesungswoerter.length)];
            document.getElementById("zentralLoesungswortInput").value = zentralesWort;
        }
        teilnehmerListe.forEach(teilnehmer => {
            loesungswoerter[teilnehmer] = zentralesWort;
        });
    } 
    else if (option === "individuelleLoesungswoerter") {
        teilnehmerListe.forEach((teilnehmer, index) => {
            let individuellesWort = document.getElementById(`loesungswort-${index}`)?.value.trim() || "";
            loesungswoerter[teilnehmer] = individuellesWort;
        });
    }

    if (useCustomList) {
        // Falls der Nutzer eine eigene Datei hochlädt
        if (!file) {
            alert("Bitte eine Funkspruch-Datei hochladen!");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            let funksprueche = event.target.result.split("\n").filter(s => s.trim() !== "").sort(() => Math.random() - 0.5);
            generateAllPages(funksprueche);
        };
        reader.readAsText(file);
    } else {
        // Falls der Nutzer die Standard-Liste nutzen will
        fetch("funksprueche.txt") // Datei vom Server laden
            .then(response => response.text())
            .then(data => {
                let funksprueche = data.split("\n").filter(s => s.trim() !== "").sort(() => Math.random() - 0.5);
                generateAllPages(funksprueche);
            })
            .catch(error => console.error("Fehler beim Laden der Funkspruchliste:", error));
    }

    document.getElementById("output-container").style.display = "block";
    document.getElementById("footer").style.display = "block";
}

/**
 * Verteilt zufällig Nachrichten an "ALLE" und "MEHRERE", ohne Überschneidung.
 *
 * @param {number} totalMessages - Gesamtanzahl verfügbarer Nachrichten (z.B. 0..totalMessages-1)
 * @param {number} anzahlAlle    - Wie viele Nachrichten sollen an "ALLE" gehen?
 * @param {number} anzahlMehrere - Wie viele Nachrichten sollen an "MEHRERE" gehen?
 *
 * @returns {{ alle: number[], mehrere: number[] }}
 *    - `alle`: Array mit den Nachrichtennummern, die an "ALLE" gehen
 *    - `mehrere`: Array mit den Nachrichtennummern, die an "MEHRERE" gehen
 */
function verteileNachrichten(totalMessages, anzahlAlle, anzahlMehrere) {
    // 1) Validierung: Reicht die Gesamtanzahl für die gewünschten Mengen aus?
    if (anzahlAlle + anzahlMehrere > totalMessages) {
        throw new Error(
            "Die gewünschte Anzahl für 'ALLE' und 'MEHRERE' übersteigt die Gesamtanzahl an Nachrichten."
        );
    }

    // 2) Array aller möglichen Nachrichtennummern (0, 1, 2, ..., totalMessages - 1)
    const alleNachrichten = [...Array(Number(totalMessages)).keys()];

    // 3) Zufällig mischen
    alleNachrichten.sort(() => Math.random() - 0.5);
    alleNachrichten.sort(() => Math.random() - 0.5);
    alleNachrichten.sort(() => Math.random() - 0.5);

    // 4) Aufteilen in "ALLE" und "MEHRERE", ohne Überschneidung
    const nachrichtenFuerAlle = alleNachrichten.slice(0, anzahlAlle);
    const nachrichtenFuerMehrere = alleNachrichten.slice(anzahlAlle, anzahlAlle + anzahlMehrere);
    const nachrichtenEinfach = alleNachrichten.slice(anzahlAlle + anzahlMehrere);

    return {
        alle: nachrichtenFuerAlle,
        mehrere: nachrichtenFuerMehrere,
        einfach: nachrichtenEinfach
    };
}

/**
 * Gibt eine zufällige Liste anderer Teilnehmer zurück (mind. 2).
 * 
 * @param {string[]} teilnehmerListe - Gesamte Teilnehmerliste
 * @param {string} aktuellerTeilnehmer - Der Teilnehmer, der "sich selbst" nicht erhalten darf
 * @returns {string[]} Zufälliges Teil-Array (mindestens 2 Teilnehmer)
 */
function getRandomSubsetOfOthers(teilnehmerListe, aktuellerTeilnehmer) {
    // 1) Filter: Wer ist "nicht ich"?
    const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
    const gesamtTeilnehmer = andere.length;

    // 2) Durchmischen
    const gemischt = [...andere].sort(() => Math.random() - 0.5);

    // 3) Gewichtete Wahrscheinlichkeitsverteilung für Gruppengröße
    const minGroesse = 2;
    const maxGroesse = gesamtTeilnehmer;

    // Berechnung einer zufälligen Größe mit einer gewichteten Verteilung:
    // Wahrscheinlichkeit für kleine Gruppen ist höher, größere Gruppen sind seltener.
    let zufallsGroesse;

    if (Math.random() < 0.7) {
        // 70% Wahrscheinlichkeit für eine Gruppe bis maximal Hälfte der Teilnehmer
        zufallsGroesse = Math.floor(Math.random() * (Math.ceil(gesamtTeilnehmer / 2) - minGroesse + 1)) + minGroesse;
    } else {
        // 30% Wahrscheinlichkeit für eine größere Gruppe bis zur gesamten Liste
        zufallsGroesse = Math.floor(Math.random() * (maxGroesse - minGroesse + 1)) + minGroesse;
    }

    // 4) Den „vorderen“ Teil (z. B. 2, 3, …) zurückgeben
    return gemischt.slice(0, zufallsGroesse);
}

/**
 * Gibt einen zufälligen "anderen" Teilnehmer zurück.
 *
 * @param {string[]} teilnehmerListe     - Gesamte Liste aller Teilnehmer
 * @param {string} aktuellerTeilnehmer   - Der Teilnehmer, der sich selbst nicht enthalten darf
 * @returns {string} Ein zufälliger anderer Teilnehmer
 */
function getRandomOther(teilnehmerListe, aktuellerTeilnehmer) {
    // 1) Filter: Wer ist "nicht ich"?
    const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);

    // 2) Zufälligen Index bestimmen
    const randomIndex = Math.floor(Math.random() * andere.length);

    // 3) Zurückgeben
    return andere[randomIndex];
}

function generiereUebung(funksprueche) {
    spruecheProTeilnehmer--;

    // Generiere Übung ohne Lösungsbuchstaben
    let uebungsDaten = teilnehmerListe.map(teilnehmer => {
        return {
            teilnehmer,
            kopfdaten: {
                datum: natoDate,
                nameDerUebung: nameDerUebung,
                leitung: leitung,
                teilnehmer: teilnehmerListe,
                rufgruppe: rufgruppe
            },
            nachrichten: generiereNachrichten(teilnehmer, funksprueche),
            loesungswort: loesungswoerter[teilnehmer] || "" // Speichere das Lösungswort mit ab
        };
    });

    // Jetzt die Lösungsbuchstaben verteilen
    verteileLoesungswoerter(uebungsDaten);

    return uebungsDaten;
}

/**
 * Generiert alle Nachrichten für einen Teilnehmer.
 */
function generiereNachrichten(teilnehmer, funksprueche) {
    let gemischteFunksprueche = [...funksprueche].sort(() => 0.5 - Math.random());
    let nachrichtenVerteilung = verteileNachrichten(spruecheProTeilnehmer, spruecheAnAlle, spruecheAnMehrere);

    let nachrichten = [];

    // Erste Nachricht: Anmeldung
    nachrichten.push({
        id: 1,
        nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
        empfaenger: [leitung]
    });

    for (let i = 0; i < spruecheProTeilnehmer; i++) {
        let nachricht = {};
        nachricht.id = i + 2;
        nachricht.nachricht = gemischteFunksprueche[i];

        if (nachrichtenVerteilung.alle.includes(i)) {
            nachricht.empfaenger = ["Alle"];
        } else if (nachrichtenVerteilung.mehrere.includes(i)) {
            nachricht.empfaenger = getRandomSubsetOfOthers(teilnehmerListe, teilnehmer);
        } else {
            nachricht.empfaenger = [getRandomOther(teilnehmerListe, teilnehmer)];
        }
        nachrichten.push(nachricht);
    }

    return nachrichten;
}

/**
 * Verteilt die Lösungsbuchstaben zufällig auf Nachrichten an den Empfänger,
 * aber mit ihrem ursprünglichen Index (+1), damit das Wort zusammengesetzt werden kann.
 */
function verteileLoesungswoerter(uebungsDaten) {
    uebungsDaten.forEach(empfaengerDaten => {
        let empfaenger = empfaengerDaten.teilnehmer;
        let loesungswort = empfaengerDaten.loesungswort.split(""); // Array der Buchstaben mit Index

        // Speichere den Original-Index für spätere Rekonstruktion, +1 für menschliche Lesbarkeit
        let buchstabenMitIndex = loesungswort.map((buchstabe, index) => ({ index: index + 1, buchstabe }));

        // Alle Nachrichten sammeln, die nur für diesen Teilnehmer bestimmt sind
        let empfaengerNachrichten = [];
        uebungsDaten.forEach(absenderDaten => {
            if (absenderDaten.teilnehmer !== empfaenger) {
                absenderDaten.nachrichten.forEach(nachricht => {
                    if (nachricht.empfaenger.length === 1 && nachricht.empfaenger[0] === empfaenger) {
                        empfaengerNachrichten.push(nachricht);
                    }
                });
            }
        });

        let anzahlNachrichten = empfaengerNachrichten.length;

        if (anzahlNachrichten === 0) {
            console.warn(`⚠ Warnung: Keine Nachrichten für ${empfaenger} verfügbar!`);
            return;
        }

        // Falls das Lösungswort mehr Buchstaben als Nachrichten hat, müssen mehrere Buchstaben pro Nachricht gesendet werden
        let buchstabenProNachricht = Math.ceil(buchstabenMitIndex.length / anzahlNachrichten);

        // Zufällig mischen, aber mit Index
        buchstabenMitIndex.sort(() => Math.random() - 0.5);

        let buchstabenIndex = 0;

        // Nachrichten zufällig mischen
        let gemischteNachrichten = [...empfaengerNachrichten].sort(() => Math.random() - 0.5);

        // Buchstaben zufällig auf Nachrichten verteilen, aber mit originalem Index (+1 für menschliche Lesbarkeit)
        gemischteNachrichten.forEach(nachricht => {
            let buchstabenSegment = [];

            for (let i = 0; i < buchstabenProNachricht; i++) {
                if (buchstabenIndex < buchstabenMitIndex.length) {
                    let { index, buchstabe } = buchstabenMitIndex[buchstabenIndex];
                    buchstabenSegment.push(`${index}${buchstabe}`); // Format: "1F"
                    buchstabenIndex++;
                }
            }

            if (buchstabenSegment.length > 0) {
                nachricht.nachricht += " " + buchstabenSegment.join(""); // Mehrere Buchstaben direkt hintereinander
            }
        });
    });
}

/**
 * Erstellt HTML-Seiten und zeigt sie im iframe mit Paginierung an.
 * 
 * @param {Array} funksprueche - JSON-Array mit den Funksprüchen
 */
function generateAllPages(funksprueche) {
    jsonUebungsDaten = generiereUebung(funksprueche);
    htmlUebungsDaten = jsonUebungsDaten.map(data => generateHTMLPage(data));
    currentPageIndex = 0;

    if (htmlUebungsDaten.length > 0) {
        displayPage(currentPageIndex);

    zeigeUebungsdauer()
    }
}

/**
 * Zeigt die aktuelle Seite im iframe an.
 */
function displayPage(index) {
    if (index < 0 || index >= htmlUebungsDaten.length) return;

    const iframe = document.getElementById("resultFrame");
    iframe.srcdoc = htmlUebungsDaten[index]; // Lädt den HTML-Code direkt in das iframe

    document.getElementById("current-page").textContent = `Seite ${index + 1} / ${htmlUebungsDaten.length}`;
}

/**
 * Wechselt zur nächsten oder vorherigen Seite.
 * @param {number} step - 1 für weiter, -1 für zurück
 */
function changePage(step) {
    const newIndex = currentPageIndex + step;
    if (newIndex >= 0 && newIndex < htmlUebungsDaten.length) {
        currentPageIndex = newIndex;
        displayPage(currentPageIndex);
    }
}

function formatNATODate(date, withTime = true) {
    const monate = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

    let tag = String(date.getDate()).padStart(2, "0");  // Tag zweistellig
    let stunde = String(date.getHours()).padStart(2, "0"); // Stunden zweistellig
    let minute = String(date.getMinutes()).padStart(2, "0"); // Minuten zweistellig
    let monat = monate[date.getMonth()]; // Monat als 3-Buchstaben-Abkürzung
    let jahr = String(date.getFullYear()).slice(-2); // Zweistellige Jahreszahl

    if (withTime)
        return `${tag}${stunde}${minute}${monat}${jahr}`;
    return `${tag}${monat}${jahr}`;
}

/**
 * Erstellt die HTML-Struktur für eine einzelne Übungsseite.
 * 
 * @param {Object} teilnehmerDaten - JSON-Objekt für einen Teilnehmer
 * @returns {string} - HTML-Code als String
 */
function generateHTMLPage(teilnehmerDaten) {
    const { teilnehmer, kopfdaten, nachrichten, loesungswort } = teilnehmerDaten;

    const teilnehmerListeHTML = kopfdaten.teilnehmer
        .map(name => "<tr><td>" + name + "</td></tr>")
        .join("");

    const nachrichtenHTML = nachrichten
        .map(n => 
            "<tr>" +
                "<td>" + n.id + "</td>" +
                "<td>" + n.empfaenger.join("<br/>").replace(/ /g, "&nbsp;") + "</td>" +
                "<td>" + n.nachricht + "</td>" +
            "</tr>")
        .join("");

    return "<!DOCTYPE html>" +
    "<html lang='de'>" +
    "<head>" +
        "<meta charset='UTF-8'>" +
        "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
        "<title>Sprechfunkübung - " + teilnehmer + "</title>" +
        "<style>" +
            "body { font-family: Arial, sans-serif; margin: 20px; }" +
            ".container { max-width: 100%; margin: auto; }" +
            "h1, h2 { text-align: center; }" +
            "h1 { font-size: 22px; font-weight: bold; }" +
            "h2 { font-size: 18px; font-weight: bold; }" +
            "table { width: 100%; border-collapse: collapse; margin-top: 20px; }" +
            "th, td { border: 1px solid black; padding: 8px; text-align: left; }" +
            "th { background-color: #f2f2f2; }" +
            ".row { display: flex; justify-content: space-between; margin-top: 20px; }" +
            ".col { width: 48%; }" +
            "@media (max-width: 768px) {" +
                ".row { flex-direction: column; }" +
                ".col { width: 100%; margin-bottom: 15px; }" +
            "}" +
        "</style>" +
    "</head>" +
    "<body>" +
        "<div class='container'>" +
            "<h1>Sprechfunkübung " + kopfdaten.nameDerUebung + "</h1>" +
            "<h2>Eigener Funkrufname: " + teilnehmer + "</h2>" +

            "<div class='row'>" +
                "<div class='col'>" +
                    "<h3>Kopfdaten</h3>" +
                    "<table>" +
                        "<tr><th>Datum</th><td>" + kopfdaten.datum + "</td></tr>" +
                        "<tr><th>Rufgruppe</th><td>" + kopfdaten.rufgruppe + "</td></tr>" +
                        "<tr><th>Betriebsleitung</th><td>" + kopfdaten.leitung + "</td></tr>" +
                        "<tr><th>Lösungswort</th><td>" + loesungswort + "</td></tr>" +
                    "</table>" +
                "</div>" +

                "<div class='col'>" +
                    "<h3>Teilnehmer</h3>" +
                    "<table>" +
                        teilnehmerListeHTML +
                    "</table>" +
                "</div>" +
            "</div>" +

            "<h3>Folgende Nachrichten sind zu übermitteln:</h3>" +
            "<table>" +
                "<thead>" +
                    "<tr>" +
                        "<th style='width: 10%;'>Nr.</th>" +
                        "<th style='width: 20%;'>Empfänger</th>" +
                        "<th style='width: 70%;'>Nachrichtentext</th>" +
                    "</tr>" +
                "</thead>" +
                "<tbody>" +
                    nachrichtenHTML +
                "</tbody>" +
            "</table>" +
        "</div>" +
    "</body>" +
    "</html>";
}


function fixEncoding(text) {
    return text.normalize("NFC") // Korrigiert Zeichensatz-Probleme
        .replace(/ /g, "\u00A0"); // Non-Breaking Space für Leerzeichen
}

async function generatePDFs() {
    const { jsPDF } = window.jspdf;
    const softwareVersion = "1.0.0"; // Versionsnummer hier anpassen
    const generierungszeit = formatNATODate(new Date()); // NATO-Datum für Fußzeile

    for (let i = 0; i < jsonUebungsDaten.length; i++) {
        const teilnehmerDaten = jsonUebungsDaten[i];
        const participant = fixEncoding(teilnehmerDaten.teilnehmer);
        const kopfdaten = teilnehmerDaten.kopfdaten;

        let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const pageMargin = 10;
        const firstTableStartY = 30;
        const secondPageTableTopMargin = 30; // **Garantierter Abstand für die Tabelle auf Seite 2+**

        // **1. Kopfzeile für erste Seite**
        drawFirstPageHeader(pdf, kopfdaten, participant, pdfWidth);

        // **2. Kopfdaten-Tabelle (links)**
        let kopfdatenWidth = (pdfWidth - 2 * pageMargin) * 0.35;
        drawKopfdatenTable(pdf, kopfdaten, firstTableStartY, pageMargin, kopfdatenWidth);

        // **3. Teilnehmerliste (rechts)**
        let teilnehmerWidth = (pdfWidth - 2 * pageMargin) * 0.60;
        drawTeilnehmerTable(pdf, kopfdaten, firstTableStartY, pdfWidth - pageMargin - teilnehmerWidth, teilnehmerWidth);

        // **4. Nachrichten-Tabelle**
        let tableStartY = Math.max(pdf.lastAutoTable.finalY + 10, 75);
        drawNachrichtenTable(pdf, teilnehmerDaten, tableStartY, pageMargin, pdfWidth, secondPageTableTopMargin);

        // **5. Setze Kopfzeilen & Seitenzahlen auf allen Seiten**
        let totalPages = pdf.internal.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            pdf.setPage(j);
            drawHeader(pdf, participant, j, pdfWidth, pageMargin, kopfdaten);
            drawFooter(pdf, generierungszeit, softwareVersion, j, totalPages, pdfWidth, pdfHeight, pageMargin);
        }

        // **6. PDF speichern**
        pdf.save(`${participant}.pdf`);
    }

    alert("Alle PDFs wurden erfolgreich erstellt!");
}

/**
 * Erstellt die Kopfzeile der ersten Seite (größer & fett).
 */
function drawFirstPageHeader(pdf, kopfdaten, participant, pdfWidth) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`${kopfdaten.nameDerUebung}`, pdfWidth / 2, 15, { align: "center" });

    pdf.setFontSize(14);
    pdf.text(`${participant}`, pdfWidth / 2, 20, { align: "center" });
}

/**
 * Erstellt die Kopfzeile auf Seite 2+.
 */
function drawHeader(pdf, participant, pageNumber, pdfWidth, pageMargin, kopfdaten) {
    if (pageNumber > 1) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        // **Links: Funkrufname**
        pdf.text(`Eigener Funkrufname: ${participant}`, pageMargin, 20);

        // **Rechts: Name der Übung**
        let rightText = kopfdaten.nameDerUebung + " " + kopfdaten.datum
        let nameWidth = pdf.getTextWidth(rightText);
        pdf.text(rightText, pdfWidth - pageMargin - nameWidth, 20);

        // **Trennlinie unter der Kopfzeile**
        pdf.setDrawColor(0);
        pdf.line(pageMargin, 22, pdfWidth - pageMargin, 22);
    }
}

/**
 * Erstellt die Fußzeile auf allen Seiten.
 */
function drawFooter(pdf, generierungszeit, softwareVersion, pageNumber, totalPages, pdfWidth, pdfHeight, pageMargin) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    // **Seitenzahl bleibt auf allen Seiten gleich formatiert**
    let pageNumberText = `Seite ${pageNumber} von ${totalPages}`;
    let pageNumberWidth = pdf.getTextWidth(pageNumberText);
    pdf.text(pageNumberText, pdfWidth - pageMargin - pageNumberWidth, pdfHeight - 10);

    // **Link und Copyright-Infos linksbündig**
    let leftText = `© Johannes Rudolph | Version ${softwareVersion} | Generiert: ${generierungszeit} | Generator: wattnpapa.github.io/sprechfunk-uebung`;
    pdf.textWithLink(leftText, pageMargin, pdfHeight - 10, { url: "https://wattnpapa.github.io/sprechfunk-uebung/" });
}

/**
 * Erstellt die Kopfdaten-Tabelle.
 */
function drawKopfdatenTable(pdf, kopfdaten, startY, marginLeft, width) {
    pdf.autoTable({
        head: [["Beschreibung", "Wert"]],
        body: [
            ["Datum", kopfdaten.datum],
            ["Rufgruppe", kopfdaten.rufgruppe],
            ["Betriebsleitung", kopfdaten.leitung]
        ],
        startY: startY,
        margin: { left: marginLeft },
        tableWidth: width,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
        headStyles: { fillColor: [200, 200, 200] }
    });
}

/**
 * Erstellt die Teilnehmerliste-Tabelle.
 */
function drawTeilnehmerTable(pdf, kopfdaten, startY, marginLeft, width) {
    let teilnehmerColumns = 2;
    let teilnehmerRows = Math.ceil(kopfdaten.teilnehmer.length / teilnehmerColumns);
    let teilnehmerTable = [];

    for (let r = 0; r < teilnehmerRows; r++) {
        let row = [];
        for (let c = 0; c < teilnehmerColumns; c++) {
            let index = r + c * teilnehmerRows;
            if (index < kopfdaten.teilnehmer.length) {
                row.push(kopfdaten.teilnehmer[index]);
            } else {
                row.push("");
            }
        }
        teilnehmerTable.push(row);
    }

    pdf.autoTable({
        head: [["Teilnehmer", ""]],
        body: teilnehmerTable,
        startY: startY,
        margin: { left: marginLeft },
        tableWidth: width,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
        headStyles: { fillColor: [200, 200, 200] }
    });
}

/**
 * Erstellt die Nachrichten-Tabelle.
 */
function drawNachrichtenTable(pdf, teilnehmerDaten, startY, marginLeft, pdfWidth, secondPageTableTopMargin) {
    let tableWidth = pdfWidth - 2 * marginLeft;
    let empfaengerWidth = tableWidth * 0.20;
    let lfdnrWidth = 12;
    let columnWidths = [lfdnrWidth, empfaengerWidth, tableWidth - lfdnrWidth - empfaengerWidth];

    pdf.autoTable({
        head: [["Nr.", "Empfänger", "Nachrichtentext"]],
        body: teilnehmerDaten.nachrichten.map(n => [n.id, n.empfaenger.join("\n"), n.nachricht]),
        startY: startY,
        theme: "grid",
        margin: { left: marginLeft, top: secondPageTableTopMargin },
        tableWidth: tableWidth,
        columnStyles: {
            0: { cellWidth: columnWidths[0] },
            1: { cellWidth: columnWidths[1] },
            2: { cellWidth: columnWidths[2] }
        },
        styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
        headStyles: { fillColor: [200, 200, 200] }
    });
}

// Funktion zum Umschalten der Lösungswort-Optionen
function toggleLoesungswortOption() {
    let option = document.querySelector('input[name="loesungswortOption"]:checked').value;
    
    document.getElementById("zentralesLoesungswortContainer").style.display = option === "gleich" ? "block" : "none";
    
    // Zeigt/hide die Lösungswort-Spalte in der Teilnehmerliste
    document.getElementById("loesungswortColumn").style.display = option === "individuell" ? "table-cell" : "none";
    
    // Aktualisiert die Teilnehmerliste mit Lösungswörtern (falls benötigt)
    renderTeilnehmer();
}

async function generateInstructorPDF() {
    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pageMargin = 10;
    const firstTableStartY = 30;
    const secondPageTableTopMargin = 30; // **Garantierter Abstand für Tabellen auf Seite 2+**
    const softwareVersion = "1.0.0";
    const generierungszeit = formatNATODate(new Date());

    // **1. Kopfzeile für erste Seite**
    drawFirstPageHeader(pdf, jsonUebungsDaten[0].kopfdaten, "Übungsleitung", pdfWidth);

    // **2. Kopfdaten-Tabelle**
    drawKopfdatenTable(pdf, jsonUebungsDaten[0].kopfdaten, firstTableStartY, pageMargin, ((pdfWidth - 2 * pageMargin) / 2));

    // **3. Teilnehmer-Tabelle**
    let tableStartY = Math.max(pdf.lastAutoTable.finalY + 10, 75);

    let tableBody = jsonUebungsDaten.map(t => [
        t.teilnehmer,
        "", // Platz für Anmeldezeitpunkt
        t.loesungswort ? t.loesungswort : "", // Falls es ein Lösungswort gibt
        "" // Bemerkungen (handschriftlich eintragbar)
    ]);

    let columnWidths = [40, 35, 50, 150]; // Anpassung für saubere Darstellung

    pdf.autoTable({
        head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Bemerkungen"]],
        body: tableBody,
        startY: tableStartY,
        theme: "grid",
        margin: { left: pageMargin, top: secondPageTableTopMargin },
        tableWidth: pdfWidth - 2 * pageMargin,
        columnStyles: {
            0: { cellWidth: columnWidths[0] },
            1: { cellWidth: columnWidths[1] },
            2: { cellWidth: columnWidths[2] },
            3: { cellWidth: columnWidths[3] }
        },
        styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
        headStyles: { fillColor: [200, 200, 200] }
    });

    // **4. Kopf- und Fußzeilen für alle Seiten**
    let totalPages = pdf.internal.getNumberOfPages();
    for (let j = 1; j <= totalPages; j++) {
        pdf.setPage(j);
        drawHeader(pdf, "Übungsleitung", j, pdfWidth, pageMargin, jsonUebungsDaten[0].kopfdaten);
        drawFooter(pdf, generierungszeit, softwareVersion, j, totalPages, pdfWidth, pdfHeight, pageMargin);
    }

    pdf.save("Uebungsleitung.pdf");
}


function setLoesungswoerter() {
    const isKeine = document.getElementById("keineLoesungswoerter").checked;
    const isZentral = document.getElementById("zentralLoesungswort").checked;
    const isIndividuell = document.getElementById("individuelleLoesungswoerter").checked;

    if (isKeine) {
        // Lösungswörter zurücksetzen
        loesungswoerter = {};
        document.getElementById("zentralLoesungswortInput").disabled = true;
        document.getElementById("zentralLoesungswortInput").value = "";
        document.getElementById("shuffleButton").disabled = true;
    } else if (isZentral) {
        // Zentrales Lösungswort setzen
        let zentralesWort = document.getElementById("zentralLoesungswortInput").value;
        teilnehmerListe.forEach(teilnehmer => {
            loesungswoerter[teilnehmer] = zentralesWort;
        });

        // Eingabefeld aktivieren
        document.getElementById("zentralLoesungswortInput").disabled = false;
        document.getElementById("shuffleButton").disabled = true;
    } else if (isIndividuell) {
        // Individuelle Wörter zuweisen
        assignRandomLoesungswoerter();
        document.getElementById("zentralLoesungswortInput").disabled = true;
        document.getElementById("shuffleButton").disabled = false;
    }

    renderTeilnehmer(); // UI aktualisieren
}

function assignRandomLoesungswoerter() {
    // Shuffle-Algorithmus für zufällige Verteilung
    let shuffledWords = [...predefinedLoesungswoerter].sort(() => Math.random() - 0.5);

    teilnehmerListe.forEach((teilnehmer, index) => {
        loesungswoerter[teilnehmer] = shuffledWords[index % shuffledWords.length];
    });
}

function shuffleLoesungswoerter() {
    const isZentral = document.getElementById("zentralLoesungswort").checked;
    const isIndividuell = document.getElementById("individuelleLoesungswoerter").checked;

    if (isZentral) {
        let zentralesWort = predefinedLoesungswoerter[Math.floor(Math.random() * predefinedLoesungswoerter.length)];
        document.getElementById("zentralLoesungswortInput").value = zentralesWort;
        teilnehmerListe.forEach(teilnehmer => {
            loesungswoerter[teilnehmer] = zentralesWort;
        });
    } else if (isIndividuell) {
        assignRandomLoesungswoerter();
    }

    renderTeilnehmer(false); // WICHTIG: Setze `triggerShuffle = false`, um Endlosschleife zu vermeiden
}

// Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
// Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
function berechneUebungsdauer(nachrichtenDaten) {
    let gesamtDauerOptimal = 0;
    let gesamtDauerSchlecht = 0;
    let totalMessages = 0;

    nachrichtenDaten.forEach(nachricht => {
        let textLaenge = nachricht.nachricht.length;
        let empfaengerAnzahl = nachricht.empfaenger.length;

        // Verbindungsaufbau berechnen
        let zeitVerbindungsaufbau = 5 + (empfaengerAnzahl - 1) * 3; // 5 Sek + 3 Sek pro Empfänger
        let zeitVerbindungsabbau = 3; // Zusätzlicher Abschluss der Übertragung

        // Sprechzeit + Mitschrift
        let zeitSprechen = textLaenge / 2;  // 2 Zeichen pro Sekunde
        let zeitMitschrift = textLaenge;    // 1 Zeichen pro Sekunde

        // Verzögerung durch mehrere Empfänger
        let zeitEmpfaenger = (empfaengerAnzahl - 1) * 2; // +2 Sek pro zusätzlichem Empfänger

        // Optimale Zeit
        let zeitOptimal = zeitSprechen + zeitMitschrift + zeitEmpfaenger + zeitVerbindungsaufbau + zeitVerbindungsabbau;
        gesamtDauerOptimal += zeitOptimal;

        // Schlechteste Zeit (mit Wiederholungen)
        let wiederholungsFaktor = Math.random() < 0.3 ? 1.5 : 1; // +50% falls Wiederholung nötig
        let zeitSchlecht = zeitOptimal * wiederholungsFaktor;
        gesamtDauerSchlecht += zeitSchlecht;

        totalMessages++; // Zähle Nachrichten für die durchschnittliche Zeit pro Funkspruch
    });

    // Umrechnung der Dauer in Minuten
    let gesamtDauerOptimalMinuten = gesamtDauerOptimal / 60;
    let gesamtDauerSchlechtMinuten = gesamtDauerSchlecht / 60;

    // Durchschnittliche Zeit pro Funkspruch
    let durchschnittlicheZeitOptimal = gesamtDauerOptimal / totalMessages;
    let durchschnittlicheZeitSchlecht = gesamtDauerSchlecht / totalMessages;

    return {
        optimal: gesamtDauerOptimalMinuten,
        schlecht: gesamtDauerSchlechtMinuten,
        durchschnittOptimal: durchschnittlicheZeitOptimal,
        durchschnittSchlecht: durchschnittlicheZeitSchlecht
    };
}

// Umwandlung der Zeit in Stunden und Minuten
function formatDuration(zeitInMinuten) {
    const stunden = Math.floor(zeitInMinuten / 60);
    const minuten = Math.floor(zeitInMinuten % 60);

    return {
        stunden: stunden,
        minuten: minuten
    };
}

// Integration der Daueranzeige
function zeigeUebungsdauer() {
    let uebungsDauer = berechneUebungsdauer(jsonUebungsDaten.flatMap(t => t.nachrichten));

    // Umrechnung der Zeiten in Stunden und Minuten
    const optimalFormatted = formatDuration(uebungsDauer.optimal);
    const schlechtFormatted = formatDuration(uebungsDauer.schlecht);
    const durchschnittOptimal = uebungsDauer.durchschnittOptimal;
    const durchschnittSchlecht = uebungsDauer.durchschnittSchlecht;
    const minutenOptimal = uebungsDauer.optimal;
    const minutenSchelcht = uebungsDauer.schlecht;

    // Anzeige der Dauer in der Tabelle
    document.getElementById("dauerOptimalMinuten").innerText = `${minutenOptimal.toFixed()} Min`;
    document.getElementById("dauerOptimalStundenMinuten").innerText = `${optimalFormatted.stunden} Std ${optimalFormatted.minuten.toFixed(0)} Min`;
    document.getElementById("durchschnittOptimal").innerText = `${durchschnittOptimal.toFixed(2)} Sek`;

    document.getElementById("dauerLangsamMinuten").innerText = `${minutenSchelcht.toFixed()} Min`;
    document.getElementById("dauerLangsamStundenMinuten").innerText = `${schlechtFormatted.stunden} Std ${schlechtFormatted.minuten.toFixed(0)} Min`;
    document.getElementById("durchschnittLangsam").innerText = `${durchschnittSchlecht.toFixed(2)} Sek`;
}

renderInitData();