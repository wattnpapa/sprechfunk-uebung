import pdfGenerator from './pdfGenerator.js';
import { DateFormatter } from "./DateFormatter.js";
import { FunkUebung } from "./FunkUebung.js";
import { UebungHTMLGenerator } from './UebungHTMLGenerator.js';




export class AppController {

    constructor() {
        console.log("📌 AppController wurde initialisiert");

        let buildInfo = "dev";

        this.funkUebung = new FunkUebung(buildInfo);

        fetch("build.json")
            .then(res => res.json())
            .then(data => {
                console.log(data);
                buildInfo = data.buildDate + "-" + data.runNumber + "-" + data.commit;
                

            })
            .catch(() => {
                console.warn("⚠️ Build-Info nicht gefunden, setze 'dev'");
            }).finally(() => {
                document.getElementById(`version`).innerHTML = buildInfo;
                this.funkUebung.buildVersion = buildInfo;
            });


        

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
            vorlage1: { text: "Kurze Funksprüche", filename: "assets/funksprueche/funksprueche_normal.txt" },
            vorlage2: { text: "Lange Funksprüche", filename: "assets/funksprueche/funksprueche_lang.txt" },
            vorlage3: { text: "Lustige Funksprüche", filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt" }
        };

        // Weitere Variablen für die Übung
        this.natoDate = null;
        this.jsonUebungsDaten = [];
        this.jsonKompletteUebung = {};
        this.htmlSeitenTeilnehmer = [];
        this.currentPageIndex = 0;

        // Rufe die Funktion beim Laden der Seite auf
        document.addEventListener("DOMContentLoaded", this.setDefaultDate);

        // Rufe beim Laden der Seite die Funktion auf, um die Select-Box zu füllen
        this.populateTemplateSelectBox();

        this.renderInitData();
    }

    updateVerteilung() {
        this.updateAbsolute('alle');
        this.updateAbsolute('mehrere');
    }

