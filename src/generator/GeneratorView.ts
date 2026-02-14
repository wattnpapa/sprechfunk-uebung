import { FunkUebung } from "../models/FunkUebung";
import { Chart } from "chart.js";
import $ from "../core/select2-setup";

export class GeneratorView {
    
    // Cache für DOM-Elemente könnte hier angelegt werden, 
    // aber für diesen Refactor reicht der direkte Zugriff über gekapselte Methoden.

    public setVersionInfo(id: string, version: string) {
        const idEl = document.getElementById("uebungsId");
        if(idEl) {
            idEl.textContent = id;
        }
        
        const verEl = document.getElementById("version");
        if(verEl) {
            verEl.innerHTML = version;
        }
    }

    public getFormData(): Partial<FunkUebung> {
        const datumVal = (document.getElementById("datum") as HTMLInputElement).value;
        
        return {
            name: (document.getElementById("nameDerUebung") as HTMLInputElement).value,
            rufgruppe: (document.getElementById("rufgruppe") as HTMLInputElement).value,
            leitung: (document.getElementById("leitung") as HTMLInputElement).value,
            spruecheProTeilnehmer: Number((document.getElementById("spruecheProTeilnehmer") as HTMLInputElement).value),
            spruecheAnAlle: Number((document.getElementById("spruecheAnAlle") as HTMLInputElement).value),
            spruecheAnMehrere: Number((document.getElementById("spruecheAnMehrere") as HTMLInputElement).value),
            buchstabierenAn: Number((document.getElementById("spruecheAnBuchstabieren") as HTMLInputElement).value),
            datum: datumVal ? new Date(datumVal) : new Date(),
            anmeldungAktiv: (document.getElementById("anmeldungAktiv") as HTMLInputElement).checked
        };
    }

    public setFormData(uebung: FunkUebung) {
        (document.getElementById("nameDerUebung") as HTMLInputElement).value = uebung.name || "";
        (document.getElementById("rufgruppe") as HTMLInputElement).value = uebung.rufgruppe || "";
        (document.getElementById("leitung") as HTMLInputElement).value = uebung.leitung || "";
        (document.getElementById("spruecheProTeilnehmer") as HTMLInputElement).value = uebung.spruecheProTeilnehmer.toString();
        
        // Datum formatieren für Input type=date
        const date = new Date(uebung.datum);
        const pad = (n: number) => String(n).padStart(2, "0");
        const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        (document.getElementById("datum") as HTMLInputElement).value = isoDate;

        (document.getElementById("anmeldungAktiv") as HTMLInputElement).checked = uebung.anmeldungAktiv;

        // Prozentwerte und absolute Werte setzen
        this.updateDistributionInputs(uebung);
        
        // Lösungswort-Optionen setzen
        this.setLoesungswortUI(uebung.loesungswoerter);
    }

    public updateDistributionInputs(uebung: FunkUebung) {
        const proTeilnehmer = uebung.spruecheProTeilnehmer || 1;
        
        const update = (idProzent: string, idAnzahl: string, wert: number) => {
            const prozent = Math.round((wert / proTeilnehmer) * 100);
            const prozentInput = document.getElementById(idProzent) as HTMLInputElement;
            if (prozentInput) {
                prozentInput.value = prozent.toString();
            }
            
            const anzahlInput = document.getElementById(idAnzahl) as HTMLInputElement;
            if (anzahlInput) {
                anzahlInput.value = wert.toString();
            }
            
            // Calc Span update
            // ID logic in HTML is slightly inconsistent: calcAnAlle vs spruecheAnAlle
            // HTML IDs: calcAnAlle, calcAnMehrere, calcAnBuchstabieren
            // Input IDs: spruecheAnAlle, spruecheAnMehrere, spruecheAnBuchstabieren
            const simpleName = idAnzahl.replace("sprueche", ""); // AnAlle
            const span = document.getElementById("calc" + simpleName);
            if (span) {
                span.textContent = wert.toString();
            }
        };

        update("prozentAnAlle", "spruecheAnAlle", uebung.spruecheAnAlle || 0);
        update("prozentAnMehrere", "spruecheAnMehrere", uebung.spruecheAnMehrere || 0);
        update("prozentAnBuchstabieren", "spruecheAnBuchstabieren", uebung.buchstabierenAn || 0);
    }

