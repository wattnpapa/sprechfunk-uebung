// =========================
// UI / Theme / Header Logic
// =========================

import type { AppMode } from "./appModes";
import { initUebungsleitung } from "./uebungsleitung";
import { initTeilnehmer } from "./teilnehmer";
import { router } from "./router";
import { store } from "./state/store";

function handleRoute(): void {
    const { mode, params } = router.parseHash();

    store.setState({ mode });

    const db = store.getState().db;
    if (!db) {
        console.warn("⚠️ DB noch nicht initialisiert");
        return;
    }

    if (mode === "uebungsleitung") {
        const uebungId = params[0];
        applyAppMode("uebungsleitung");

        if (uebungId) {
            store.setState({ aktuelleUebungId: uebungId });
            initUebungsleitung(db);
        }
        return;
    }

    if (mode === "teilnehmer") {
        applyAppMode("teilnehmer");
        initTeilnehmer(db);
        return;
    }

    if (mode === "admin") {
        applyAppMode("admin");
        admin.db = db;
        admin.ladeAlleUebungen();
        admin.renderUebungsStatistik();
        return;
    }

    // Fallback: Generator
    applyAppMode("generator");
}

window.addEventListener("DOMContentLoaded", () => {
    handleRoute();
    initNatoClock();
    initThemeToggle();
    initModals();
});

router.subscribe(() => handleRoute());

function initNatoClock(): void {
    const el = document.getElementById("natoTime");
    if (!el) return;

    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const pad = (n: number) => String(n).padStart(2, "0");

    const update = () => {
        const now = new Date();
        const day = pad(now.getDate());
        const hours = pad(now.getHours());
        const minutes = pad(now.getMinutes());
        const seconds = pad(now.getSeconds());
        const month = months[now.getMonth()];
        const year = String(now.getFullYear()).slice(-2);

        el.textContent = `${day}${hours}${minutes}${month}${year}`;
    };

    update();
    setInterval(update, 1000);
}

function initThemeToggle(): void {
    const toggleBtn = document.getElementById("themeToggle");
    const storedTheme = localStorage.getItem("theme");

    const getSystemTheme = (): "dark" | "light" =>
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    const applyTheme = (theme: "dark" | "light") => {
        document.body.setAttribute("data-theme", theme);
        if (toggleBtn) {
            toggleBtn.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
        }
    };

    if (storedTheme === "dark" || storedTheme === "light") {
        applyTheme(storedTheme);
    } else {
        applyTheme(getSystemTheme());
    }

    toggleBtn?.addEventListener("click", () => {
        const current = document.body.getAttribute("data-theme") as "dark" | "light";
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem("theme", next);
        applyTheme(next);
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
        if (!localStorage.getItem("theme")) {
            applyTheme(e.matches ? "dark" : "light");
        }
    });
}


function initModals() {
    // Falls zusätzliche Modal-Initialisierung nötig ist
}

