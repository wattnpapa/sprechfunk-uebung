import pdfGenerator from './pdfGenerator.js';
import { DateFormatter } from "./DateFormatter.js";

export class AppController {

    constructor() {
        console.log("📌 AppController wurde initialisiert");

        // Initialisiere Teilnehmerliste
        this.teilnehmerListe = [
            "Heros Oldenburg 16/11",
            "Heros Oldenburg 17/12",
            "Heros Oldenburg 18/13",
            "Heros Jever 21/10",
            "Heros Leer 21/10",
            "Heros Emden 21/10",
            "Heros Wilhemshaven 21/10"
        ];

        // Initialisiere Lösungswörter (in Uppercase)
        this.predefinedLoesungswoerter = [
            "Funkverkehr", "Rettungswagen", "Notruf", "Blaulicht", "Funkdisziplin",
            "Einsatzleitung", "Mikrofon", "Durchsage", "Sprechgruppe", "Digitalfunk",
            "Frequenz", "Funkstille", "Antennenmast", "Feuerwehr", "Katastrophenschutz",
            "Alarmierung", "Fernmelder", "Kommunikation", "Verständigung", "Sicherheitszone",
            "Einsatzplan", "Koordination", "Funkgerät", "Signalstärke", "Verbindung",
            "Repeater", "Einsatzbesprechung", "Lautstärke", "Funkkanal", "Empfang",
            "Relaisstation", "Funkraum", "Gruppenruf", "Rückmeldung", "Einsatzgebiet",
            "Wellenlänge", "Übertragung", "Ausfallsicherheit", "Rescue", "Einsatzwagen"
        ].map(word => word.toUpperCase());

        // Vorlagen für Funksprüche
        this.templatesFunksprueche = {
            vorlage1: { text: "Kurze Funksprüche", filename: "funksprueche_normal.txt" },
            vorlage2: { text: "Lange Funksprüche", filename: "funksprueche_lang.txt" }
        };

        // Initiale Übungseinstellungen
        this.spruecheProTeilnehmer = 50;
        this.spruecheAnAlle = 3;
        this.spruecheAnMehrere = 2;
        this.leitung = "Heros Wind 10";
        this.rufgruppe = "T_OL_GOLD-1";
        this.nameDerUebung = "Sprechfunkübung Blauer Wind 2025";

        // Weitere Variablen für die Übung
        this.datum = null;
        this.natoDate = null;
        this.jsonUebungsDaten = [];
        this.htmlUebungsDaten = [];
        this.loesungswoerter = {};
        this.jsonKompletteUebung = {};
        this.currentPageIndex = 0;

        // Rufe die Funktion beim Laden der Seite auf
        document.addEventListener("DOMContentLoaded", this.setDefaultDate);

        // Rufe beim Laden der Seite die Funktion auf, um die Select-Box zu füllen
        this.populateTemplateSelectBox();

        this.renderInitData();
    }

    updateVerteilung() {
        updateAbsolute('alle');
        updateAbsolute('mehrere');
    }