    public setLoesungswortUI(loesungswoerter: Record<string, string>) {
        const noneRadio = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
        const centralRadio = document.getElementById("zentralLoesungswort") as HTMLInputElement;
        const indivRadio = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
        const centralInput = document.getElementById("zentralLoesungswortInput") as HTMLInputElement;
        const container = document.getElementById("zentralLoesungswortContainer") as HTMLElement;
        const shuffleBtn = document.getElementById("shuffleButton") as HTMLElement;

        if (!noneRadio || !centralRadio || !indivRadio || !centralInput || !container || !shuffleBtn) {
            return;
        }

        const zentraleWorte = new Set(
            Object.values(loesungswoerter || {}).filter(
                (wort): wort is string => typeof wort === "string" && wort.trim().length > 0
            )
        );
        
        if (!loesungswoerter || Object.keys(loesungswoerter).length === 0) {
            noneRadio.checked = true;
            container.style.display = "none";
            shuffleBtn.style.display = "none";
        } else if (zentraleWorte.size === 1) {
            centralRadio.checked = true;
            centralInput.value = [...zentraleWorte][0] ?? "";
            container.style.display = "block";
            shuffleBtn.style.display = "block";
        } else {
            indivRadio.checked = true;
            container.style.display = "none";
            shuffleBtn.style.display = "block";
        }
    }

    public getSelectedLoesungswortOption(): "none" | "central" | "individual" {
        if ((document.getElementById("keineLoesungswoerter") as HTMLInputElement).checked) {
            return "none";
        }
        if ((document.getElementById("zentralLoesungswort") as HTMLInputElement).checked) {
            return "central";
        }
        return "individual";
    }

    public getZentralesLoesungswort(): string {
        return (document.getElementById("zentralLoesungswortInput") as HTMLInputElement).value;
    }

