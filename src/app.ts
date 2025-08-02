import pdfGenerator from './pdfGenerator.js';
import { DateFormatter } from "./DateFormatter.js";
import { Uebung } from "./types/Uebung.js";
import { UebungHTMLGenerator } from './UebungHTMLGenerator.js';
import { admin } from './admin.js';
import { initializeApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';
import 'jszip';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    orderBy,
    limit,
    startAfter
} from 'firebase/firestore';
import { Converter } from 'showdown';
import { FunkUebung } from './FunkUebung.js';
import type { Nachricht } from "./types/Nachricht.js";

// @ts-ignore: no types for chart.js
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
declare function gtag(command: 'event', eventName: string, params: Record<string, unknown>): void;

declare global {
    interface Window {
        chart: Chart;
        app: AppController;
        pdfGenerator: typeof pdfGenerator;
        admin: typeof admin;
    }
}

declare const bootstrap: any;

export class AppController {
    private db: Firestore;
    private pagination: {
        pageSize: number;
        currentPage: number;
        lastVisible: any;
        totalCount: number;
    };
    private funkUebung!: FunkUebung;
    private predefinedLoesungswoerter: string[] = [];
    private templatesFunksprueche: Record<string, { text: string; filename: string }> = {};
    private natoDate: string | null = null;
    private jsonUebungsDaten: any[] = [];
    private jsonKompletteUebung: Record<string, unknown> = {};
    private currentPageIndex: number = 0;
    private htmlSeitenTeilnehmer: string[] = [];

    constructor() {
        console.log("📌 AppController wurde initialisiert");

        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        this.pagination = {
            pageSize: 25,
            currentPage: 0,
            lastVisible: null,
            totalCount: 0
        };

        admin.db = this.db;
        admin.pagination = this.pagination;

        let buildInfo = "dev";

        fetch("build.json")
            .then(res => res.json())
            .then(data => {
                console.log(data);
                buildInfo = data.buildDate + "-" + data.runNumber + "-" + data.commit;
            })
            .catch(() => {
                console.warn("⚠️ Build-Info nicht gefunden, setze 'dev'");
            })
            .finally(async () => {
                const urlParams = new URLSearchParams(window.location.search);
                const uebungId = urlParams.get("id");

                if (uebungId) {
                    const docRef = doc(this.db, "uebungen", uebungId);
                    try {
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            this.funkUebung = Object.assign(new FunkUebung(buildInfo), data);
                            Object.assign(this.funkUebung, data);
                            console.log("📦 Übung aus Datenbank geladen:", this.funkUebung.id);
                            this.renderUebung();
                        } else {
                            console.warn("⚠️ Keine Übung mit dieser ID gefunden. Neue Übung wird erstellt.");
                            this.funkUebung = new FunkUebung(buildInfo);
                        }
                    } catch (err) {
                        console.error("❌ Fehler beim Laden der Übung:", err);
                        this.funkUebung = new FunkUebung(buildInfo);
                    }
                } else {
                    this.funkUebung = new FunkUebung(buildInfo);
                }

                document.getElementById("uebungsId")!.textContent = this.funkUebung.id;
                document.getElementById("version")!.innerHTML = buildInfo;
                this.funkUebung.buildVersion = buildInfo;
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
                    vorlageTHW: { text: "Funksprüche THW", filename: "assets/funksprueche/thw_funksprueche.txt" },
                    vorlageFeuerwehr: { text: "Funksprüche Feuerwehr", filename: "assets/funksprueche/feuerwehr_funksprueche.txt" },
                    vorlageResttungsdienst: { text: "Funksprüche Feuerwehr", filename: "assets/funksprueche/rettungsdienst_funksprueche.txt" },
                    vorlageLustig: { text: "Lustige Funksprüche", filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt" }
                };

                // Weitere Variablen für die Übung
                this.natoDate = null;
                this.jsonUebungsDaten = [];
                this.jsonKompletteUebung = {};
                //this.htmlSeitenTeilnehmer = [];
                this.currentPageIndex = 0;

                // Rufe die Funktion beim Laden der Seite auf
                document.addEventListener("DOMContentLoaded", this.setDefaultDate);

                // Rufe beim Laden der Seite die Funktion auf, um die Select-Box zu füllen
                this.populateTemplateSelectBox();

                this.renderInitData();

                if (urlParams.get("admin") !== null) {
                    admin.ladeAlleUebungen();
                    admin.renderUebungsStatistik();
                    document.getElementById("adminArea")!.style.display = "block";
                }

                // --- Globaler Button-Click-Tracking-Listener nach DOMContentLoaded ---
                document.addEventListener("click", (event) => {
                    const targetEl = event.target as HTMLElement | null;
                    if (targetEl && targetEl.closest("button")) {
                        const button = (targetEl.closest("button") as HTMLButtonElement)!;
                        const label = button.innerText.trim() || button.getAttribute("aria-label") || "Unbekannter Button";
                        if (typeof (window as any).gtag === "function") {
                            (window as any).gtag('event', 'button_click', {
                                'event_category': 'Interaktion',
                                'event_label': label
                            });
                        }
                    }
                });
                // --------------------------------------------------------------
            });