function applyAppMode(mode: AppMode): void {
    const generator = document.getElementById("mainAppArea");
    const adminEl = document.getElementById("adminArea");
    const uebungsleitung = document.getElementById("uebungsleitungArea");
    const teilnehmer = document.getElementById("teilnehmerArea");

    generator && (generator.style.display = "none");
    adminEl && (adminEl.style.display = "none");
    uebungsleitung && (uebungsleitung.style.display = "none");
    teilnehmer && (teilnehmer.style.display = "none");

    switch (mode) {
        case "generator":
            generator && (generator.style.display = "block");
            break;
        case "admin":
            adminEl && (adminEl.style.display = "block");
            break;
        case "uebungsleitung":
            uebungsleitung && (uebungsleitung.style.display = "block");
            break;
        case "teilnehmer":
            teilnehmer && (teilnehmer.style.display = "block");
            break;
    }
}
import pdfGenerator from './pdfGenerator.js';
import { formatNatoDate } from "./utils/date";
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
import $ from "./select2-setup";

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
        $: typeof import("jquery");
        jQuery: typeof import("jquery");
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

    // Für die Anzeige der "Stellenname anzeigen"-Checkbox
    private showStellenname: boolean = false;

    constructor() {
        console.log("📌 AppController wurde initialisiert");

        const app = initializeApp(firebaseConfig);
        this.db = getFirestore(app);
        store.setState({ db: this.db });
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
                const hash = window.location.hash.replace(/^#\/?/, "");
                const parts = hash.split("/").filter(Boolean);

                // Priorität 1: Hash-Routing
                let uebungId: string | null = null;

                if (parts.length >= 2 && parts[1]) {
                    uebungId = parts[1];
                } else {
                    // Fallback: alte Variante ?id=
                    const urlParams = new URLSearchParams(window.location.search);
                    uebungId = urlParams.get("id");
                }

                if (uebungId) {
                    const docRef = doc(this.db, "uebungen", uebungId);
                    try {
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            this.funkUebung = Object.assign(new FunkUebung(buildInfo), data);
                            Object.assign(this.funkUebung, data);
                            // Sicherstellen, dass teilnehmerStellen vorhanden ist (Rückwärtskompatibilität)
                            if (!this.funkUebung.teilnehmerStellen) {
                                this.funkUebung.teilnehmerStellen = {};
                            }
                            console.log("📦 Übung aus Datenbank geladen:", this.funkUebung.id);
                            this.renderUebung();
                        } else {
                            console.warn("⚠️ Keine Übung mit dieser ID gefunden. Neue Übung wird erstellt.");
                            this.funkUebung = new FunkUebung(buildInfo);
                            if (!this.funkUebung.teilnehmerStellen) {
                                this.funkUebung.teilnehmerStellen = {};
                            }
                        }
                    } catch (err) {
                        console.error("❌ Fehler beim Laden der Übung:", err);
                        this.funkUebung = new FunkUebung(buildInfo);
                        if (!this.funkUebung.teilnehmerStellen) {
                            this.funkUebung.teilnehmerStellen = {};
                        }
                    }
                } else {
                    this.funkUebung = new FunkUebung(buildInfo);
                    if (!this.funkUebung.teilnehmerStellen) {
                        this.funkUebung.teilnehmerStellen = {};
                    }
                }

                console.log(this.funkUebung);

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
                    vorlageTHW: { text: "Funksprüche THW (Chat GPT)", filename: "assets/funksprueche/thw_funksprueche.txt" },
                    thwleer: { text: "Funksprüche THW Leer", filename: "assets/funksprueche/nachrichten_thw_leer.txt" },
                    thwmelle: { text: "Funksprüche THW Melle", filename: "assets/funksprueche/nachrichten_thw_melle.txt" },
                    thwessen: { text: "Funksprüche THW Essen", filename: "assets/funksprueche/nachrichten_thw_essen.txt" },
                    thwlehrte: { text: "Funksprüche THW Essen", filename: "assets/funksprueche/nachrichten_thw_lehrte.txt" },
                    vorlageFeuerwehr: { text: "Funksprüche Feuerwehr (Chat GPT)", filename: "assets/funksprueche/feuerwehr_funksprueche.txt" },
                    vorlageResttungsdienst: { text: "Funksprüche Rettungsdienst (Chat GPT)", filename: "assets/funksprueche/rettungsdienst_funksprueche.txt" },
                    vorlageLustig: { text: "Lustige Funksprüche (Chat GPT)", filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt" }
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

                this.initVorlagenOderUploadToggle();

                this.renderInitData();

                // (admin auto-load entfernt: läuft jetzt zentral über APP_MODE)

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
        });

        $(document).ready(() => {
            console.log("jQuery version:", $.fn.jquery);
            console.log("Select2 vorhanden:", typeof ($.fn as any).select2);
            $('#funkspruchVorlage').select2({
                placeholder: "Vorlagen auswählen...",
                theme: "bootstrap-5",
                width: "100%",
                closeOnSelect: false
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

        // 📅 Datum (lokal ohne UTC-Verschiebung)
        const date = new Date(this.funkUebung.datum);
        const pad = (n: number) => String(n).padStart(2, "0");
        const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        const datumInput = document.getElementById("datum") as HTMLInputElement;
        datumInput.value = isoDate;

        const anmeldungCheckbox = document.getElementById("anmeldungAktiv") as HTMLInputElement;
        if (anmeldungCheckbox) {
            anmeldungCheckbox.checked = this.funkUebung.anmeldungAktiv ?? true;
        }

        document.getElementById("anmeldungAktiv")?.addEventListener("change", (e) => {
            const target = e.target as HTMLInputElement;
            this.funkUebung.anmeldungAktiv = target.checked;
        });

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

        // Checkbox für "Stellenname anzeigen"
        let checkboxId = "showStellennameCheckbox";
        let checkboxHtml = `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="${checkboxId}" ${this.showStellenname ? "checked" : ""}>
                <label class="form-check-label" for="${checkboxId}">Stellenname anzeigen</label>
            </div>
        `;
        container.innerHTML = checkboxHtml;

        // Tabelle aufbauen, je nach Checkbox
        let tableHeaders = `<th>Funkrufnamen</th>`;
        if (this.showStellenname) {
            tableHeaders += `<th>Name der Stelle</th>`;
        }
        if (isIndividuell) {
            tableHeaders += `<th id='loesungswortHeader'>Lösungswort</th>`;
        }
        tableHeaders += `<th style="width: 50px;">Aktion</th>`;

        let tableHtml = `
            <table class="table table-bordered">
                <thead class="table-dark">
                    <tr>
                        ${tableHeaders}
                    </tr>
                </thead>
                <tbody id="teilnehmer-body"></tbody>
            </table>
        `;
        container.innerHTML += tableHtml;

        const tbody = document.getElementById("teilnehmer-body");
        if (!tbody) {
            console.error("Fehler: tbody-Element konnte nicht gefunden werden!");
            return;
        }

        // Jeden Teilnehmer rendern
        this.funkUebung.teilnehmerListe.forEach((teilnehmer, index) => {
            const row = document.createElement("tr");

            let stellenInput = "";
            if (this.showStellenname) {
                let value = this.funkUebung.teilnehmerStellen?.[teilnehmer] ?? "";
                stellenInput = `<td>
                    <input type="text" class="form-control stellenname-input" data-teilnehmer="${encodeURIComponent(teilnehmer)}" value="${value}" placeholder="Name der Stelle">
                </td>`;
            }

            let loesungswortInput = "";
            if (isIndividuell) {
                let wort = this.funkUebung.loesungswoerter[teilnehmer] || "";
                loesungswortInput = `<td><input type="text" class="form-control loesungswort-input" id="loesungswort-${index}" value="${wort}" placeholder="Lösungswort"></td>`;
            }

            row.innerHTML = `
                <td>
                    <input type="text" class="form-control teilnehmer-input" data-index="${index}" value="${teilnehmer}">
                </td>
                ${stellenInput}
                ${loesungswortInput}
                <td><button class="btn btn-danger btn-sm delete-teilnehmer" data-index="${index}"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(row);
        });

        // Event-Listener für Checkbox "Stellenname anzeigen"
        const self = this;
        const checkboxEl = document.getElementById(checkboxId) as HTMLInputElement;
        if (checkboxEl) {
            checkboxEl.addEventListener("change", function () {
                self.showStellenname = checkboxEl.checked;
                self.renderTeilnehmer(false);
            });
        }

        // Event-Listener für Änderungen an Teilnehmernamen (inkl. Umbenennung von teilnehmerStellen)
        document.querySelectorAll(".teilnehmer-input").forEach(input => {
            input.addEventListener("input", (event: Event) => {
                const target = event.target as HTMLInputElement;
                const index = Number(target.dataset.index);
                const oldName = this.funkUebung.teilnehmerListe[index];
                const newName = target.value;
                if (oldName !== newName) {
                    // Teilnehmername umbenennen: ggf. teilnehmerStellen-Key umbenennen
                    if (this.funkUebung.teilnehmerStellen && this.funkUebung.teilnehmerStellen[oldName] !== undefined) {
                        this.funkUebung.teilnehmerStellen[newName] = this.funkUebung.teilnehmerStellen[oldName];
                        delete this.funkUebung.teilnehmerStellen[oldName];
                    }
                    // Auch loesungswoerter ggf. umbenennen
                    if (this.funkUebung.loesungswoerter && this.funkUebung.loesungswoerter[oldName] !== undefined) {
                        this.funkUebung.loesungswoerter[newName] = this.funkUebung.loesungswoerter[oldName];
                        delete this.funkUebung.loesungswoerter[oldName];
                    }
                }
                this.funkUebung.teilnehmerListe[index] = newName;
            });
        });

        // Event-Listener für das Entfernen von Teilnehmern
        document.querySelectorAll(".delete-teilnehmer").forEach(button => {
            button.addEventListener("click", (event: Event) => {
                const mouseEvent = event as MouseEvent;
                const target = mouseEvent.target! as HTMLElement;
                const btn = target.closest("button")! as HTMLButtonElement;
                const index = Number(btn.dataset.index);
                // Vor Entfernen: teilnehmerStellen und loesungswoerter bereinigen
                const teilnehmer = this.funkUebung.teilnehmerListe[index];
                if (this.funkUebung.teilnehmerStellen && this.funkUebung.teilnehmerStellen[teilnehmer] !== undefined) {
                    delete this.funkUebung.teilnehmerStellen[teilnehmer];
                }
                if (this.funkUebung.loesungswoerter && this.funkUebung.loesungswoerter[teilnehmer] !== undefined) {
                    delete this.funkUebung.loesungswoerter[teilnehmer];
                }
                this.removeTeilnehmer(index);
            });
        });

        // Event-Listener für Stellenname-Eingabefelder
        if (this.showStellenname) {
            document.querySelectorAll(".stellenname-input").forEach(input => {
                input.addEventListener("input", (event: Event) => {
                    const target = event.target as HTMLInputElement;
                    const teilnehmer = decodeURIComponent(target.getAttribute("data-teilnehmer") || "");
                    if (!this.funkUebung.teilnehmerStellen) {
                        this.funkUebung.teilnehmerStellen = {};
                    }
                    if (target.value.trim() === "") {
                        delete this.funkUebung.teilnehmerStellen[teilnehmer];
                    } else {
                        this.funkUebung.teilnehmerStellen[teilnehmer] = target.value;
                    }
                });
            });
        }

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
        // Vor Entfernen: teilnehmerStellen und loesungswoerter bereinigen
        const teilnehmer = this.funkUebung.teilnehmerListe[index];
        if (this.funkUebung.teilnehmerStellen && this.funkUebung.teilnehmerStellen[teilnehmer] !== undefined) {
            delete this.funkUebung.teilnehmerStellen[teilnehmer];
        }
        if (this.funkUebung.loesungswoerter && this.funkUebung.loesungswoerter[teilnehmer] !== undefined) {
            delete this.funkUebung.loesungswoerter[teilnehmer];
        }
        this.funkUebung.teilnehmerListe.splice(index, 1);
        this.renderTeilnehmer();
    }

    startUebung() {
        // ⚠️ Sicherheitsabfrage: Übung existiert bereits
        if (this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0) {
            const ok = window.confirm(
                "Diese Übung wurde bereits generiert.\n\nMöchtest du sie wirklich neu generieren?\nDabei gehen alle bisherigen Nachrichten verloren."
            );
            if (!ok) {
                return;
            }
        }
        // Cast the select and file input elements before accessing their properties
        const selectedTemplates: string[] = ($('#funkspruchVorlage').val() as string[]) || [];

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
        this.natoDate = formatNatoDate(this.funkUebung.datum, false);

        this.readLoesungswoerter();

        // Neue Logik für Auswahl Vorlagen vs. Upload
        // Überprüfen, ob der Nutzer "Vorlagen" oder "Eigene Datei" gewählt hat
        const useVorlagen = (document.getElementById("optionVorlagen") as HTMLInputElement).checked;
        const useUpload = (document.getElementById("optionUpload") as HTMLInputElement).checked;

        if (useVorlagen) {
            this.funkUebung.verwendeteVorlagen = selectedTemplates;
            if (selectedTemplates.length === 0) {
                alert("Bitte mindestens eine Vorlage auswählen!");
                return;
            }

            // Standard-Funksprüche aus Vorlagen laden
            const fetchPromises = selectedTemplates.map(tpl =>
                fetch(this.templatesFunksprueche[tpl].filename).then(res => res.text())
            );

            Promise.all(fetchPromises)
                .then(results => {
                    this.funkUebung.funksprueche = results
                        .flatMap(text => text.split("\n").filter(s => s.trim() !== ""))
                        .sort(() => Math.random() - 0.5);
                    this.generateAllPages();
                })
                .catch(err => console.error("Fehler beim Laden der Vorlagen:", err));
        } else if (useUpload) {
            const fileInput = document.getElementById("funksprueche") as HTMLInputElement;
            const file = fileInput.files?.[0];
            if (!file) {
                alert("Bitte eine Datei auswählen!");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = (event.target as FileReader).result as string;

                const cleaned = result
                    // Unicode normalisieren (u + ¨ → ü)
                    .normalize("NFKC")
                    .replace(/\p{M}/gu, "")
                    .replace(/[^\S\n]+/g, " ")
                    .trim()
                    // ALLES raus, was nicht explizit erlaubt ist
                    //.replace(/[^A-Za-zÄÖÜäöüß0-9 ,.\-;:_?!#*+%&"§\/()=<> \n]/g, "")
                    // Windows-Zeilenumbrüche vereinheitlichen
                    .replace(/\r\n/g, "\n")
                    // Mehrfach-Leerzeichen zusammenziehen
                    //.replace(/[ \t]+/g, " ")
                    // Leerzeichen am Zeilenanfang/-ende entfernen
                    //.replace(/^[ ]+|[ ]+$/gm, "");

                this.funkUebung.funksprueche = cleaned
                    .split("\n")
                    .filter(s => s.trim() !== "");

                this.generateAllPages();
            };
            reader.readAsText(file);
        } else {
            alert("Bitte eine Option auswählen: Vorlagen oder eigene Datei!");
        }
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
        // 🏷️ Stellenname-Checkbox automatisch aktivieren, wenn Stellen vorhanden sind
        this.showStellenname = !!(
            this.funkUebung.teilnehmerStellen &&
            Object.keys(this.funkUebung.teilnehmerStellen).length > 0
        );

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

        // 📅 Datum (lokal ohne UTC-Verschiebung)
        const date = new Date(this.funkUebung.datum);
        const pad = (n: number) => String(n).padStart(2, "0");
        const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

    // Funktion zum Befüllen der Select-Box mit den Vorlagen
    populateTemplateSelectBox() {
        const selectBox = document.getElementById("funkspruchVorlage")! as HTMLSelectElement;

        // Leere die Selectbox zunächst
        selectBox.innerHTML = "";

        // Iteriere durch die Vorlagen und füge sie der Select-Box hinzu
        for (const [key, value] of Object.entries(this.templatesFunksprueche)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = `${value.text}`;
            const used = this.funkUebung?.verwendeteVorlagen;
            option.selected = Array.isArray(used)
                ? used.length === 0 || used.includes(key)
                : true;
            selectBox.appendChild(option);
        }
        $('#funkspruchVorlage').trigger('change');
    }

    // Funktion, um das aktuelle Datum im Datumsfeld vorzufüllen
    setDefaultDate() {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        (document.getElementById("datum")! as HTMLInputElement).value = formattedDate;
    }

    readLoesungswoerter() {
        this.funkUebung.loesungswoerter = {};
        const isZentral = (document.getElementById("zentralLoesungswort")! as HTMLInputElement).checked;
        const zentralInput = document.getElementById("zentralLoesungswortInput")! as HTMLInputElement;
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
        const linkUebungsMonitorElement = document.getElementById("link-uebungsleitung-direkt")! as HTMLAnchorElement;
        const teilnehmerLinksContainer = document.getElementById("links-teilnehmer-container")! as HTMLElement;

        if (this.funkUebung.id) {
            const baseUrl = `${window.location.origin}${window.location.pathname}`;

            const urlUebung = `${baseUrl}#/generator/${this.funkUebung.id}`;
            linkElement.href = urlUebung;
            linkElement.textContent = urlUebung;

            const urlUebungLeitung = `${baseUrl}#/uebungsleitung/${this.funkUebung.id}`;
            linkUebungsMonitorElement.href = urlUebungLeitung;
            linkUebungsMonitorElement.textContent = urlUebungLeitung;

            // Teilnehmer-Links
            teilnehmerLinksContainer.innerHTML = "";
            if (this.funkUebung.teilnehmerIds) {
                Object.entries(this.funkUebung.teilnehmerIds).forEach(([id, name]) => {
                    const url = `${baseUrl}#/teilnehmer/${this.funkUebung.id}/${id}`;
                    const div = document.createElement("div");
                    div.className = "mb-1";
                    div.innerHTML = `<strong>${name}:</strong> <a href="${url}" target="_blank" class="text-break">${url}</a>`;
                    teilnehmerLinksContainer.appendChild(div);
                });
            }

            linkContainer.style.display = "block";
        }
    }

    /**
     * Initialisiert den Umschalter zwischen "Vorlagen verwenden" und "Eigene Datei hochladen".
     * Blendet je nach Auswahl das Select2-Feld oder den Uploadbereich ein/aus.
     */
    initVorlagenOderUploadToggle() {
        const vorlagenOption = document.getElementById("optionVorlagen") as HTMLInputElement;
        const uploadOption = document.getElementById("optionUpload") as HTMLInputElement;
        const selectBoxContainer = document.getElementById("funkspruchVorlage")!.parentElement as HTMLElement;
        const fileUploadContainer = document.getElementById("fileUploadContainer") as HTMLElement;
        const toggleVisibility = () => {
            if (vorlagenOption.checked) {
                selectBoxContainer.style.display = "block";
                fileUploadContainer.style.display = "none";
            } else if (uploadOption.checked) {
                selectBoxContainer.style.display = "none";
                fileUploadContainer.style.display = "block";
            }
        };

        vorlagenOption.addEventListener("change", toggleVisibility);
        uploadOption.addEventListener("change", toggleVisibility);

        toggleVisibility(); // initiale Anzeige
    }

}

export async function saveUebung(funkUebung: FunkUebung, db: Firestore): Promise<void> {
    const uebungRef = doc(db, "uebungen", funkUebung.id);
    try {
        await setDoc(uebungRef, JSON.parse(funkUebung.toJson()));
        console.log(funkUebung.toJson());
        console.log("✅ Übung erfolgreich gespeichert:", funkUebung.id);
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Übung:", error);
    }
}

window.app = new AppController();
window.pdfGenerator = pdfGenerator;
window.admin = admin;

