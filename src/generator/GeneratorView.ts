import { FunkUebung } from "../models/FunkUebung";
import { Chart } from "chart.js";
import $ from "../core/select2-setup";
import type { UebungsDauerStats, VerteilungsStats } from "./GeneratorStatsService";
import type { PreviewPage } from "./GeneratorPreviewService";
import pdfGenerator from "../services/pdfGenerator";
import { uiFeedback } from "../core/UiFeedback";

export class GeneratorView {
    private bindingController = new AbortController();
    
    // Cache für DOM-Elemente könnte hier angelegt werden, 
    // aber für diesen Refactor reicht der direkte Zugriff über gekapselte Methoden.

    public resetBindings() {
        this.bindingController.abort();
        this.bindingController = new AbortController();
    }

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
            anmeldungAktiv: (document.getElementById("anmeldungAktiv") as HTMLInputElement).checked,
            autoStaerkeErgaenzen: (document.getElementById("autoStaerkeErgaenzen") as HTMLInputElement).checked
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
        (document.getElementById("autoStaerkeErgaenzen") as HTMLInputElement).checked = uebung.autoStaerkeErgaenzen;

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
        } else if (zentraleWorte.size === 1) {
            centralRadio.checked = true;
            centralInput.value = [...zentraleWorte][0] ?? "";
        } else {
            indivRadio.checked = true;
        }

        this.updateLoesungswortOptionUI();
    }

    public updateLoesungswortOptionUI() {
        const centralRadio = document.getElementById("zentralLoesungswort") as HTMLInputElement | null;
        const noneRadio = document.getElementById("keineLoesungswoerter") as HTMLInputElement | null;
        const container = document.getElementById("zentralLoesungswortContainer") as HTMLElement | null;
        const shuffleBtn = document.getElementById("shuffleButton") as HTMLElement | null;

        if (!centralRadio || !noneRadio || !container || !shuffleBtn) {
            return;
        }

        const option = this.getSelectedLoesungswortOption();
        container.style.display = centralRadio.checked ? "block" : "none";
        shuffleBtn.style.display = option === "none" ? "none" : "block";
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

    public bindDistributionInputs(onChange: (data: Partial<FunkUebung>) => void) {
        const ids = ["spruecheProTeilnehmer", "prozentAnAlle", "prozentAnMehrere", "prozentAnBuchstabieren"];
        ids.forEach(id => {
            document.getElementById(id)?.addEventListener("input", () => {
                this.syncDistributionFromPercentInputs();
                const data = this.getFormData();
                onChange(data);
            }, { signal: this.bindingController.signal });
        });
    }

    private syncDistributionFromPercentInputs() {
        const proTeilnehmerInput = document.getElementById("spruecheProTeilnehmer") as HTMLInputElement | null;
        const proTeilnehmer = Math.max(1, Number(proTeilnehmerInput?.value) || 0);

        const sync = (idProzent: string, idAnzahl: string) => {
            const prozentInput = document.getElementById(idProzent) as HTMLInputElement | null;
            const anzahlInput = document.getElementById(idAnzahl) as HTMLInputElement | null;
            const simpleName = idAnzahl.replace("sprueche", "");
            const span = document.getElementById("calc" + simpleName);
            if (!prozentInput || !anzahlInput) {
                return;
            }

            const prozent = Math.max(0, Math.min(100, Number(prozentInput.value) || 0));
            const anzahl = Math.round((proTeilnehmer * prozent) / 100);
            anzahlInput.value = String(anzahl);
            if (span) {
                span.textContent = String(anzahl);
            }
        };

        sync("prozentAnAlle", "spruecheAnAlle");
        sync("prozentAnMehrere", "spruecheAnMehrere");
        sync("prozentAnBuchstabieren", "spruecheAnBuchstabieren");
    }

    public bindSourceToggle() {
        document.getElementById("optionVorlagen")?.addEventListener("change", () => {
            this.toggleSourceView("vorlagen");
        }, { signal: this.bindingController.signal });
        document.getElementById("optionUpload")?.addEventListener("change", () => {
            this.toggleSourceView("upload");
        }, { signal: this.bindingController.signal });
    }

    public bindLoesungswortOptionChange(onChange: () => void) {
        document.querySelectorAll("input[name=\"loesungswortOption\"]").forEach(el => {
            el.addEventListener("change", () => onChange(), { signal: this.bindingController.signal });
        });
    }

    public bindTeilnehmerEvents(
        onTeilnehmerNameChange: (index: number, val: string) => void,
        onStellennameChange: (teilnehmer: string, val: string) => void,
        onDelete: (index: number) => void,
        onShowStellennameToggle: (checked: boolean) => void
    ) {
        const container = document.getElementById("teilnehmer-container");
        if (!container) {
            return;
        }
        container.addEventListener("input", e => {
            const target = e.target as HTMLElement;
            if (target.classList.contains("teilnehmer-input")) {
                const index = Number(target.dataset["index"]);
                const newVal = (target as HTMLInputElement).value;
                onTeilnehmerNameChange(index, newVal);
            }
            if (target.classList.contains("stellenname-input")) {
                const teilnehmer = decodeURIComponent(target.getAttribute("data-teilnehmer") || "");
                const newVal = (target as HTMLInputElement).value;
                onStellennameChange(teilnehmer, newVal);
            }
        }, { signal: this.bindingController.signal });

        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest(".delete-teilnehmer") as HTMLElement;
            if (btn) {
                const index = Number(btn.dataset["index"]);
                onDelete(index);
            }
        }, { signal: this.bindingController.signal });

        container.addEventListener("change", e => {
            const target = e.target as HTMLInputElement;
            if (target.id === "showStellennameCheckbox") {
                onShowStellennameToggle(target.checked);
            }
        }, { signal: this.bindingController.signal });
    }

    public bindAnmeldungToggle(onToggle: (checked: boolean) => void) {
        document.getElementById("anmeldungAktiv")?.addEventListener("change", e => {
            const target = e.target as HTMLInputElement;
            onToggle(target.checked);
        }, { signal: this.bindingController.signal });
    }

    public bindPrimaryActions(handlers: {
        onAddTeilnehmer: () => void;
        onStartUebung: () => void;
        onChangePage: (step: number) => void;
        onCopyJson: () => void;
        onZipAllPdfs: () => void;
    }) {
        document.getElementById("addTeilnehmerBtn")?.addEventListener("click", handlers.onAddTeilnehmer, { signal: this.bindingController.signal });
        document.getElementById("startUebungBtn")?.addEventListener("click", handlers.onStartUebung, { signal: this.bindingController.signal });
        document.getElementById("pagePrevBtn")?.addEventListener("click", () => handlers.onChangePage(-1), { signal: this.bindingController.signal });
        document.getElementById("pageNextBtn")?.addEventListener("click", () => handlers.onChangePage(1), { signal: this.bindingController.signal });
        document.getElementById("copyJsonBtn")?.addEventListener("click", handlers.onCopyJson, { signal: this.bindingController.signal });
        document.getElementById("copyJsonBtnFooter")?.addEventListener("click", handlers.onCopyJson, { signal: this.bindingController.signal });
        document.getElementById("zipAllPdfsBtn")?.addEventListener("click", handlers.onZipAllPdfs, { signal: this.bindingController.signal });
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
                <td><button class="btn btn-danger btn-sm delete-teilnehmer" data-index="${index}" data-analytics-id="generator-delete-teilnehmer-${index}"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(row);
        });
    }

    public renderTeilnehmerSection(
        teilnehmerListe: string[],
        teilnehmerStellen: Record<string, string>,
        loesungswoerter: Record<string, string>,
        showStellenname: boolean
    ) {
        this.renderTeilnehmerListe(teilnehmerListe, teilnehmerStellen, loesungswoerter, showStellenname);
        this.updateLoesungswortOptionUI();
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

    public renderGeneratorStatus(uebung: FunkUebung, stats: UebungsDauerStats) {
        const set = (id: string, value: string) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
            }
        };
        const teilnehmerCount = uebung.teilnehmerListe?.filter(Boolean).length ?? 0;
        const nachrichtenCount = Object.values(uebung.nachrichten || {}).reduce((sum, list) => sum + list.length, 0);
        const mode = this.getSelectedLoesungswortOption();
        const modeLabel = mode === "none" ? "Keine" : mode === "central" ? "Zentral" : "Individuell";

        set("statusTeilnehmerCount", String(teilnehmerCount));
        set("statusNachrichtenCount", String(nachrichtenCount));
        set("statusLoesungswortMode", modeLabel);
        set("statusDauerEstimate", `${stats.optimal.toFixed(0)} Min`);
    }

    public renderLinks(uebung: FunkUebung) {
        const linkContainer = document.getElementById("uebung-links");
        const teilnehmerLinksContainer = document.getElementById("links-teilnehmer-container");

        if (!linkContainer || !teilnehmerLinksContainer) {
            return;
        }

        if (uebung.id) {
            const baseUrl = this.getBaseUrl();
            const urlUebung = `${baseUrl}#/generator/${uebung.id}`;
            const urlUebungLeitung = `${baseUrl}#/uebungsleitung/${uebung.id}`;

            teilnehmerLinksContainer.innerHTML = "";
            this.appendLinkRow(
                teilnehmerLinksContainer,
                "Übung",
                "-",
                urlUebung,
                this.createUebungMailtoLink(uebung.name || "Sprechfunk-Übung", urlUebung),
                uebung
            );
            this.appendLinkRow(
                teilnehmerLinksContainer,
                "Übungsleitung",
                "-",
                urlUebungLeitung,
                this.createUebungsleitungMailtoLink(uebung.name || "Sprechfunk-Übung", urlUebungLeitung)
            );

            if (uebung.teilnehmerIds) {
                Object.entries(uebung.teilnehmerIds).forEach(([id, name]) => {
                    const url = `${baseUrl}#/teilnehmer/${uebung.id}/${id}`;
                    this.appendLinkRow(
                        teilnehmerLinksContainer,
                        "Teilnehmer",
                        name,
                        url,
                        this.createMailtoLink(uebung.name || "Sprechfunk-Übung", name, url),
                        uebung
                    );
                });
            }

            linkContainer.style.display = "block";
        }
    }

    private appendLinkRow(
        container: HTMLElement,
        typ: string,
        name: string,
        url: string,
        mailtoUrl?: string,
        uebung?: FunkUebung
    ) {
        const row = document.createElement("div");
        row.className = "generator-link-row";
        row.setAttribute("data-link-type", typ.toLowerCase());

        const typeCell = document.createElement("div");
        typeCell.className = "generator-link-type";
        const typeBadge = document.createElement("span");
        typeBadge.className = `generator-link-badge ${this.getTypeBadgeClass(typ)}`;
        typeBadge.textContent = typ;
        typeCell.appendChild(typeBadge);
        row.appendChild(typeCell);

        const nameCell = document.createElement("div");
        nameCell.className = "generator-link-name";
        nameCell.textContent = name === "-" ? "Allgemein" : name;
        row.appendChild(nameCell);

        const linkCell = document.createElement("div");
        linkCell.className = "generator-link-url";
        const shortUrl = document.createElement("code");
        shortUrl.className = "small";
        shortUrl.title = url;
        shortUrl.textContent = this.shortenUrl(url, 70);
        linkCell.appendChild(shortUrl);
        row.appendChild(linkCell);

        const actionsCell = document.createElement("div");
        actionsCell.className = "generator-link-actions";

        const openLink = document.createElement("a");
        openLink.href = url;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.className = "btn btn-outline-primary btn-sm";
        openLink.innerHTML = "<i class=\"fas fa-arrow-up-right-from-square\"></i> Öffnen";
        actionsCell.appendChild(openLink);

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "btn btn-outline-secondary btn-sm";
        copyButton.setAttribute("data-analytics-id", `generator-link-copy-${typ.toLowerCase()}`);
        copyButton.innerHTML = "<i class=\"fas fa-copy\"></i> Kopieren";
        copyButton.addEventListener("click", () => {
            this.copyTextToClipboard(url)
                .then(() => this.showLinkActionFeedback("Link wurde kopiert.", false))
                .catch(() => this.showLinkActionFeedback("Kopieren fehlgeschlagen.", true));
        });
        actionsCell.appendChild(copyButton);

        if (mailtoUrl) {
            const mailButton = document.createElement("button");
            mailButton.type = "button";
            mailButton.className = "btn btn-outline-primary btn-sm";
            mailButton.setAttribute("data-analytics-id", `generator-link-mail-${typ.toLowerCase()}`);
            mailButton.innerHTML = "<i class=\"fas fa-envelope\"></i> Mail";
            mailButton.addEventListener("click", () => {
                window.location.href = mailtoUrl;
            });
            actionsCell.appendChild(mailButton);
        }

        if (uebung && typ === "Teilnehmer") {
            const downloadButton = document.createElement("button");
            downloadButton.type = "button";
            downloadButton.className = "btn btn-outline-success btn-sm";
            downloadButton.setAttribute("data-analytics-id", `generator-link-download-${name}`);
            downloadButton.innerHTML = "<i class=\"fas fa-file-archive\"></i> Druckdaten";
            downloadButton.addEventListener("click", async () => {
                const prevHtml = downloadButton.innerHTML;
                downloadButton.disabled = true;
                downloadButton.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i> Erstelle ZIP...";
                try {
                    await this.downloadTeilnehmerZip(uebung, name);
                    this.showLinkActionFeedback(`ZIP für ${name} heruntergeladen.`, false);
                } catch {
                    this.showLinkActionFeedback(`ZIP für ${name} konnte nicht erstellt werden.`, true);
                } finally {
                    downloadButton.disabled = false;
                    downloadButton.innerHTML = prevHtml;
                }
            });
            actionsCell.appendChild(downloadButton);
        }

        row.appendChild(actionsCell);
        container.appendChild(row);
    }

    private getTypeBadgeClass(typ: string): string {
        switch (typ.toLowerCase()) {
            case "übung":
                return "is-uebung";
            case "übungsleitung":
                return "is-leitung";
            case "teilnehmer":
                return "is-teilnehmer";
            default:
                return "";
        }
    }

    private shortenUrl(url: string, max: number): string {
        if (url.length <= max) {
            return url;
        }
        return `${url.slice(0, max - 1)}…`;
    }

    private showLinkActionFeedback(message: string, isError: boolean) {
        const el = document.getElementById("link-action-feedback");
        if (!el) {
            return;
        }
        el.textContent = message;
        el.classList.toggle("text-danger", isError);
        el.classList.toggle("text-success", !isError);
        window.setTimeout(() => {
            if (el.textContent === message) {
                el.textContent = "";
                el.classList.remove("text-danger", "text-success");
            }
        }, 2200);
    }

    private async copyTextToClipboard(text: string): Promise<void> {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    }

    private createMailtoLink(uebungsName: string, teilnehmerName: string, teilnehmerUrl: string): string {
        const subject = `Sprechfunk-Übung: ${uebungsName} - ${teilnehmerName}`;
        const bodyLines = [
            `Hallo ${teilnehmerName},`,
            "",
            `hier ist dein Link zur Teilnehmeransicht der Übung "${uebungsName}":`,
            teilnehmerUrl,
            "",
            "Du kannst die Ansicht während der Übung nutzen.",
            "Dort kannst du auch die Druckdaten herunterladen.",
            "",
            "Viele Grüße"
        ];

        return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    }

    private createUebungMailtoLink(uebungsName: string, uebungUrl: string): string {
        const subject = `Sprechfunk-Übung: ${uebungsName}`;
        const bodyLines = [
            "Hallo,",
            "",
            `hier ist der Link zur Übung "${uebungsName}":`,
            uebungUrl,
            "",
            "Viele Grüße"
        ];
        return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    }

    private createUebungsleitungMailtoLink(uebungsName: string, uebungsleitungUrl: string): string {
        const subject = `Sprechfunk-Übung: ${uebungsName} - Übungsleitung`;
        const bodyLines = [
            "Hallo,",
            "",
            `hier ist der Link für die Übungsleitung der Übung "${uebungsName}":`,
            uebungsleitungUrl,
            "",
            "Viele Grüße"
        ];
        return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    }

    private async downloadTeilnehmerZip(uebung: FunkUebung, teilnehmer: string): Promise<void> {
        const zipBlob = await pdfGenerator.generateTeilnehmerPDFsAsZip(uebung, teilnehmer);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${pdfGenerator.sanitizeFileName(teilnehmer)}_${pdfGenerator.sanitizeFileName(uebung.name)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    private getBaseUrl(): string {
        return `${window.location.origin}${window.location.pathname}`;
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

    public renderPreviewPage(page: PreviewPage | null) {
        if (!page) {
            return;
        }
        this.renderPreview(page.html, page.index, page.total);
    }

    public renderDuration(stats: UebungsDauerStats) {
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

    public copyJsonToClipboard(json: string) {
        this.showJsonModal(json);
        navigator.clipboard.writeText(json)
            .then(() => uiFeedback.success("JSON wurde kopiert."))
            .catch(() => uiFeedback.error("Kopieren fehlgeschlagen."));
    }

    public renderUebungResult(
        uebung: FunkUebung,
        stats: UebungsDauerStats,
        chart: VerteilungsStats
    ) {
        this.showOutputContainer();
        this.renderGeneratorStatus(uebung, stats);
        this.renderLinks(uebung);
        this.renderDuration(stats);
        this.renderChart(chart.labels, chart.counts);
    }

    public render(): void {
        const container = document.getElementById("mainAppArea");
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="app-view-shell">
            <!-- Hauptbereich mit Kopfdaten, Einstellungen und Teilnehmerverwaltung nebeneinander -->
            <div class="row g-3 generator-setup-layout">

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
                            <div class="generator-settings-section">
                                <div class="generator-settings-title">Nachrichtenverteilung</div>
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
                            </div>

                            <div class="generator-settings-section">
                                <div class="generator-settings-title">Quelle</div>
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
                            </div>

                            <div class="generator-settings-section">
                                <div class="generator-settings-title">Lösungswörter & Optionen</div>
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

                                <button id="shuffleButton" class="btn btn-primary" data-testid="generator-shuffle-loesungswoerter" data-analytics-id="generator-shuffle-loesungswoerter"
                                        style="display: none;">
                                    🔀 Lösungswörter Zufällig neu zuweisen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card für Teilnehmerverwaltung (rechts) -->
                <div class="col-lg-4">
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
                            <button id="addTeilnehmerBtn" class="btn btn-success mt-3" data-testid="generator-add-teilnehmer" data-analytics-id="generator-add-teilnehmer">Teilnehmer
                                hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="generator-action-bar mt-3">
                <div class="generator-action-inner">
                    <small class="text-muted">Prüfe Einstellungen und Teilnehmer, dann starte die Generierung.</small>
                    <button id="startUebungBtn" class="btn btn-success" data-testid="generator-start-uebung" data-analytics-id="generator-start-uebung">
                        <i class="fas fa-cogs"></i> Übung generieren
                    </button>
                </div>
            </div>

            <div class="generator-statusbar mt-3">
                <span class="generator-status-chip">Teilnehmer: <strong id="statusTeilnehmerCount">0</strong></span>
                <span class="generator-status-chip">Nachrichten: <strong id="statusNachrichtenCount">0</strong></span>
                <span class="generator-status-chip">Lösungswörter: <strong id="statusLoesungswortMode">Keine</strong></span>
                <span class="generator-status-chip">Dauer (opt.): <strong id="statusDauerEstimate">-</strong></span>
            </div>

            <div id="output-container" style="display: none; margin-top: 20px;">
                <div class="card generator-result-card">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="fas fa-layer-group"></i> Ergebnis</h5>
                    </div>
                    <div class="card-body">
                        <ul class="nav nav-pills generator-result-tabs mb-3" id="generatorResultTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" data-analytics-id="generator-tab-links"
                                        id="tab-links-btn"
                                        data-bs-toggle="tab"
                                        data-bs-target="#tab-links"
                                        type="button"
                                        role="tab"
                                        aria-controls="tab-links"
                                        aria-selected="true">
                                    Links
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" data-analytics-id="generator-tab-stats"
                                        id="tab-stats-btn"
                                        data-bs-toggle="tab"
                                        data-bs-target="#tab-stats"
                                        type="button"
                                        role="tab"
                                        aria-controls="tab-stats"
                                        aria-selected="false">
                                    Statistik
                                </button>
                            </li>
                        </ul>

                        <div class="tab-content" id="generatorResultTabsContent">
                            <div class="tab-pane fade show active" id="tab-links" role="tabpanel" aria-labelledby="tab-links-btn">
                                <div id="uebung-links" style="display: none;">
                                    <p class="text-muted small mb-3">
                                        Alle relevanten Links in einer Übersicht. Pro Zeile kannst du direkt öffnen, kopieren oder per Mail senden.
                                    </p>
                                    <div class="generator-link-grid-header">
                                        <span>Typ</span>
                                        <span>Name</span>
                                        <span>Link</span>
                                        <span>Aktionen</span>
                                    </div>
                                    <div id="links-teilnehmer-container" class="generator-link-grid"></div>
                                    <div class="mt-3">
                                        <button id="zipAllPdfsBtn" class="btn btn-primary btn-lg w-100 generator-zip-btn" data-analytics-id="generator-download-all-pdfs">
                                            📦 Alle Druckdaten als ZIP herunterladen
                                        </button>
                                        <p class="text-muted small mb-0 mt-2">
                                            Enthält alle Teilnehmer-PDFs und Vordrucke in einer Datei.
                                        </p>
                                    </div>
                                    <p id="link-action-feedback" class="small mt-2 mb-0" aria-live="polite"></p>
                                </div>
                            </div>

                            <div class="tab-pane fade" id="tab-stats" role="tabpanel" aria-labelledby="tab-stats-btn">
                                <div class="row">
                                    <div class="col-lg-5">
                                        <div class="card mb-3 mb-lg-0">
                                            <div class="card-header">
                                                <h6 class="mb-0"><i class="fas fa-chart-bar"></i> Nachrichtenverteilung</h6>
                                            </div>
                                            <div class="card-body">
                                                <canvas id="distributionChart"></canvas>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-lg-7">
                                        <div class="card mb-0">
                                            <div class="card-header">
                                                <h6 class="mb-0"><i class="fas fa-clock"></i> Geschätzte Dauer der Übung</h6>
                                            </div>
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
                                <button class="btn btn-secondary" data-bs-dismiss="modal" data-analytics-id="generator-json-modal-close">Schließen</button>
                                <button id="copyJsonBtn" class="btn btn-primary" data-analytics-id="generator-copy-json-modal">📋 In Zwischenablage
                                    kopieren
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            </div>
        `;
    }
}