    public renderTeilnehmerListe(
        teilnehmerListe: string[], 
        teilnehmerStellen: Record<string, string>, 
        loesungswoerter: Record<string, string>,
        showStellenname: boolean
    ) {
        const container = document.getElementById("teilnehmer-container");
        if (!container) {
            return;
        }
        container.innerHTML = ""; 

        // Checkbox rendern
        const checkboxId = "showStellennameCheckbox";
        const checkboxHtml = `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="${checkboxId}" ${showStellenname ? "checked" : ""}>
                <label class="form-check-label" for="${checkboxId}">Stellenname anzeigen</label>
            </div>
        `;
        container.innerHTML = checkboxHtml;

        const option = this.getSelectedLoesungswortOption();
        const isIndividuell = option === "individual";

        let tableHeaders = "<th>Funkrufnamen</th>";
        if (showStellenname) {
            tableHeaders += "<th>Name der Stelle</th>";
        }
        if (isIndividuell) {
            tableHeaders += "<th id='loesungswortHeader'>Lösungswort</th>";
        }
        tableHeaders += "<th style=\"width: 50px;\">Aktion</th>";

        const tableHtml = `
            <table class="table table-bordered">
                <thead class="table-dark">
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody id="teilnehmer-body"></tbody>
            </table>
        `;
        container.innerHTML += tableHtml;

        const tbody = document.getElementById("teilnehmer-body");
        if (!tbody) {
            return;
        }

        teilnehmerListe.forEach((teilnehmer, index) => {
            const row = document.createElement("tr");

            let stellenInput = "";
            if (showStellenname) {
                const value = teilnehmerStellen?.[teilnehmer] ?? "";
                stellenInput = `<td>
                    <input type="text" class="form-control stellenname-input" data-teilnehmer="${encodeURIComponent(teilnehmer)}" value="${value}" placeholder="Name der Stelle">
                </td>`;
            }

            let loesungswortInput = "";
            if (isIndividuell) {
                const wort = loesungswoerter[teilnehmer] || "";
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
    }

    public populateTemplateSelect(templates: Record<string, { text: string }>, selected: string[] = []) {
        const selectBox = document.getElementById("funkspruchVorlage") as HTMLSelectElement;
        if (!selectBox) {
            return;
        }
        selectBox.innerHTML = "";

        for (const [key, value] of Object.entries(templates)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = value.text;
            option.selected = selected.length === 0 || selected.includes(key);
            selectBox.appendChild(option);
        }
        // Trigger Select2 update
        $("#funkspruchVorlage").trigger("change");
    }

    public getSelectedTemplates(): string[] {
        return ($("#funkspruchVorlage").val() as string[]) || [];
    }

    public getSelectedSource(): "vorlagen" | "upload" {
        if ((document.getElementById("optionVorlagen") as HTMLInputElement).checked) {
            return "vorlagen";
        }
        return "upload";
    }

    public getUploadedFile(): File | undefined {
        return (document.getElementById("funksprueche") as HTMLInputElement).files?.[0];
    }

    public toggleSourceView(source: "vorlagen" | "upload") {
        const selectBoxContainer = document.getElementById("funkspruchVorlage")?.parentElement;
        const fileUploadContainer = document.getElementById("fileUploadContainer");
        
        if (!selectBoxContainer || !fileUploadContainer) {
            return;
        }

        if (source === "vorlagen") {
            selectBoxContainer.style.display = "block";
            fileUploadContainer.style.display = "none";
        } else {
            selectBoxContainer.style.display = "none";
            fileUploadContainer.style.display = "block";
        }
    }

    public showOutputContainer() {
        const el = document.getElementById("output-container");
        if (el) {
            el.style.display = "block";
        }
    }

    public renderLinks(uebung: FunkUebung) {
        const linkContainer = document.getElementById("uebung-links");
        const linkElement = document.getElementById("link-uebung-direkt") as HTMLAnchorElement;
        const linkUebungsMonitorElement = document.getElementById("link-uebungsleitung-direkt") as HTMLAnchorElement;
        const teilnehmerLinksContainer = document.getElementById("links-teilnehmer-container");

        if (!linkContainer || !linkElement || !linkUebungsMonitorElement || !teilnehmerLinksContainer) {
            return;
        }

        if (uebung.id) {
            const baseUrl = `${window.location.origin}${window.location.pathname}`;

            const urlUebung = `${baseUrl}#/generator/${uebung.id}`;
            linkElement.href = urlUebung;
            linkElement.textContent = urlUebung;

            const urlUebungLeitung = `${baseUrl}#/uebungsleitung/${uebung.id}`;
            linkUebungsMonitorElement.href = urlUebungLeitung;
            linkUebungsMonitorElement.textContent = urlUebungLeitung;

            teilnehmerLinksContainer.innerHTML = "";
            if (uebung.teilnehmerIds) {
                Object.entries(uebung.teilnehmerIds).forEach(([id, name]) => {
                    const url = `${baseUrl}#/teilnehmer/${uebung.id}/${id}`;
                    const div = document.createElement("div");
                    div.className = "mb-1";
                    div.innerHTML = `<strong>${name}:</strong> <a href="${url}" target="_blank" class="text-break">${url}</a>`;
                    teilnehmerLinksContainer.appendChild(div);
                });
            }

            linkContainer.style.display = "block";
        }
    }

    public renderPreview(html: string, index: number, total: number) {
        const iframe = document.getElementById("resultFrame") as HTMLIFrameElement;
        if (iframe) {
            iframe.srcdoc = html;
        }
        
        const pageInfo = document.getElementById("current-page");
        if (pageInfo) {
            pageInfo.textContent = `Seite ${index + 1} / ${total}`;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public renderDuration(stats: any) {
        const set = (id: string, val: string) => {
            const el = document.getElementById(id);
            if (el) {
                el.innerText = val;
            }
        };

        set("dauerOptimalMinuten", `${stats.optimal.toFixed()} Min`);
        set("dauerOptimalStundenMinuten", `${stats.optimalFormatted.stunden} Std ${stats.optimalFormatted.minuten.toFixed(0)} Min`);
        set("durchschnittOptimal", `${stats.durchschnittOptimal.toFixed(2)} Sek`);

        set("dauerLangsamMinuten", `${stats.schlecht.toFixed()} Min`);
        set("dauerLangsamStundenMinuten", `${stats.schlechtFormatted.stunden} Std ${stats.schlechtFormatted.minuten.toFixed(0)} Min`);
        set("durchschnittLangsam", `${stats.durchschnittSchlecht.toFixed(2)} Sek`);
    }

    public renderChart(labels: string[], data: number[]) {
        const canvas = document.getElementById("distributionChart") as HTMLCanvasElement;
        if (!canvas) {
            return;
        }

        if (window.chart) {
            window.chart.destroy();
        }

        window.chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Empfangene Nachrichten",
                    data: data,
                    backgroundColor: "#4CAF50",
                    borderColor: "#388E3C",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: "Teilnehmer" }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: "Anzahl der Nachrichten" }
                    }
                }
            }
        });
    }

    public showJsonModal(json: string) {
        const el = document.getElementById("jsonOutput");
        if(el) {
            el.textContent = json;
        }
    }

    public render(): void {
        const container = document.getElementById("mainAppArea");
        if (!container) {
            return;
        }

        container.innerHTML = `
            <!-- Hauptbereich mit Kopfdaten, Einstellungen und Teilnehmerverwaltung nebeneinander -->
            <div class="row">

                <!-- Card für Kopfdaten (links) -->
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-info-circle"></i> Kopfdaten</h4>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Datum der Übung:</label>
                                <input type="date" class="form-control" id="datum">
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Name der Übung:</label>
                                <input type="text" class="form-control" id="nameDerUebung">
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Rufgruppe der Übung:</label>
                                <input type="text" class="form-control" id="rufgruppe">
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Funkrufname der Übungsleitung:</label>
                                <input type="text" class="form-control" id="leitung">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card für Einstellungen (Mitte) -->
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-comment"></i> Einstellungen</h4>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <!-- Anzahl Funksprüche pro Teilnehmer -->
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Funksprüche pro Teilnehmer:</label>
                                    <input type="number" class="form-control" id="spruecheProTeilnehmer"
                                           min="1" value="50">
                                </div>

                                <!-- Nachrichten an alle -->
                                <div class="col-md-6 mb-6">
                                    <label class="form-label">% an Alle:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="prozentAnAlle"
                                               min="0" max="100" value="10">
                                        <span class="input-group-text">%</span>
                                    </div>
                                    <small class="text-muted">Ergibt <span id="calcAnAlle">5</span> Nachrichten</small>
                                    <input type="hidden" id="spruecheAnAlle" value="5">
                                </div>
                                <!-- Nachrichten an mehrere -->
                                <div class="col-md-6 mb-6">
                                    <label class="form-label">% an Mehrere:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="prozentAnMehrere"
                                               min="0" max="100" value="5">
                                        <span class="input-group-text">%</span>
                                    </div>
                                    <small class="text-muted">Ergibt <span id="calcAnMehrere">2</span>
                                        Nachrichten</small>
                                    <input type="hidden" id="spruecheAnMehrere" value="2">
                                </div>
                                <!-- Buchstabieranteil -->
                                <div class="col-md-6 mb-6">
                                    <label class="form-label">% Buchstabier-Aufgaben:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="prozentAnBuchstabieren"
                                               min="0" max="100" value="0">
                                        <span class="input-group-text">%</span>
                                    </div>
                                    <small class="text-muted">Ergibt <span id="calcAnBuchstabieren">0</span>
                                        Nachrichten</small>
                                    <input type="hidden" id="spruecheAnBuchstabieren" value="0">
                                </div>
                            </div>

                            <div id="vorlagenUploadToggle" class="mb-3">
                                <label class="form-label fw-bold">Funksprüche auswählen:</label>
                                <div>
                                    <input type="radio" id="optionVorlagen" name="funkspruchQuelle" value="vorlagen"
                                           checked>
                                    <label for="optionVorlagen">Vorlagen verwenden</label>
                                </div>
                                <div>
                                    <input type="radio" id="optionUpload" name="funkspruchQuelle" value="upload">
                                    <label for="optionUpload">Eigene Datei hochladen</label>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label for="funkspruchVorlage" class="form-label">Funkspruch-Vorlagen auswählen:</label>
                                <small class="text-muted d-block mb-2">Tipp: Du kannst mehrere Vorlagen gleichzeitig
                                    auswählen.</small>
                                <select class="form-select" id="funkspruchVorlage" multiple="multiple"></select>
                                <small class="text-muted">Wähle eine oder mehrere Vorlagen (mit Suchfunktion)</small>
                                <p class="text-muted mt-2">
                                    📬 Wenn du möchtest, dass deine eigenen Funksprüche mit in den Datenpool aufgenommen
                                    werden,
                                    sende sie bitte an <a
                                        href="mailto:johannes.rudolph@thw-oldenburg.de">johannes.rudolph@thw-oldenburg.de</a>.
                                </p>
                            </div>

                            <!-- Container für den Datei-Upload -->
                            <div class="mb-3" id="fileUploadContainer" style="display: none;">
                                <label class="form-label">Funksprüche hochladen:</label>
                                <input type="file" class="form-control" id="funksprueche" accept=".txt">
                            </div>

                            <!-- Lösungswörter -->
                            <div class="mb-3">
                                <label class="form-label">Lösungswörter:</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" id="keineLoesungswoerter"
                                           name="loesungswortOption" checked>
                                    <label class="form-check-label" for="keineLoesungswoerter">Keine
                                        Lösungswörter</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" id="zentralLoesungswort"
                                           name="loesungswortOption">
                                    <label class="form-check-label" for="zentralLoesungswort">Zentrales
                                        Lösungswort</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" id="individuelleLoesungswoerter"
                                           name="loesungswortOption">
                                    <label class="form-check-label" for="individuelleLoesungswoerter">Individuelle
                                        Lösungswörter</label>
                                </div>
                                <div id="zentralLoesungswortContainer" style="display: none;">
                                    <input type="text" id="zentralLoesungswortInput" class="form-control mt-2"
                                           placeholder="Zentrales Lösungswort">
                                </div>
                            </div>

                            <div class="form-check mt-3">
                                <input class="form-check-input" type="checkbox" id="autoStaerkeErgaenzen" checked>
                                <label class="form-check-label" for="autoStaerkeErgaenzen">
                                    Automatische Ergänzung von Stärkemeldungen aktivieren
                                </label>
                            </div>
                            <div class="form-check mt-3">
                                <input class="form-check-input"
                                       type="checkbox"
                                       id="anmeldungAktiv"
                                       checked>
                                <label class="form-check-label" for="anmeldungAktiv">
                                    Anmeldungs-Funkspruch generieren
                                </label>
                            </div>

                            <button id="shuffleButton" class="btn btn-primary"
                                    style="display: none;">
                                🔀 Lösungswörter Zufällig neu zuweisen
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Card für Teilnehmerverwaltung (rechts) -->
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h4 class="text-primary"><i class="fas fa-users"></i> Teilnehmerverwaltung</h4>
                        </div>
                        <div class="card-body">
                            <!-- Teilnehmerliste -->
                            <div class="row" id="teilnehmer-container">
                                <!-- Hier wird per JS die Tabelle eingefügt -->
                            </div>
                            <!-- Teilnehmer hinzufügen Button -->
                            <button class="btn btn-success mt-3" onclick="app.addTeilnehmer()">Teilnehmer
                                hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success w-100 mt-4" onclick="app.startUebung()">
                <i class="fas fa-cogs"></i> Übung generieren
            </button>

            <div id="output-container" style="display: none; margin-top: 20px;">
                <div id="uebung-links" class="card mt-4" style="display: none;">
                    <div class="card-header bg-primary text-white">
                        🔗 Links zur Übung
                    </div>
                    <div class="card-body">
                        <p class="card-text">
                            Mit diesem Link kannst du die Übung jederzeit wieder aufrufen:
                        </p>
                        <div>Übung <a id="link-uebung-direkt" href="#" target="_blank" class="card-link text-break"></a></div>
                        <div>Übungsleitungs Monitor <a id="link-uebungsleitung-direkt" href="#" target="_blank" class="card-link text-break"></a></div>
                        <hr>
                        <h6>Teilnehmer-Links:</h6>
                        <div id="links-teilnehmer-container"></div>
                    </div>
                </div>

                <!-- Vorschau der generierten Seiten -->
                <div class="card mb-3">
                    <div class="card-header">
                        <h5 class="d-flex justify-content-between align-items-center">
                            <span><i class="fas fa-file-alt"></i> Vorschau der generierten Seiten</span>
                            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse"
                                    data-bs-target="#collapseVorschau">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </h5>
                    </div>
                    <div id="collapseVorschau" class="collapse show">
                        <div class="card-body text-center">
                            <button class="btn btn-secondary" onclick="app.changePage(-1)">⬅ Zurück</button>
                            <span id="current-page">Seite 1 / 1</span>
                            <button class="btn btn-secondary" onclick="app.changePage(1)">Weiter ➡</button>
                            <button id="downloadZip" class="btn btn-primary"
                                    onclick="pdfGenerator.generateAllPDFsAsZip(window.app.funkUebung)">📦 Alle PDFs als ZIP
                                herunterladen
                            </button>
                            <iframe id="resultFrame"
                                    style="width: 100%; height: 400px; border: 1px solid #ccc; margin-top: 20px;"></iframe>
                        </div>
                    </div>
                </div>

                <!-- JSON Modal -->
                <div class="modal fade" id="jsonModal" tabindex="-1" aria-labelledby="jsonModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="jsonModalLabel">Übungsdaten als JSON</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"
                                        aria-label="Schließen"></button>
                            </div>
                            <div class="modal-body">
                                    <pre id="jsonOutput"
                                         style="white-space: pre-wrap; word-wrap: break-word; background-color: #f8f9fa; padding: 1rem; border-radius: .3rem;"></pre>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" data-bs-dismiss="modal">Schließen</button>
                                <button class="btn btn-primary" onclick="app.copyJSONToClipboard()">📋 In Zwischenablage
                                    kopieren
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <!-- Nachrichtenverteilung -->
                        <div class="card mb-3">
                            <div class="card-header">
                                <h5 class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-chart-bar"></i> Nachrichtenverteilung</span>
                                    <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse"
                                            data-bs-target="#collapseDiagramm">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </h5>
                            </div>
                            <div id="collapseDiagramm" class="collapse show">
                                <div class="card-body">
                                    <canvas id="distributionChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <!-- Dauer der Übung-->
                        <div class="card mb-3">
                            <div class="card-header">
                                <h5 class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-clock"></i> Geschätzte Dauer der Übung</span>
                                    <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse"
                                            data-bs-target="#collapseDauer">
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                </h5>
                            </div>
                            <div id="collapseDauer" class="collapse show">
                                <div class="card-body">
                                    <table class="table table-bordered">
                                        <thead class="table-dark">
                                        <tr>
                                            <th></th>
                                            <th>Dauer in Minuten</th>
                                            <th>Dauer in Stunden und Minuten</th>
                                            <th>Durchschnittliche Zeit pro Funkspruch (Sek.)</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr>
                                            <td>Optimal</td>
                                            <td id="dauerOptimalMinuten">- Min</td>
                                            <td id="dauerOptimalStundenMinuten">- Std - Min</td>
                                            <td id="durchschnittOptimal">- Sek</td>
                                        </tr>
                                        <tr>
                                            <td>Langsam</td>
                                            <td id="dauerLangsamMinuten">- Min</td>
                                            <td id="dauerLangsamStundenMinuten">- Std - Min</td>
                                            <td id="durchschnittLangsam">- Sek</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                    <div class="mt-3">
                                        <h6>📘 Rechenformeln & Annahmen:</h6>
                                        <p class="mb-1"><strong>Basis-Einheit:</strong> Alle Berechnungen basieren auf
                                            Sekunden.</p>
                                        <p class="mb-1"><strong>Annahmen:</strong></p>
                                        <ul class="mb-2">
                                            <li>Wir schaffen es, <strong>1 Zeichen pro Sekunde</strong> mitzuschreiben.
                                            </li>
                                            <li>Wir benötigen <strong>2 Zeichen pro Sekunde</strong>, um eine Nachricht
                                                zu
                                                übermitteln (sprechen).
                                            </li>
                                        </ul>
                                        <p class="mb-1"><strong>Optimale Dauer:</strong>
                                            <code>Sprechzeit + Mitschrift + Empfänger-Zeit + Verbindungsaufbau + Verbindungsabbau</code>
                                        </p>
                                        <ul class="mb-2">
                                            <li><strong>Sprechzeit:</strong> Zeichenlänge / 2</li>
                                            <li><strong>Mitschrift:</strong> Zeichenlänge</li>
                                            <li><strong>Empfänger-Zeit:</strong> (Empfängerzahl - 1) × 2 Sekunden</li>
                                            <li><strong>Verbindungsaufbau:</strong> 5 Sekunden + 3 Sekunden je
                                                zusätzlichem
                                                Empfänger
                                            <li><strong>Verbindungsabbau:</strong> 3 Sekunden</li>
                                        </ul>
                                        <p class="mb-1"><strong>Langsame Dauer:</strong> Optimale Dauer × 1.5 (wenn
                                            Wiederholung erforderlich)</p>
                                        <p class="text-muted">Diese Formeln dienen zur realistischen Einschätzung der
                                            Gesamtdauer anhand der Nachrichteninhalte und Teilnehmeranzahl.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }
}
