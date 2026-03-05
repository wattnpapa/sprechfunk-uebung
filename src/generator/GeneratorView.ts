import { FunkUebung } from "../models/FunkUebung";
import $ from "../core/select2-setup";
import type { UebungsDauerStats, VerteilungsStats } from "./GeneratorStatsService";
import type { PreviewPage } from "./GeneratorPreviewService";
import { uiFeedback } from "../core/UiFeedback";
import { GENERATOR_VIEW_MARKUP } from "./viewMarkup";
import { GeneratorLinksRenderer } from "./GeneratorLinksRenderer";
import { GeneratorTeilnehmerTableRenderer } from "./GeneratorTeilnehmerTableRenderer";
import { GeneratorResultRenderer } from "./GeneratorResultRenderer";

export class GeneratorView {
    private bindingController = new AbortController();
    private linksRenderer = new GeneratorLinksRenderer();
    private teilnehmerRenderer = new GeneratorTeilnehmerTableRenderer();
    private resultRenderer = new GeneratorResultRenderer();
    
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

        const zentraleWorte = this.getZentraleWorte(loesungswoerter);
        
        this.applyLoesungswortSelection({
            hasWords: !!loesungswoerter && Object.keys(loesungswoerter).length > 0,
            zentraleWorte,
            noneRadio,
            centralRadio,
            indivRadio,
            centralInput
        });

        this.updateLoesungswortOptionUI();
    }

    private applyLoesungswortSelection(options: {
        hasWords: boolean;
        zentraleWorte: Set<string>;
        noneRadio: HTMLInputElement;
        centralRadio: HTMLInputElement;
        indivRadio: HTMLInputElement;
        centralInput: HTMLInputElement;
    }): void {
        const {
            hasWords,
            zentraleWorte,
            noneRadio,
            centralRadio,
            indivRadio,
            centralInput
        } = options;
        if (!hasWords) {
            noneRadio.checked = true;
            return;
        }
        if (zentraleWorte.size === 1) {
            centralRadio.checked = true;
            centralInput.value = [...zentraleWorte][0] ?? "";
            return;
        }
        indivRadio.checked = true;
    }

    private getZentraleWorte(loesungswoerter: Record<string, string>): Set<string> {
        return new Set(
            Object.values(loesungswoerter || {}).filter(
                (wort): wort is string => typeof wort === "string" && wort.trim().length > 0
            )
        );
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
        onStellennameChange: (index: number, val: string) => void,
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
                const index = Number(target.dataset["index"]);
                const newVal = (target as HTMLInputElement).value;
                onStellennameChange(index, newVal);
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

    public bindQuickJoin(onSubmit: (uebungCode: string, teilnehmerCode: string) => void): void {
        const form = document.getElementById("generatorQuickJoinForm") as HTMLFormElement | null;
        if (!form) {
            return;
        }

        form.addEventListener("submit", event => {
            event.preventDefault();
            const uebungCodeInput = document.getElementById("generatorQuickJoinUebungCode") as HTMLInputElement | null;
            const teilnehmerCodeInput = document.getElementById("generatorQuickJoinTeilnehmerCode") as HTMLInputElement | null;
            const uebungCode = (uebungCodeInput?.value || "").trim().toUpperCase();
            const teilnehmerCode = (teilnehmerCodeInput?.value || "").trim().toUpperCase();
            onSubmit(uebungCode, teilnehmerCode);
        }, { signal: this.bindingController.signal });
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
        this.teilnehmerRenderer.render(container, {
            teilnehmerListe,
            teilnehmerStellen,
            loesungswoerter,
            showStellenname,
            loesungswortOption: this.getSelectedLoesungswortOption()
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
        this.resultRenderer.renderGeneratorStatus(uebung, stats, this.getSelectedLoesungswortOption());
    }

    public renderLinks(uebung: FunkUebung) {
        this.linksRenderer.renderLinks(uebung);
    }

    public renderPreview(html: string, index: number, total: number) {
        this.resultRenderer.renderPreview({ html, index, total });
    }

    public renderPreviewPage(page: PreviewPage | null) {
        this.resultRenderer.renderPreview(page);
    }

    public renderDuration(stats: UebungsDauerStats) {
        this.resultRenderer.renderDuration(stats);
    }

    public renderChart(labels: string[], data: number[]) {
        this.resultRenderer.renderChart({ labels, counts: data });
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
        container.innerHTML = GENERATOR_VIEW_MARKUP;
    }
}