        document.addEventListener("DOMContentLoaded", function () {
            const modalContent = document.getElementById("howtoContent")! as HTMLElement;

            // Funktion zum Laden der Markdown-Datei
            function loadHowTo() {
                fetch('howto.md')
                    .then(response => response.text())
                    .then(data => {
                        const converter = new Converter();
                        modalContent.innerHTML = converter.makeHtml(data);
                    })
                    .catch(error => {
                        console.error('Fehler beim Laden der Anleitung:', error);
                        modalContent.innerHTML = 'Es gab einen Fehler beim Laden der Anleitung.';
                    });
            }

            // Laden der Anleitung, wenn das Modal geöffnet wird
            const howtoModal = document.getElementById('howtoModal')! as HTMLElement;
            howtoModal.addEventListener('show.bs.modal', loadHowTo);
        });

        document.addEventListener("DOMContentLoaded", function () {
            (document.querySelector('button[onclick="app.startUebung()"]')! as HTMLButtonElement)
                .addEventListener('click', function () {
                    gtag('event', 'Übung_generieren', {
                        'event_category': 'Button Click',
                        'event_label': 'Übung generieren Button geklickt'
                    });
                });

            (document.querySelector('button[onclick="app.generatePDFs()"]')! as HTMLButtonElement)
                .addEventListener('click', function () {
                    gtag('event', 'Teilnehmer_PDF_generieren', {
                        'event_category': 'Button Click',
                        'event_label': 'Teilnehmer PDFs generieren Button geklickt'
                    });
                });

            (document.querySelector('button[onclick="app.generateNachrichtenvordruckPDFs()"]')! as HTMLButtonElement)
                .addEventListener('click', function () {
                    gtag('event', 'Nachrichtenvordruck_PDF_generieren', {
                        'event_category': 'Button Click',
                        'event_label': 'Nachrichtenvordruck PDFs generieren Button geklickt'
                    });
                });

            (document.querySelector('button[onclick="app.generateInstructorPDF()"]')! as HTMLButtonElement)
                .addEventListener('click', function () {
                    gtag('event', 'Übungsleitung_PDF_generieren', {
                        'event_category': 'Button Click',
                        'event_label': 'Übungsleitung PDF erzeugen Button geklickt'
                    });
                });
        });
    }

    updateVerteilung() {
        this.updateAbsolute('alle');
        this.updateAbsolute('mehrere');
        this.updateAbsolute('buchstabieren');
    }

    updateAbsolute(type: string): void {
        const totalInput = document.getElementById("spruecheProTeilnehmer") as HTMLInputElement;
        const total = Number(totalInput.value);
        const percentInput = document.getElementById(`prozentAn${this.capitalize(type)}`) as HTMLInputElement;
        const calcSpan = document.getElementById(`calcAn${this.capitalize(type)}`)! as HTMLElement;
        const hiddenInput = document.getElementById(`spruecheAn${this.capitalize(type)}`) as HTMLInputElement;

        const percentageValue = Number(percentInput.value);
        const absoluteValue = Math.round((percentageValue / 100) * total);

        calcSpan.textContent = absoluteValue.toString();
        hiddenInput.value = absoluteValue.toString();
    }

    capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    renderInitData() {
        // Set input values with type assertions and toString()
        const spruecheProTeilnehmerInput = document.getElementById("spruecheProTeilnehmer") as HTMLInputElement;
        spruecheProTeilnehmerInput.value = this.funkUebung.spruecheProTeilnehmer.toString();
        const spruecheAnAlleInput = document.getElementById("spruecheAnAlle") as HTMLInputElement;
        spruecheAnAlleInput.value = this.funkUebung.spruecheAnAlle.toString();
        const spruecheAnMehrereInput = document.getElementById("spruecheAnMehrere") as HTMLInputElement;
        spruecheAnMehrereInput.value = this.funkUebung.spruecheAnMehrere.toString();
        const spruecheAnBuchstabierenInput = document.getElementById("spruecheAnBuchstabieren") as HTMLInputElement;
        spruecheAnBuchstabierenInput.value = this.funkUebung.buchstabierenAn.toString();

        // Prozentanzeige aktualisieren
        const total = this.funkUebung.spruecheProTeilnehmer * this.funkUebung.teilnehmerListe.length;
        (document.getElementById("calcAnAlle")! as HTMLElement).innerText = this.funkUebung.spruecheAnAlle.toString();
        (document.getElementById("calcAnMehrere")! as HTMLElement).innerText = this.funkUebung.spruecheAnMehrere.toString();
        (document.getElementById("calcAnBuchstabieren")! as HTMLElement).innerText = this.funkUebung.buchstabierenAn.toString();

        const prozentAnAlleInput = document.getElementById("prozentAnAlle") as HTMLInputElement;
        prozentAnAlleInput.value = Math.round((this.funkUebung.spruecheAnAlle / this.funkUebung.spruecheProTeilnehmer) * 100).toString();
        const prozentAnMehrereInput = document.getElementById("prozentAnMehrere") as HTMLInputElement;
        prozentAnMehrereInput.value = Math.round((this.funkUebung.spruecheAnMehrere / this.funkUebung.spruecheProTeilnehmer) * 100).toString();
        const prozentAnBuchstabierenInput = document.getElementById("prozentAnBuchstabieren") as HTMLInputElement;
        prozentAnBuchstabierenInput.value = Math.round((this.funkUebung.buchstabierenAn / this.funkUebung.spruecheProTeilnehmer) * 100).toString();

        const leitungInput = document.getElementById("leitung") as HTMLInputElement;
        leitungInput.value = this.funkUebung.leitung;
        const rufgruppeInput = document.getElementById("rufgruppe") as HTMLInputElement;
        rufgruppeInput.value = this.funkUebung.rufgruppe;
        const nameInput = document.getElementById("nameDerUebung") as HTMLInputElement;
        nameInput.value = this.funkUebung.name;

        // 📅 Datum
        const date = new Date(this.funkUebung.datum);
        const isoDate = date.toISOString().split("T")[0];
        const datumInput = document.getElementById("datum") as HTMLInputElement;
        datumInput.value = isoDate;

        this.renderTeilnehmer();

        document.addEventListener("DOMContentLoaded", () => {
            const inputBindings = [
                { id: "spruecheProTeilnehmer", handler: () => this.updateVerteilung() },
                { id: "prozentAnAlle", handler: () => this.updateAbsolute('alle') },
                { id: "prozentAnMehrere", handler: () => this.updateAbsolute('mehrere') },
                { id: "prozentAnBuchstabieren", handler: () => this.updateAbsolute('buchstabieren') }
            ];

            inputBindings.forEach(({ id, handler }) => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener("input", handler);
                }
            });
        });
    }

    renderTeilnehmer(triggerShuffle = true) {
        const container = document.getElementById("teilnehmer-container")! as HTMLElement;
        container.innerHTML = ""; // Vorherigen Inhalt leeren

        let option = document.querySelector('input[name="loesungswortOption"]:checked')?.id;
        let isZentral = option === "zentralLoesungswort";
        let isIndividuell = option === "individuelleLoesungswoerter";

        (document.getElementById("zentralLoesungswortContainer")! as HTMLElement).style.display = isZentral ? "block" : "none";
        (document.getElementById("shuffleButton")! as HTMLElement).style.display = (isZentral || isIndividuell) ? "block" : "none";

        container.innerHTML = `
            <table class="table table-bordered">
                <thead class="table-dark">
                    <tr>
                        <th>Funkrufnamen</th>
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
            input.addEventListener("input", (event: Event) => {
                const target = event.target as HTMLInputElement;
                const index = Number(target.dataset.index);
                this.funkUebung.teilnehmerListe[index] = target.value;
            });
        });

        // **Event-Listener für das Entfernen von Teilnehmern**
        document.querySelectorAll(".delete-teilnehmer").forEach(button => {
            button.addEventListener("click", (event: Event) => {
                const mouseEvent = event as MouseEvent;
                const target = mouseEvent.target! as HTMLElement;
                const btn = target.closest("button")! as HTMLButtonElement;
                const index = Number(btn.dataset.index);
                this.removeTeilnehmer(index);
            });
        });

        // Falls `renderTeilnehmer` von einer Benutzerinteraktion kommt, neu verteilen
        if (triggerShuffle) {
            this.shuffleLoesungswoerter();
        }
    }

    updateTeilnehmer(index: number, value: string): void {
        this.funkUebung.teilnehmerListe[index] = value;
    }

    addTeilnehmer() {
        this.funkUebung.teilnehmerListe.push("");
        this.renderTeilnehmer();
    }

    removeTeilnehmer(index: number): void {
        this.funkUebung.teilnehmerListe.splice(index, 1);
        this.renderTeilnehmer();
    }

    toggleFunkspruchInput(): void {
        const useCustomList = (document.getElementById("useCustomList")! as HTMLInputElement).checked;
        (document.getElementById("fileUploadContainer")! as HTMLElement).style.display = useCustomList ? "block" : "none";
    }

    startUebung() {
        // Cast the select and file input elements before accessing their properties
        const selectedTemplate = (document.getElementById("funkspruchVorlage") as HTMLSelectElement)!.value;
        const fileInput = document.getElementById("funksprueche") as HTMLInputElement;
        const file = fileInput.files?.[0] ?? "";

        // Berechnungen und weitere Funktionen wie vorher...
        const spruecheProTeilnehmerInput = document.getElementById("spruecheProTeilnehmer")! as HTMLInputElement;
        this.funkUebung.spruecheProTeilnehmer = Number(spruecheProTeilnehmerInput.value);
        const spruecheAnAlleInput = document.getElementById("spruecheAnAlle")! as HTMLInputElement;
        this.funkUebung.spruecheAnAlle = Number(spruecheAnAlleInput.value);
        const spruecheAnMehrereInput = document.getElementById("spruecheAnMehrere")! as HTMLInputElement;
        this.funkUebung.spruecheAnMehrere = Number(spruecheAnMehrereInput.value);
        const buchstabierenInput = document.getElementById("spruecheAnBuchstabieren")! as HTMLInputElement;
        this.funkUebung.buchstabierenAn = Number(buchstabierenInput.value);
        const leitungInput = document.getElementById("leitung")! as HTMLInputElement;
        this.funkUebung.leitung = leitungInput.value;
        const rufgruppeInput = document.getElementById("rufgruppe")! as HTMLInputElement;
        this.funkUebung.rufgruppe = rufgruppeInput.value;
        const nameInput = document.getElementById("nameDerUebung")! as HTMLInputElement;
        this.funkUebung.name = nameInput.value;
        const datumInput = document.getElementById("datum")! as HTMLInputElement;
        this.funkUebung.datum = new Date(datumInput.value + "T00:00:00");
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
            const reader = new FileReader();
            reader.onload = (event) => {
                // Cast event.target to FileReader and assert non-null
                const readerEvt = event.target as FileReader;
                const result = readerEvt.result;
                if (!(result instanceof ArrayBuffer)) {
                    console.error("❌ reader.result ist nicht vom Typ ArrayBuffer:", result);
                    return;
                }
                const buffer = result; // sicheres ArrayBuffer
                let text;

                try {
                    // Primärversuch: UTF-8 dekodieren
                    text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));

                    // Wenn Ersatzzeichen vorhanden sind, versuche stattdessen Windows-1252
                    if (text.includes("\uFFFD")) {
                        console.warn("⚠️ UTF-8 enthält ungültige Zeichen – versuche Windows-1252 als Fallback");
                        text = new TextDecoder("windows-1252", { fatal: false }).decode(new Uint8Array(buffer));
                    }
                } catch (err) {
                    console.error("❌ Fehler bei der Kodierungserkennung:", err);
                    alert("Die Datei konnte nicht als Text gelesen werden.");
                    return;
                }

                this.funkUebung.funksprueche = text
                    .split("\n")
                    .filter(s => s.trim() !== "");

                this.generateAllPages();
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Fehlerbehandlung, wenn keine Datei hochgeladen wurde und keine Vorlage ausgewählt wurde
            console.error("Bitte wählen Sie eine Vorlage oder laden Sie eine benutzerdefinierte Funkspruchliste hoch.");
            alert("Bitte wählen Sie eine Vorlage oder laden Sie eine benutzerdefinierte Funkspruchliste hoch.");
        }
    }


    /**
     * Verteilt die Lösungsbuchstaben zufällig auf Nachrichten an den Empfänger,
     * aber mit ihrem ursprünglichen Index (+1), damit das Wort zusammengesetzt werden kann.
     */
    verteileLoesungswoerter(
        uebungsDaten: { teilnehmer: string; loesungswort: string; nachrichten: Nachricht[] }[]
    ): void {
        uebungsDaten.forEach((empfaengerDaten: { teilnehmer: string; loesungswort: string; nachrichten: Nachricht[] }) => {
            let empfaenger = empfaengerDaten.teilnehmer;
            let loesungswort = empfaengerDaten.loesungswort.split(""); // Array der Buchstaben mit Index

            // Speichere den Original-Index für spätere Rekonstruktion, +1 für menschliche Lesbarkeit
            let buchstabenMitIndex = loesungswort.map((buchstabe: string, index: number) => ({ index: index + 1, buchstabe }));

            // Alle Nachrichten sammeln, die nur für diesen Teilnehmer bestimmt sind
            let empfaengerNachrichten: Nachricht[] = [];
            uebungsDaten.forEach((absenderDaten: { teilnehmer: string; loesungswort: string; nachrichten: Nachricht[] }) => {
                if (absenderDaten.teilnehmer !== empfaenger) {
                    absenderDaten.nachrichten.forEach((nachricht: Nachricht) => {
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
        this.funkUebung.erstelle();
        saveUebung(this.funkUebung, this.db);
        this.renderUebung();
        return;
    }

    renderUebung() {
        this.currentPageIndex = 0;
        this.htmlSeitenTeilnehmer = [];

        this.htmlSeitenTeilnehmer = this.funkUebung.teilnehmerListe.map(teilnehmer => {
            const html = UebungHTMLGenerator.generateHTMLPage(teilnehmer, this.funkUebung);
            return html;
        });

        this.displayPage(this.currentPageIndex);
        this.zeigeUebungsdauer();
        this.startVerteilung();
        this.updateUebungLinks()
        this.renderInputFromUebung();
        document.getElementById("output-container")!.style.display = "block";
    }

    renderInputFromUebung() {
        // 🔍 Lösungswörter erkennen
        const noneRadio = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
        const centralRadio = document.getElementById("zentralLoesungswort") as HTMLInputElement;
        const indivRadio = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
        let zentraleWorte = new Set(Object.values(this.funkUebung.loesungswoerter));
        if (Object.keys(this.funkUebung.loesungswoerter).length === 0) {
            noneRadio.checked = true;
        } else if (zentraleWorte.size === 1) {
            centralRadio.checked = true;
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).value = [...zentraleWorte][0];
        } else {
            indivRadio.checked = true;
        }

        // 📅 Datum
        const date = new Date(this.funkUebung.datum);
        const isoDate = date.toISOString().split("T")[0];
        (document.getElementById("datum")! as HTMLInputElement).value = isoDate;

        // 📝 Weitere Texteingaben
        (document.getElementById("nameDerUebung")! as HTMLInputElement).value = this.funkUebung.name || "";
        (document.getElementById("rufgruppe")! as HTMLInputElement).value = this.funkUebung.rufgruppe || "";
        (document.getElementById("leitung")! as HTMLInputElement).value = this.funkUebung.leitung || "";

        // 🔢 Funkspruch-Einstellungen
        (document.getElementById("spruecheProTeilnehmer")! as HTMLInputElement).value = this.funkUebung.spruecheProTeilnehmer.toString();

        // 📊 Prozentangaben aktualisieren
        const proTeilnehmer = this.funkUebung.spruecheProTeilnehmer || 1;
        const updateProzent = (idProzent: string, idAnzahl: string, wert: number): void => {
            const prozent = Math.round((wert / proTeilnehmer) * 100);
            (document.getElementById(idProzent)! as HTMLInputElement).value = prozent.toString();
            (document.getElementById(idAnzahl)! as HTMLInputElement).value = wert.toString();
            const span = document.getElementById("calc" + idAnzahl.charAt(0).toUpperCase() + idAnzahl.slice(1));
            if (span) span.textContent = wert.toString();
        };

        updateProzent("prozentAnAlle", "spruecheAnAlle", this.funkUebung.spruecheAnAlle || 0);
        updateProzent("prozentAnMehrere", "spruecheAnMehrere", this.funkUebung.spruecheAnMehrere || 0);
        updateProzent("prozentAnBuchstabieren", "spruecheAnBuchstabieren", this.funkUebung.buchstabierenAn || 0);

        // Teilnehmerliste inkl. Lösungswörter anzeigen
        this.renderTeilnehmer(false);
    }

    /* 
     * Berechne Aktualisierung nach Änderung Prozentwerte Nachrichtentypen
     */
    calcMsgCount() {
        const updateMsgCount = (
            idCalcTextResult: string,
            idCalcValueResult: string,
            idProzentVariable: string,
            idSpruecheProTeilnehmer: string
        ): void => {
            const spruecheInput = document.getElementById(idSpruecheProTeilnehmer) as HTMLInputElement;
            const percentInput = document.getElementById(idProzentVariable) as HTMLInputElement;
            const msgCount = Math.round(
                Number(spruecheInput.value) * Number(percentInput.value) / 100
            );
            const calcTextEl = document.getElementById(idCalcTextResult)! as HTMLElement;
            const calcValueInput = document.getElementById(idCalcValueResult)! as HTMLInputElement;

            calcTextEl.textContent = msgCount.toString();
            calcValueInput.value = msgCount.toString();
        }

        updateMsgCount("calcAnAlle", "spruecheAnAlle", "prozentAnAlle", "spruecheProTeilnehmer");
        updateMsgCount("calcAnMehrere", "spruecheAnMehrere", "prozentAnMehrere", "spruecheProTeilnehmer");
        updateMsgCount("calcAnBuchstabieren", "spruecheAnBuchstabieren", "prozentAnBuchstabieren", "spruecheProTeilnehmer");
    }

    /**
     * Zeigt die aktuelle Seite im iframe an.
     */
    displayPage(index: number): void {
        if (index < 0 || index >= this.htmlSeitenTeilnehmer.length) return;

        const iframe = document.getElementById("resultFrame")! as HTMLIFrameElement;
        iframe.srcdoc = this.htmlSeitenTeilnehmer[index]; // Lädt den HTML-Code direkt in das iframe

        (document.getElementById("current-page")! as HTMLElement).textContent = `Seite ${index + 1} / ${this.htmlSeitenTeilnehmer.length}`;
    }

    /**
     * Wechselt zur nächsten oder vorherigen Seite.
     * @param {number} step - 1 für weiter, -1 für zurück
     */
    changePage(step: number): void {
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
    toggleLoesungswortOption(): void {
        const optionInput = document.querySelector<HTMLInputElement>('input[name="loesungswortOption"]:checked')!;
        const option = optionInput.value;
        const container = document.getElementById("zentralesLoesungswortContainer")! as HTMLElement;
        container.style.display = option === "gleich" ? "block" : "none";
        const column = document.getElementById("loesungswortColumn")! as HTMLElement;
        column.style.display = option === "individuell" ? "table-cell" : "none";
        this.renderTeilnehmer();
    }

    generateInstructorPDF() {
        pdfGenerator.generateInstructorPDF(this.funkUebung);
    }


    setLoesungswoerter(): void {
        const isKeine = (document.getElementById("keineLoesungswoerter")! as HTMLInputElement).checked;
        const isZentral = (document.getElementById("zentralLoesungswort")! as HTMLInputElement).checked;
        const isIndividuell = (document.getElementById("individuelleLoesungswoerter")! as HTMLInputElement).checked;

        if (isKeine) {
            this.funkUebung.loesungswoerter = {};
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).disabled = true;
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).value = "";
            (document.getElementById("shuffleButton")! as HTMLButtonElement).disabled = true;
        } else if (isZentral) {
            const zentral = (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement)
                .value.trim().toUpperCase();
            this.funkUebung.teilnehmerListe.forEach(teilnehmer => {
                this.funkUebung.loesungswoerter[teilnehmer] = zentral;
            });
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).disabled = false;
            (document.getElementById("shuffleButton")! as HTMLButtonElement).disabled = true;
        } else if (isIndividuell) {
            this.assignRandomLoesungswoerter();
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).disabled = true;
            (document.getElementById("shuffleButton")! as HTMLButtonElement).disabled = false;
        }

        this.renderTeilnehmer();
    }

    assignRandomLoesungswoerter(): void {
        const shuffledWords = [...this.predefinedLoesungswoerter].sort(() => Math.random() - 0.5);
        this.funkUebung.teilnehmerListe.forEach((teilnehmer: string, index: number) => {
            this.funkUebung.loesungswoerter[teilnehmer] = shuffledWords[index % shuffledWords.length];
        });
    }

    shuffleLoesungswoerter(): void {
        const isZentral = (document.getElementById("zentralLoesungswort")! as HTMLInputElement).checked;
        const isIndividuell = (document.getElementById("individuelleLoesungswoerter")! as HTMLInputElement).checked;

        if (isZentral) {
            const zentralesWort = this.predefinedLoesungswoerter[
                Math.floor(Math.random() * this.predefinedLoesungswoerter.length)
            ];
            (document.getElementById("zentralLoesungswortInput")! as HTMLInputElement).value = zentralesWort;
            this.funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
                this.funkUebung.loesungswoerter[teilnehmer] = zentralesWort;
            });
        } else if (isIndividuell) {
            this.assignRandomLoesungswoerter();
        }

        this.renderTeilnehmer(false);
    }

    // Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
    // Funktion zur Berechnung der Gesamtdauer in Minuten und der durchschnittlichen Zeit pro Funkspruch
    berechneUebungsdauer(nachrichtenDaten: Nachricht[]): {
        optimal: number;
        schlecht: number;
        durchschnittOptimal: number;
        durchschnittSchlecht: number;
    } {
        let gesamtDauerOptimal = 0;
        let gesamtDauerSchlecht = 0;
        let totalMessages = 0;

        nachrichtenDaten.forEach((nachricht: Nachricht) => {
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
    formatDuration(zeitInMinuten: number): { stunden: number; minuten: number } {
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
        (document.getElementById("dauerOptimalMinuten")! as HTMLElement).innerText = `${minutenOptimal.toFixed()} Min`;
        (document.getElementById("dauerOptimalStundenMinuten")! as HTMLElement).innerText = `${optimalFormatted.stunden} Std ${optimalFormatted.minuten.toFixed(0)} Min`;
        (document.getElementById("durchschnittOptimal")! as HTMLElement).innerText = `${durchschnittOptimal.toFixed(2)} Sek`;

        (document.getElementById("dauerLangsamMinuten")! as HTMLElement).innerText = `${minutenSchelcht.toFixed()} Min`;
        (document.getElementById("dauerLangsamStundenMinuten")! as HTMLElement).innerText = `${schlechtFormatted.stunden} Std ${schlechtFormatted.minuten.toFixed(0)} Min`;
        (document.getElementById("durchschnittLangsam")! as HTMLElement).innerText = `${durchschnittSchlecht.toFixed(2)} Sek`;
    }

    berechneVerteilungUndZeigeDiagramm() {
        const labels: string[] = [];
        const messageCounts: number[] = []; // Hier speichern wir die empfangenen Nachrichten
        const nachrichtenVerteilung: Record<string, number> = {}; // Hier speichern wir die Verteilung der Nachrichten pro Teilnehmer
        const leitung = this.funkUebung.leitung; // Übungsleitung zur Ignorierung speichern

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
        window.chart = new Chart(document.getElementById("distributionChart")! as HTMLCanvasElement, {
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
    adjustTextForWidth(pdf: any, text: string, maxWidth: number, xPos: number, yPos: number): void {
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
        const selectBox = document.getElementById("funkspruchVorlage")! as HTMLSelectElement;

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
        const selectBox = document.getElementById("funkspruchVorlage")! as HTMLSelectElement;
        const selectedValue = selectBox.value;
        const fileUploadContainer = document.getElementById("fileUploadContainer")! as HTMLElement;

        if (selectedValue === "upload") {
            fileUploadContainer.style.display = "block"; // Zeige Datei-Upload-Feld an
        } else {
            fileUploadContainer.style.display = "none"; // Verstecke Datei-Upload-Feld
            this.loadTemplate(selectedValue); // Lade die ausgewählte Vorlage
        }
    }

    // Funktion zum Laden der Vorlage
    loadTemplate(templateName: string): void {
        const selectedTemplate = this.templatesFunksprueche[templateName];
        if (selectedTemplate) {
            // Zum Testen: Zeige den Text der Vorlage (dies kann an anderer Stelle verwendet werden)
            console.log(`Vorlage geladen: ${selectedTemplate.text}`);

            // Hier kannst du den Text der Vorlage verwenden, z.B. beim Generieren der Funksprüche
            // Falls du die Datei laden möchtest, kannst du die `filename`-Eigenschaft verwenden
            this.loadFile(selectedTemplate.filename);
        }
    }

    // Funktion zum Laden einer Datei
    loadFile(filename: string): void {
        console.log(`Lade die Datei: ${filename}`);
        fetch(filename)
            .then(response => response.text())
            .then(data => {
                console.log("Dateiinhalt:", data);
                // hier weiterverarbeiten falls nötig
            })
            .catch(error => {
                console.error("Fehler beim Laden der Datei:", error);
            });
    }

    // Funktion, um das aktuelle Datum im Datumsfeld vorzufüllen
    setDefaultDate() {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        (document.getElementById("datum")! as HTMLInputElement).value = formattedDate;
    }

    generateMD5Hash(input: string): string {
        return CryptoJS.MD5(input).toString();
    }

    readLoesungswoerter() {
        this.funkUebung.loesungswoerter = {};
        const isZentral = (document.getElementById("zentralLoesungswort")! as HTMLInputElement).checked;
        const zentralInput = document.getElementById("zentralLoesungswoertInput")! as HTMLInputElement;
        const zentralesWort = zentralInput.value.trim().toUpperCase() || "";

        this.funkUebung.teilnehmerListe.forEach((teilnehmer, index) => {
            if (isZentral && zentralesWort) {
                this.funkUebung.loesungswoerter[teilnehmer] = zentralesWort;
            } else {
                const input = document.getElementById(`loesungswort-${index}`) as HTMLInputElement | null;
                if (input) {
                    this.funkUebung.loesungswoerter[teilnehmer] = input.value.trim().toUpperCase();
                }
            }
        });
    }

    exportUebungAsJSON(): void {
        document.getElementById("jsonOutput")!.textContent = this.funkUebung.toJson();
        const modal = new bootstrap.Modal(document.getElementById('jsonModal')! as HTMLElement);
        modal.show();
    }

    copyJSONToClipboard(): void {
        const text = document.getElementById("jsonOutput")!.textContent!;
        navigator.clipboard.writeText(text).then(() => {
            alert("✅ JSON wurde in die Zwischenablage kopiert!");
        }).catch(err => {
            alert("❌ Fehler beim Kopieren: " + err);
        });
    }

    updateUebungLinks(): void {
        const linkContainer = document.getElementById("uebung-links")! as HTMLElement;
        const linkElement = document.getElementById("link-uebung-direkt")! as HTMLAnchorElement;
        if (this.funkUebung.id) {
            const url = `${window.location.origin}${window.location.pathname}?id=${this.funkUebung.id}`;
            linkElement.href = url;
            linkElement.textContent = url;
            linkContainer.style.display = "block";
        }
    }

}

export async function saveUebung(funkUebung: FunkUebung, db: Firestore): Promise<void> {
    const uebungRef = doc(db, "uebungen", funkUebung.id);
    try {
        await setDoc(uebungRef, JSON.parse(funkUebung.toJson()));
        console.log("✅ Übung erfolgreich gespeichert:", funkUebung.id);
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Übung:", error);
    }
}

window.app = new AppController();
window.pdfGenerator = pdfGenerator;
window.admin = admin;