    updateAbsolute(type) {
        let total = Number(document.getElementById("spruecheProTeilnehmer").value);
        let percentInput = document.getElementById(`prozentAn${this.capitalize(type)}`);
        let calcSpan = document.getElementById(`calcAn${this.capitalize(type)}`);
        let hiddenInput = document.getElementById(`spruecheAn${this.capitalize(type)}`);

        let percentageValue = Number(percentInput.value);
        let absoluteValue = Math.round((percentageValue / 100) * total);

        calcSpan.textContent = absoluteValue;
        hiddenInput.value = absoluteValue;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    renderInitData() {
        document.getElementById("spruecheProTeilnehmer").value = this.funkUebung.spruecheProTeilnehmer;
        document.getElementById("spruecheAnAlle").value = this.funkUebung.spruecheAnAlle;
        document.getElementById("spruecheAnMehrere").value = this.funkUebung.spruecheAnMehrere;
        document.getElementById("leitung").value = this.funkUebung.leitung;
        document.getElementById("rufgruppe").value = this.funkUebung.rufgruppe;
        document.getElementById("nameDerUebung").value = this.funkUebung.name;

        this.renderTeilnehmer();
    }

    renderTeilnehmer(triggerShuffle = true) {
        const container = document.getElementById("teilnehmer-container");
        container.innerHTML = ""; // Vorherigen Inhalt leeren

        let option = document.querySelector('input[name="loesungswortOption"]:checked')?.id;
        let isZentral = option === "zentralLoesungswort";
        let isIndividuell = option === "individuelleLoesungswoerter";

        document.getElementById("zentralLoesungswortContainer").style.display = isZentral ? "block" : "none";
        document.getElementById("shuffleButton").style.display = (isZentral || isIndividuell) ? "block" : "none";

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

        const tbody = document.getElementById("teilnehmer-body");
        if (!tbody) {
            console.error("Fehler: tbody-Element konnte nicht gefunden werden!");
            return;
        }

        // **Jeden Teilnehmer rendern**
        this.funkUebung.teilnehmerListe.forEach((teilnehmer, index) => {
            const row = document.createElement("tr");

            let loesungswortInput = "";
            if (isIndividuell) {
                let wort = this.funkUebung.loesungswoerter[teilnehmer] || "";
                loesungswortInput = `<td><input type="text" class="form-control loesungswort-input" id="loesungswort-${index}" value="${wort}" placeholder="Lösungswort"></td>`;
            }

            row.innerHTML = `
                <td>
                    <input type="text" class="form-control teilnehmer-input" data-index="${index}" value="${teilnehmer}">
                </td>
                ${loesungswortInput}
                <td><button class="btn btn-danger btn-sm delete-teilnehmer" data-index="${index}"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(row);
        });

        // **Event-Listener für Änderungen an Teilnehmernamen**
        document.querySelectorAll(".teilnehmer-input").forEach(input => {
            input.addEventListener("input", (event) => {
                let index = event.target.dataset.index;
                this.funkUebung.teilnehmerListe[index] = event.target.value;
            });
        });

        // **Event-Listener für das Entfernen von Teilnehmern**
        document.querySelectorAll(".delete-teilnehmer").forEach(button => {
            button.addEventListener("click", (event) => {
                let index = event.target.closest("button").dataset.index;
                this.removeTeilnehmer(index);
            });
        });

        // Falls `renderTeilnehmer` von einer Benutzerinteraktion kommt, neu verteilen
        if (triggerShuffle) {
            this.shuffleLoesungswoerter();
        }
    }

    updateTeilnehmer(index, value) {
        this.funkUebung.teilnehmerListe[index] = value;
    }

    addTeilnehmer() {
        this.funkUebung.teilnehmerListe.push("");
        this.renderTeilnehmer();
    }

    removeTeilnehmer(index) {
        this.funkUebung.teilnehmerListe.splice(index, 1);
        this.renderTeilnehmer();
    }

    toggleFunkspruchInput() {
        const useCustomList = document.getElementById("useCustomList").checked;
        document.getElementById("fileUploadContainer").style.display = useCustomList ? "block" : "none";
    }

    startUebung() {
        const selectedTemplate = document.getElementById("funkspruchVorlage").value; // Die ausgewählte Vorlage
        const file = document.getElementById("funksprueche").files[0] ?? ""; // Die manuell hochgeladene Datei, falls vorhanden

        // Berechnungen und weitere Funktionen wie vorher...
        this.funkUebung.spruecheProTeilnehmer = Number(document.getElementById("spruecheProTeilnehmer").value);
        this.funkUebung.spruecheAnAlle = Number(document.getElementById("spruecheAnAlle").value);
        this.funkUebung.spruecheAnMehrere = Number(document.getElementById("spruecheAnMehrere").value);
        this.funkUebung.leitung = document.getElementById("leitung").value;
        this.funkUebung.rufgruppe = document.getElementById("rufgruppe").value;
        this.funkUebung.name = document.getElementById("nameDerUebung").value;

        this.funkUebung.datum = new Date(document.getElementById("datum").value + "T00:00:00");
        this.natoDate = DateFormatter.formatNATODate(this.funkUebung.datum, false);

        this.readLoesungswoerter();

        // Wenn eine Vorlage aus der select-Box ausgewählt wurde (nicht "Manuelle Datei hochladen")
        if (selectedTemplate === "mix_all") {
            const allTemplates = Object.values(this.templatesFunksprueche);
            const fetchPromises = allTemplates.map(tpl =>
                fetch(tpl.filename).then(res => res.text())
            );
        
            Promise.all(fetchPromises)
                .then(results => {
                    // Mische alle Zeilen aus allen Dateien
                    this.funkUebung.funksprueche = results
                        .flatMap(text => text.split("\n").filter(s => s.trim() !== ""))
                        .sort(() => Math.random() - 0.5)
                        .sort(() => Math.random() - 0.5);
        
                    this.generateAllPages();
                })
                .catch(error => console.error("Fehler beim Laden mehrerer Vorlagen:", error));
        
        }
        else if (selectedTemplate !== "upload") {
            // Holen Sie sich die Vorlage basierend auf dem Auswahlwert
            const template = this.templatesFunksprueche[selectedTemplate];

            if (template) {
                //console.log(`Verwende Vorlage: ${template.text}`);
                // Hier können wir die Vorlage weiter verwenden, z.B. um Funksprüche zu generieren
                // Falls notwendig, laden Sie die Datei, wenn sie benötigt wird

                fetch(template.filename)
                    .then(response => response.text())
                    .then(data => {
                        // Wenn die Datei erfolgreich geladen wurde, rufen wir `generateAllPages` auf
                        this.funkUebung.funksprueche = data.split("\n").filter(s => s.trim() !== "");
                        //.sort(() => Math.random() - 0.5);

                        this.generateAllPages();  // Übergebe die geladenen Funksprüche an generateAllPages
                    })
                    .catch(error => console.error('Fehler beim Laden der Vorlage:', error));
            } else {
                console.error("Vorlage nicht gefunden.");
            }
        } else if (selectedTemplate == "upload" && file) {
            // Wenn die benutzerdefinierte Funkspruch-Liste aktiviert ist und eine Datei hochgeladen wurde
            const reader = new FileReader();
            reader.onload = function (event) {
                this.funkUebung.funksprueche = data.split("\n").filter(s => s.trim() !== "");

                this.generateAllPages();
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
     */
    generateAllPages() {
        this.htmlSeitenTeilnehmer = [];
        this.funkUebung.erstelle();
        this.funkUebung.teilnehmerListe.map(teilnehmer => {
            this.htmlSeitenTeilnehmer.push(UebungHTMLGenerator.generateHTMLPage(teilnehmer, this.funkUebung))
        });

        this.displayPage(this.currentPageIndex);
        this.zeigeUebungsdauer();
        this.startVerteilung();
        return;
    }

    /**
     * Zeigt die aktuelle Seite im iframe an.
     */
    displayPage(index) {
        if (index < 0 || index >= this.htmlSeitenTeilnehmer.length) return;

        const iframe = document.getElementById("resultFrame");
        iframe.srcdoc = this.htmlSeitenTeilnehmer[index]; // Lädt den HTML-Code direkt in das iframe

        document.getElementById("current-page").textContent = `Seite ${index + 1} / ${this.htmlSeitenTeilnehmer.length}`;
    }

    /**
     * Wechselt zur nächsten oder vorherigen Seite.
     * @param {number} step - 1 für weiter, -1 für zurück
     */
    changePage(step) {
        const newIndex = this.currentPageIndex + step;
        if (newIndex >= 0 && newIndex < this.htmlSeitenTeilnehmer.length) {
            this.currentPageIndex = newIndex;
            this.displayPage(this.currentPageIndex);
        }
    }

    generatePDFs() {
        pdfGenerator.generateTeilnehmerPDFs(this.funkUebung);
    }

    // Funktion zum Umschalten der Lösungswort-Optionen
    toggleLoesungswortOption() {
        let option = document.querySelector('input[name="loesungswortOption"]:checked').value;

        document.getElementById("zentralesLoesungswortContainer").style.display = option === "gleich" ? "block" : "none";

        // Zeigt/hide die Lösungswort-Spalte in der Teilnehmerliste
        document.getElementById("loesungswortColumn").style.display = option === "individuell" ? "table-cell" : "none";

        // Aktualisiert die Teilnehmerliste mit Lösungswörtern (falls benötigt)
        this.renderTeilnehmer();
    }

    generateInstructorPDF() {
        pdfGenerator.generateInstructorPDF(this.funkUebung);
    }


    setLoesungswoerter() {
        const isKeine = document.getElementById("keineLoesungswoerter").checked;
        const isZentral = document.getElementById("zentralLoesungswort").checked;
        const isIndividuell = document.getElementById("individuelleLoesungswoerter").checked;

        if (isKeine) {
            // Lösungswörter zurücksetzen
            this.funkUebung.loesungswoerter = {};
            document.getElementById("zentralLoesungswortInput").disabled = true;
            document.getElementById("zentralLoesungswortInput").value = "";
            document.getElementById("shuffleButton").disabled = true;
        } else if (isZentral) {
            // Zentrales Lösungswort setzen
            let zentralesWort = document.getElementById("zentralLoesungswortInput").value;
            this.funkUebung.teilnehmerListe.forEach(teilnehmer => {
                this.funkUebung.loesungswoerter[teilnehmer] = zentralesWort;
            });

            // Eingabefeld aktivieren
            document.getElementById("zentralLoesungswortInput").disabled = false;
            document.getElementById("shuffleButton").disabled = true;
        } else if (isIndividuell) {
            // Individuelle Wörter zuweisen
            this.assignRandomLoesungswoerter();
            document.getElementById("zentralLoesungswortInput").disabled = true;
            document.getElementById("shuffleButton").disabled = false;
        }

        renderTeilnehmer(); // UI aktualisieren
    }

    assignRandomLoesungswoerter() {
        // Shuffle-Algorithmus für zufällige Verteilung
        let shuffledWords = [...this.predefinedLoesungswoerter].sort(() => Math.random() - 0.5);

        this.funkUebung.teilnehmerListe.forEach((teilnehmer, index) => {
            this.funkUebung.loesungswoerter[teilnehmer] = shuffledWords[index % shuffledWords.length];
        });
    }

    shuffleLoesungswoerter() {
        const isZentral = document.getElementById("zentralLoesungswort").checked;
        const isIndividuell = document.getElementById("individuelleLoesungswoerter").checked;

        if (isZentral) {
            let zentralesWort = this.predefinedLoesungswoerter[Math.floor(Math.random() * this.predefinedLoesungswoerter.length)];
            document.getElementById("zentralLoesungswortInput").value = zentralesWort;
            this.funkUebung.teilnehmerListe.forEach(teilnehmer => {
                this.funkUebung.loesungswoerter[teilnehmer] = zentralesWort;
            });
        } else if (isIndividuell) {
            this.assignRandomLoesungswoerter();
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
        let uebungsDauer = this.berechneUebungsdauer(
            Object.values(this.funkUebung.nachrichten).flat()
        );
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
        this.funkUebung.teilnehmerListe.forEach(teilnehmer => {
            if (teilnehmer !== leitung) {  // Übungsleitung wird ignoriert
                labels.push(teilnehmer);  // Füge Teilnehmer zur Labels-Liste hinzu

                // Initialisiere die Zählung für diesen Teilnehmer
                if (!nachrichtenVerteilung[teilnehmer]) {
                    nachrichtenVerteilung[teilnehmer] = 0;
                }
            }
        });

        // Iteriere über alle Übungsdaten und berechne die empfangenen Nachrichten
        this.funkUebung.teilnehmerListe.forEach(teilnehmer => {
            if (teilnehmer !== leitung) {  // Übungsleitung wird ignoriert

                // Iteriere über alle Nachrichten der Übung
                this.funkUebung.nachrichten[teilnehmer].forEach(nachricht => {
                    // Wenn die Nachricht an "Alle" gesendet wurde, wird sie zu jedem Empfänger gezählt
                    nachricht.empfaenger.forEach(empfaenger => {
                        if (empfaenger === "Alle") {
                            this.funkUebung.teilnehmerListe.forEach(teilnehmerAlle => {
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
        pdfGenerator.generateNachrichtenvordruckPDFs(this.funkUebung);
    }

    generateMeldevordruckPDFs() {
        pdfGenerator.generateMeldevordruckPDFs(this.funkUebung);
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

        const mixedOption = document.createElement("option");
        mixedOption.value = "mix_all";
        mixedOption.textContent = "Alle Vorlagen mischen";
        selectBox.appendChild(mixedOption);

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

    generateMD5Hash(input) {
        return CryptoJS.MD5(input).toString();
    }

    readLoesungswoerter() {
        this.funkUebung.loesungswoerter = {};
        const isZentral = document.getElementById("zentralLoesungswort").checked;
        const zentralesWort = document.getElementById("zentralLoesungswortInput")?.value.trim().toUpperCase() || "";

        this.funkUebung.teilnehmerListe.forEach((teilnehmer, index) => {
            if (isZentral && zentralesWort) {
                this.funkUebung.loesungswoerter[teilnehmer] = zentralesWort;
            } else {
                const input = document.getElementById(`loesungswort-${index}`);
                if (input) {
                    this.funkUebung.loesungswoerter[teilnehmer] = input.value.trim().toUpperCase();
                }
            }
        });
    }
}

window.app = new AppController();
window.pdfGenerator = pdfGenerator;