    updateAbsolute(type) {
        let total = Number(document.getElementById("spruecheProTeilnehmer").value);
        let percentInput = document.getElementById(`prozentAn${capitalize(type)}`);
        let calcSpan = document.getElementById(`calcAn${capitalize(type)}`);
        let hiddenInput = document.getElementById(`spruecheAn${capitalize(type)}`);

        let percentageValue = Number(percentInput.value);
        let absoluteValue = Math.round((percentageValue / 100) * total);

        calcSpan.textContent = absoluteValue;
        hiddenInput.value = absoluteValue;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    renderInitData() {
        document.getElementById("spruecheProTeilnehmer").value = this.spruecheProTeilnehmer;
        document.getElementById("spruecheAnAlle").value = this.spruecheAnAlle;
        document.getElementById("spruecheAnMehrere").value = this.spruecheAnMehrere;
        document.getElementById("leitung").value = this.leitung;
        document.getElementById("rufgruppe").value = this.rufgruppe;
        document.getElementById("nameDerUebung").value = this.nameDerUebung;

        this.renderTeilnehmer();
    }

    renderTeilnehmer(triggerShuffle = true) {
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
        this.teilnehmerListe.forEach((teilnehmer, index) => {
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
            this.shuffleLoesungswoerter();
        }
    }

    updateTeilnehmer(index, value) {
        teilnehmerListe[index] = value;
    }

    addTeilnehmer() {
        teilnehmerListe.push("");
        renderTeilnehmer();
    }

    removeTeilnehmer(index) {
        teilnehmerListe.splice(index, 1);
        renderTeilnehmer();
    }

    toggleFunkspruchInput() {
        const useCustomList = document.getElementById("useCustomList").checked;
        document.getElementById("fileUploadContainer").style.display = useCustomList ? "block" : "none";
    }

    startUebung() {
        const selectedTemplate = document.getElementById("funkspruchVorlage").value; // Die ausgewählte Vorlage
        const file = document.getElementById("funksprueche").files[0] ?? ""; // Die manuell hochgeladene Datei, falls vorhanden

        // Berechnungen und weitere Funktionen wie vorher...
        this.spruecheProTeilnehmer = Number(document.getElementById("spruecheProTeilnehmer").value);
        this.spruecheAnAlle = Number(document.getElementById("spruecheAnAlle").value);
        this.spruecheAnMehrere = Number(document.getElementById("spruecheAnMehrere").value);
        this.leitung = document.getElementById("leitung").value;
        this.rufgruppe = document.getElementById("rufgruppe").value;
        this.nameDerUebung = document.getElementById("nameDerUebung").value;

        this.datum = new Date(document.getElementById("datum").value + "T00:00:00");
        this.natoDate = DateFormatter.formatNATODate(this.datum, false);

        this.jsonKompletteUebung = this.generateExerciseJSON();
        console.log(this.jsonKompletteUebung)

        // Wenn eine Vorlage aus der select-Box ausgewählt wurde (nicht "Manuelle Datei hochladen")
        if (selectedTemplate !== "upload") {
            // Holen Sie sich die Vorlage basierend auf dem Auswahlwert
            const template = this.templatesFunksprueche[selectedTemplate];

            if (template) {
                console.log(`Verwende Vorlage: ${template.text}`);
                // Hier können wir die Vorlage weiter verwenden, z.B. um Funksprüche zu generieren
                // Falls notwendig, laden Sie die Datei, wenn sie benötigt wird

                fetch(template.filename)
                    .then(response => response.text())
                    .then(data => {
                        // Wenn die Datei erfolgreich geladen wurde, rufen wir `generateAllPages` auf
                        let funksprueche = data.split("\n").filter(s => s.trim() !== "").sort(() => Math.random() - 0.5);
                        this.generateAllPages(funksprueche);  // Übergebe die geladenen Funksprüche an generateAllPages
                    })
                    .catch(error => console.error('Fehler beim Laden der Vorlage:', error));
            } else {
                console.error("Vorlage nicht gefunden.");
            }
        } else if (selectedTemplate == "upload" && file) {
            // Wenn die benutzerdefinierte Funkspruch-Liste aktiviert ist und eine Datei hochgeladen wurde
            const reader = new FileReader();
            reader.onload = function (event) {
                let funksprueche = event.target.result.split("\n").filter(s => s.trim() !== "").sort(() => Math.random() - 0.5);
                this.generateAllPages(funksprueche);
            };
            reader.readAsText(file);
        } else {
            // Fehlerbehandlung, wenn keine Datei hochgeladen wurde und keine Vorlage ausgewählt wurde
            console.error("Bitte wählen Sie eine Vorlage oder laden Sie eine benutzerdefinierte Funkspruchliste hoch.");
            alert("Bitte wählen Sie eine Vorlage oder laden Sie eine benutzerdefinierte Funkspruchliste hoch.");
        }


        document.getElementById("output-container").style.display = "block";
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
    verteileNachrichten(totalMessages, anzahlAlle, anzahlMehrere) {
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
    getRandomSubsetOfOthers(teilnehmerListe, aktuellerTeilnehmer) {
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
    getRandomOther(teilnehmerListe, aktuellerTeilnehmer) {
        // 1) Filter: Wer ist "nicht ich"?
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);

        // 2) Zufälligen Index bestimmen
        const randomIndex = Math.floor(Math.random() * andere.length);

        // 3) Zurückgeben
        return andere[randomIndex];
    }

    generiereUebung(funksprueche) {
        this.spruecheProTeilnehmer--;

        // Generiere Übung ohne Lösungsbuchstaben
        let uebungsDaten = this.teilnehmerListe.map(teilnehmer => {
            return {
                teilnehmer,
                kopfdaten: {
                    datum: this.natoDate,
                    nameDerUebung: this.nameDerUebung,
                    leitung: this.leitung,
                    teilnehmer: this.teilnehmerListe,
                    rufgruppe: this.rufgruppe
                },
                nachrichten: this.generiereNachrichten(this.teilnehmer, funksprueche),
                loesungswort: this.loesungswoerter[teilnehmer] || "" // Speichere das Lösungswort mit ab
            };
        });

        // Jetzt die Lösungsbuchstaben verteilen
        this.verteileLoesungswoerter(uebungsDaten);

        return uebungsDaten;
    }

    /**
     * Generiert alle Nachrichten für einen Teilnehmer.
     */
    generiereNachrichten(teilnehmer, funksprueche) {
        let gemischteFunksprueche = [...funksprueche].sort(() => 0.5 - Math.random());
        let nachrichtenVerteilung = this.verteileNachrichten(this.spruecheProTeilnehmer, this.spruecheAnAlle, this.spruecheAnMehrere);

        let nachrichten = [];

        // Erste Nachricht: Anmeldung
        nachrichten.push({
            id: 1,
            nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
            empfaenger: [this.leitung]
        });

        for (let i = 0; i < this.spruecheProTeilnehmer; i++) {
            let nachricht = {};
            nachricht.id = i + 2;
            nachricht.nachricht = gemischteFunksprueche[i];

            if (nachrichtenVerteilung.alle.includes(i)) {
                nachricht.empfaenger = ["Alle"];
            } else if (nachrichtenVerteilung.mehrere.includes(i)) {
                nachricht.empfaenger = this.getRandomSubsetOfOthers(this.teilnehmerListe, teilnehmer);
            } else {
                nachricht.empfaenger = [this.getRandomOther(this.teilnehmerListe, teilnehmer)];
            }
            nachrichten.push(nachricht);
        }

        return nachrichten;
    }

    /**
     * Verteilt die Lösungsbuchstaben zufällig auf Nachrichten an den Empfänger,
     * aber mit ihrem ursprünglichen Index (+1), damit das Wort zusammengesetzt werden kann.
     */
    verteileLoesungswoerter(uebungsDaten) {
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
    generateAllPages(funksprueche) {
        this.jsonUebungsDaten = this.generiereUebung(funksprueche);
        this.htmlUebungsDaten = this.jsonUebungsDaten.map(data => this.generateHTMLPage(data));
        this.currentPageIndex = 0;
        this.jsonKompletteUebung.uebungsDaten = this.jsonUebungsDaten;
        this.jsonKompletteUebung.checksumme = this.generateMD5Hash(this.jsonKompletteUebung);


        if (this.htmlUebungsDaten.length > 0) {
            this.displayPage(this.currentPageIndex);

            this.zeigeUebungsdauer();
            this.startVerteilung();
        }
    }

    /**
     * Zeigt die aktuelle Seite im iframe an.
     */
    displayPage(index) {
        if (index < 0 || index >= this.htmlUebungsDaten.length) return;

        const iframe = document.getElementById("resultFrame");
        iframe.srcdoc = this.htmlUebungsDaten[index]; // Lädt den HTML-Code direkt in das iframe

        document.getElementById("current-page").textContent = `Seite ${index + 1} / ${this.htmlUebungsDaten.length}`;
    }

    /**
     * Wechselt zur nächsten oder vorherigen Seite.
     * @param {number} step - 1 für weiter, -1 für zurück
     */
    changePage(step) {
        const newIndex = currentPageIndex + step;
        if (newIndex >= 0 && newIndex < this.htmlUebungsDaten.length) {
            currentPageIndex = newIndex;
            displayPage(currentPageIndex);
        }
    }

    /**
     * Erstellt die HTML-Struktur für eine einzelne Übungsseite.
     * 
     * @param {Object} teilnehmerDaten - JSON-Objekt für einen Teilnehmer
     * @returns {string} - HTML-Code als String
     */
    generateHTMLPage(teilnehmerDaten) {
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

    generatePDFs() {
        pdfGenerator.generateTeilnehmerPDFs(this.jsonUebungsDaten);
    }

    // Funktion zum Umschalten der Lösungswort-Optionen
    toggleLoesungswortOption() {
        let option = document.querySelector('input[name="loesungswortOption"]:checked').value;

        document.getElementById("zentralesLoesungswortContainer").style.display = option === "gleich" ? "block" : "none";

        // Zeigt/hide die Lösungswort-Spalte in der Teilnehmerliste
        document.getElementById("loesungswortColumn").style.display = option === "individuell" ? "table-cell" : "none";

        // Aktualisiert die Teilnehmerliste mit Lösungswörtern (falls benötigt)
        renderTeilnehmer();
    }

    generateInstructorPDF() {
        pdfGenerator.generateInstructorPDF(this.jsonUebungsDaten);
    }


    setLoesungswoerter() {
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

    assignRandomLoesungswoerter() {
        // Shuffle-Algorithmus für zufällige Verteilung
        let shuffledWords = [...predefinedLoesungswoerter].sort(() => Math.random() - 0.5);

        teilnehmerListe.forEach((teilnehmer, index) => {
            loesungswoerter[teilnehmer] = shuffledWords[index % shuffledWords.length];
        });
    }

    shuffleLoesungswoerter() {
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

        this.renderTeilnehmer(false); // WICHTIG: Setze `triggerShuffle = false`, um Endlosschleife zu vermeiden
    }

    // Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
    // Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
    berechneUebungsdauer(nachrichtenDaten) {
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
    formatDuration(zeitInMinuten) {
        const stunden = Math.floor(zeitInMinuten / 60);
        const minuten = Math.floor(zeitInMinuten % 60);

        return {
            stunden: stunden,
            minuten: minuten
        };
    }

    // Integration der Daueranzeige
    zeigeUebungsdauer() {
        let uebungsDauer = this.berechneUebungsdauer(this.jsonUebungsDaten.flatMap(t => t.nachrichten));

        // Umrechnung der Zeiten in Stunden und Minuten
        const optimalFormatted = this.formatDuration(uebungsDauer.optimal);
        const schlechtFormatted = this.formatDuration(uebungsDauer.schlecht);
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

    berechneVerteilungUndZeigeDiagramm() {
        const labels = [];
        const messageCounts = []; // Hier speichern wir die empfangenen Nachrichten
        const nachrichtenVerteilung = {}; // Hier speichern wir die Verteilung der Nachrichten pro Teilnehmer

        // Iteriere über alle Übungsdaten und berechne die empfangenen Nachrichten
        this.jsonUebungsDaten.forEach(uebung => {
            let teilnehmer = uebung.teilnehmer;
            if (teilnehmer !== leitung) {  // Übungsleitung wird ignoriert
                labels.push(teilnehmer);  // Füge Teilnehmer zur Labels-Liste hinzu

                // Initialisiere die Zählung für diesen Teilnehmer
                if (!nachrichtenVerteilung[teilnehmer]) {
                    nachrichtenVerteilung[teilnehmer] = 0;
                }
            }
        });

        // Iteriere über alle Übungsdaten und berechne die empfangenen Nachrichten
        this.jsonUebungsDaten.forEach(uebung => {
            let teilnehmer = uebung.teilnehmer;
            if (teilnehmer !== leitung) {  // Übungsleitung wird ignoriert

                // Iteriere über alle Nachrichten der Übung
                uebung.nachrichten.forEach(nachricht => {
                    // Wenn die Nachricht an "Alle" gesendet wurde, wird sie zu jedem Empfänger gezählt
                    nachricht.empfaenger.forEach(empfaenger => {
                        if (empfaenger === "Alle") {
                            this.teilnehmerListe.forEach(teilnehmerAlle => {
                                if (teilnehmerAlle !== teilnehmer) {
                                    nachrichtenVerteilung[teilnehmerAlle]++;
                                }
                            })
                        } else {
                            nachrichtenVerteilung[empfaenger]++;
                        }
                    });
                    if (nachricht.empfaenger.includes(teilnehmer)) {
                        nachrichtenVerteilung[teilnehmer]++;
                    }
                });
            }
        });

        // Bereite die Daten für das Diagramm vor
        labels.forEach(teilnehmer => {
            messageCounts.push(nachrichtenVerteilung[teilnehmer] || 0); // Wenn keine Nachrichten für den Teilnehmer gezählt wurden, setze 0
        });

        // Überprüfen, ob bereits ein Chart existiert und zerstören, falls nötig
        if (window.chart) {
            window.chart.destroy();
        }

        // Erstelle das Balkendiagramm mit Chart.js
        window.chart = new Chart(document.getElementById("distributionChart"), {
            type: 'bar',
            data: {
                labels: labels,  // Die Teilnehmernamen
                datasets: [{
                    label: 'Empfangene Nachrichten',
                    data: messageCounts, // Anzahl der empfangenen Nachrichten
                    backgroundColor: '#4CAF50', // Balkenfarbe
                    borderColor: '#388E3C', // Randfarbe der Balken
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Teilnehmer'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Anzahl der Nachrichten'
                        }
                    }
                }
            }
        });
    }

    // Funktion zum Starten der Berechnung und Anzeige des Diagramms
    startVerteilung() {
        this.berechneVerteilungUndZeigeDiagramm();
    }

    generateNachrichtenvordruckPDFs() {
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        pdfGenerator.generateNachrichtenvordruckPDFs(this.jsonUebungsDaten, templateImageUrl);
    }

    generateMeldevordruckPDFs() {
        const templateImageUrl = 'assets/meldevordruck.png';
        pdfGenerator.generateMeldevordruckPDFs(this.jsonUebungsDaten, templateImageUrl);
    }


    /**
     * Funktion zum Anpassen der Textgröße, damit der Text in die angegebene Breite passt
     */
    adjustTextForWidth(pdf, text, maxWidth, xPos, yPos) {
        let fontSize = 12; // Anfangsschriftgröße
        let textWidth = pdf.getTextWidth(text);

        // Wenn der Text zu lang ist, die Schriftgröße verringern
        while (textWidth > maxWidth && fontSize > 5) {
            fontSize -= 0.5;
            pdf.setFontSize(fontSize);
            textWidth = pdf.getTextWidth(text);
        }

        // Text mit angepasster Größe hinzufügen
        pdf.text(text, xPos, yPos);
    }


    // Funktion zum Befüllen der Select-Box mit den Vorlagen
    populateTemplateSelectBox() {
        const selectBox = document.getElementById("funkspruchVorlage");

        // Iteriere durch die Vorlagen und füge sie der Select-Box hinzu
        for (const [key, value] of Object.entries(this.templatesFunksprueche)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = `${value.text}`; // Hier kannst du den anzuzeigenden Text anpassen
            selectBox.appendChild(option);
        }

        const option = document.createElement("option");
        option.value = "upload";
        option.textContent = `Manuelle Datei hochladen`; // Hier kannst du den anzuzeigenden Text anpassen
        selectBox.appendChild(option);
    }

    // Funktion zur Anzeige des Datei-Upload-Feldes
    toggleFileUpload() {
        const selectedValue = document.getElementById("funkspruchVorlage").value;
        const fileUploadContainer = document.getElementById("fileUploadContainer");

        if (selectedValue === "upload") {
            fileUploadContainer.style.display = "block"; // Zeige Datei-Upload-Feld an
        } else {
            fileUploadContainer.style.display = "none"; // Verstecke Datei-Upload-Feld
            loadTemplate(selectedValue); // Lade die ausgewählte Vorlage
        }
    }

    // Funktion zum Laden der Vorlage
    loadTemplate(templateName) {
        const selectedTemplate = this.templatesFunksprueche[templateName];
        if (selectedTemplate) {
            // Zum Testen: Zeige den Text der Vorlage (dies kann an anderer Stelle verwendet werden)
            console.log(`Vorlage geladen: ${selectedTemplate.text}`);

            // Hier kannst du den Text der Vorlage verwenden, z.B. beim Generieren der Funksprüche
            // Falls du die Datei laden möchtest, kannst du die `filename`-Eigenschaft verwenden
            loadFile(selectedTemplate.filename);
        }
    }

    // Funktion zum Laden einer Datei
    loadFile(filename) {
        console.log(`Lade die Datei: ${filename}`);

        // Wenn es sich um eine vordefinierte Datei handelt, holen wir sie vom Server
        if (filename && templates[filename]) {
            fetch(`path/to/files/${filename}`)
                .then(response => response.text())  // Die Datei als Text laden
                .then(data => {
                    // Die geladenen Daten zurückgeben oder weiterverarbeiten
                    console.log("Dateiinhalt:", data);
                    // Hier kannst du die Daten weiterverwenden oder an eine andere Funktion übergeben
                    processLoadedFile(data); // Zum Beispiel die Daten verarbeiten
                })
                .catch(error => {
                    console.error("Fehler beim Laden der Datei:", error);
                });
        }
        // Falls es sich um eine manuell hochgeladene Datei handelt
        else if (filename === "upload" && document.getElementById("funksprueche").files.length > 0) {
            const file = document.getElementById("funksprueche").files[0];
            const reader = new FileReader();
            reader.onload = function (event) {
                const fileContent = event.target.result;  // Der Inhalt der hochgeladenen Datei
                console.log("Manuell hochgeladene Datei:", fileContent);
                processLoadedFile(fileContent); // Die Datei weiterverarbeiten
            };
            reader.onerror = function (error) {
                console.error("Fehler beim Lesen der Datei:", error);
            };
            reader.readAsText(file);  // Die Datei als Text lesen
        } else {
            console.error("Keine Datei ausgewählt oder ungültige Vorlage.");
        }
    }

    // Funktion, um das aktuelle Datum im Datumsfeld vorzufüllen
    setDefaultDate() {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        document.getElementById("datum").value = formattedDate;
    }

    generateExerciseJSON() {
        let exerciseData = {
            meta: {
                datum: document.getElementById("datum").value,
                nameDerUebung: document.getElementById("nameDerUebung").value,
                rufgruppe: document.getElementById("rufgruppe").value,
                leitung: document.getElementById("leitung").value
            },
            einstellungen: {
                spruecheProTeilnehmer: Number(document.getElementById("spruecheProTeilnehmer").value),
                spruecheAnAlle: Number(document.getElementById("spruecheAnAlle").value),
                spruecheAnMehrere: Number(document.getElementById("spruecheAnMehrere").value),
                funkspruchVorlage: document.getElementById("funkspruchVorlage").value,
                benutzerdefinierteDatei: document.getElementById("funksprueche").files.length > 0
            },
            loesungswoerter: {
                modus: document.querySelector('input[name="loesungswortOption"]:checked')?.id || "keine",
                zentralLoesungswort: document.getElementById("zentralLoesungswortInput")?.value || null,
                individuelleLoesungswoerter: { ...this.loesungswoerter }
            },
            teilnehmer: [...this.teilnehmerListe],
            uebungsDaten: {} // Hier sind die generierten Funksprüche enthalten
        };

        return exerciseData;
    }

    generateMD5Hash(input) {
        return CryptoJS.MD5(input).toString();
    }
}

window.app = new AppController();