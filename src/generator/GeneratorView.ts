import { FunkUebung } from "../models/FunkUebung";
import { MultiSelect } from "../core/MultiSelect";
import type { UebungsDauerStats, VerteilungsStats } from "./GeneratorStatsService";
import type { PreviewPage } from "./GeneratorPreviewService";
import { uiFeedback } from "../core/UiFeedback";
import { GENERATOR_VIEW_MARKUP } from "./viewMarkup";
import type { LoesungswortOption } from "./GeneratorStateService";
import {
    getFormData,
    setFormData,
    syncDistributionFromPercentInputs,
    updateDistributionInputs,
    updateNachrichtenArtOptionsVisibility,
    updateXZeitOptionsVisibility
} from "./GeneratorFormularDom";
import {
    getSelectedLoesungswortOption,
    getZentralesLoesungswort,
    selectLoesungswortOption,
    setLoesungswortUI,
    updateLoesungswortOptionUI
} from "./GeneratorLoesungswortDom";
import {
    type FunkspruchQuelle,
    getSelectedSource,
    getSelectedTemplates,
    populateSzenarioSelect,
    populateTemplateSelect,
    renderInfoZeilen,
    setSelectedSource,
    toggleSourceView
} from "./GeneratorQuelleDom";
import { GeneratorLinksRenderer } from "./GeneratorLinksRenderer";
import { bindeTeilnehmerContainer, GeneratorTeilnehmerTableRenderer } from "./GeneratorTeilnehmerTableRenderer";
import { GeneratorResultRenderer } from "./GeneratorResultRenderer";
import {
    GeneratorFuehrungsstellenForm,
    type AbschnittsGrenzen,
    type AbschnittZeile,
    type FuehrungsstellenRollenFormular
} from "./GeneratorFuehrungsstellenForm";

export type { AbschnittsGrenzen, AbschnittZeile, FuehrungsstellenRollenFormular, FunkspruchQuelle };

export class GeneratorView {
    private bindingController = new AbortController();
    private linksRenderer = new GeneratorLinksRenderer();
    private teilnehmerRenderer = new GeneratorTeilnehmerTableRenderer();
    private resultRenderer = new GeneratorResultRenderer();
    private fuehrungsstellenForm = new GeneratorFuehrungsstellenForm();
    private templatePicker: MultiSelect | null = null;

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
        return getFormData();
    }

    public setFormData(uebung: FunkUebung) {
        setFormData(uebung);
    }

    public updateXZeitOptionsVisibility(): void {
        updateXZeitOptionsVisibility();
    }

    public updateNachrichtenArtOptionsVisibility(): void {
        updateNachrichtenArtOptionsVisibility();
    }

    public bindNachrichtenArtToggle(onChange: (aktiv: boolean) => void): void {
        const checkbox = document.getElementById("nachrichtenArtAktiv") as HTMLInputElement | null;
        checkbox?.addEventListener("change", () => {
            updateNachrichtenArtOptionsVisibility();
            onChange(checkbox.checked);
        }, { signal: this.bindingController.signal });
    }

    public bindSpielModusToggle(): void {
        document.querySelectorAll<HTMLInputElement>("input[name=\"spielModus\"]").forEach(radio => {
            radio.addEventListener("change", () => updateXZeitOptionsVisibility(), { signal: this.bindingController.signal });
        });
    }

    public updateDistributionInputs(uebung: FunkUebung) {
        updateDistributionInputs(uebung);
    }

    public setLoesungswortUI(loesungswoerter: Record<string, string>) {
        setLoesungswortUI(loesungswoerter);
    }

    public updateLoesungswortOptionUI() {
        updateLoesungswortOptionUI();
    }

    public selectLoesungswortOption(option: LoesungswortOption) {
        selectLoesungswortOption(option);
    }

    public getSelectedLoesungswortOption(): LoesungswortOption {
        return getSelectedLoesungswortOption();
    }

    public getZentralesLoesungswort(): string {
        return getZentralesLoesungswort();
    }

    public bindDistributionInputs(onChange: (data: Partial<FunkUebung>) => void) {
        const ids = ["spruecheProTeilnehmer", "prozentAnAlle", "prozentAnMehrere", "prozentAnBuchstabieren"];
        ids.forEach(id => {
            document.getElementById(id)?.addEventListener("input", () => {
                syncDistributionFromPercentInputs();
                const data = this.getFormData();
                onChange(data);
            }, { signal: this.bindingController.signal });
        });
    }

    public bindSourceToggle(onChange?: (source: FunkspruchQuelle) => void) {
        const bind = (id: string, source: FunkspruchQuelle) => {
            document.getElementById(id)?.addEventListener("change", () => {
                this.toggleSourceView(source);
                onChange?.(source);
            }, { signal: this.bindingController.signal });
        };
        bind("optionVorlagen", "vorlagen");
        bind("optionUpload", "upload");
        bind("optionSzenario", "szenario");
        bind("optionFuehrungsstelle", "fuehrungsstelle");
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
        bindeTeilnehmerContainer(this.bindingController.signal, {
            onTeilnehmerNameChange, onStellennameChange, onDelete, onShowStellennameToggle
        });
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
        onDownloadUebersichtPdf: () => void;
        onDrehbuchPdf: () => void;
    }) {
        document.getElementById("addTeilnehmerBtn")?.addEventListener("click", handlers.onAddTeilnehmer, { signal: this.bindingController.signal });
        document.getElementById("startUebungBtn")?.addEventListener("click", handlers.onStartUebung, { signal: this.bindingController.signal });
        document.getElementById("pagePrevBtn")?.addEventListener("click", () => handlers.onChangePage(-1), { signal: this.bindingController.signal });
        document.getElementById("pageNextBtn")?.addEventListener("click", () => handlers.onChangePage(1), { signal: this.bindingController.signal });
        document.getElementById("copyJsonBtn")?.addEventListener("click", handlers.onCopyJson, { signal: this.bindingController.signal });
        document.getElementById("copyJsonBtnFooter")?.addEventListener("click", handlers.onCopyJson, { signal: this.bindingController.signal });
        document.getElementById("zipAllPdfsBtn")?.addEventListener("click", handlers.onZipAllPdfs, { signal: this.bindingController.signal });
        document.getElementById("uebersichtAllPdfBtn")?.addEventListener("click", handlers.onDownloadUebersichtPdf, { signal: this.bindingController.signal });
        document.getElementById("drehbuchPdfBtn")?.addEventListener("click", handlers.onDrehbuchPdf, { signal: this.bindingController.signal });
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
        populateTemplateSelect(templates, selected);
    }

    public getSelectedTemplates(): string[] {
        return getSelectedTemplates();
    }

    public getSelectedSource(): FunkspruchQuelle {
        return getSelectedSource();
    }

    public getUploadedFile(): File | undefined {
        return (document.getElementById("funksprueche") as HTMLInputElement).files?.[0];
    }

    public setSelectedSource(source: FunkspruchQuelle) {
        setSelectedSource(source);
    }

    public toggleSourceView(source: FunkspruchQuelle) {
        toggleSourceView(source);
    }

    public populateSzenarioSelect(szenarien: Record<string, { titel: string }>, selected?: string) {
        populateSzenarioSelect(szenarien, selected);
    }

    public getSelectedSzenario(): string {
        const selectBox = document.getElementById("szenarioAuswahl") as HTMLSelectElement | null;
        return selectBox?.value ?? "";
    }

    public bindSzenarioChange(onChange: () => void) {
        document.getElementById("szenarioAuswahl")?.addEventListener("change", () => onChange(), {
            signal: this.bindingController.signal
        });
    }

    public renderSzenarioInfo(zeilen: string[]) {
        renderInfoZeilen("szenarioInfo", zeilen);
    }


    // --- Führungsstellen-Übung (Formularteil in GeneratorFuehrungsstellenForm) ---

    public populateFuehrungsstelleSelect(uebungen: Record<string, { titel: string }>, selected?: string) {
        this.fuehrungsstellenForm.populateSelect(uebungen, selected);
    }

    public getSelectedFuehrungsstelle(): string {
        return this.fuehrungsstellenForm.getSelected();
    }

    public bindFuehrungsstelleChange(onChange: () => void) {
        this.fuehrungsstellenForm.bindChange(onChange, this.bindingController.signal);
    }

    public renderFuehrungsstelleInfo(zeilen: string[]) {
        renderInfoZeilen("fuehrungsstelleInfo", zeilen);
    }

    public bindFuehrungsstellenAbschnittEvents(onAdd: () => void, onRemove: (index: number) => void) {
        this.fuehrungsstellenForm.bindAbschnittEvents(onAdd, onRemove, this.bindingController.signal);
    }

    public setFuehrungsstellenRollen(rollen: FuehrungsstellenRollenFormular, grenzen: AbschnittsGrenzen) {
        this.fuehrungsstellenForm.setRollen(rollen, grenzen);
    }

    public getFuehrungsstellenRollen(): FuehrungsstellenRollenFormular {
        return this.fuehrungsstellenForm.getRollen();
    }

    public renderFuehrungsstellenAbschnitte(zeilen: AbschnittZeile[], grenzen: AbschnittsGrenzen) {
        this.fuehrungsstellenForm.renderAbschnitte(zeilen, grenzen);
    }

    public getFuehrungsstellenAbschnitte(): AbschnittZeile[] {
        return this.fuehrungsstellenForm.getAbschnittZeilen();
    }

    public toggleFuehrungsstelleDownloads(sichtbar: boolean) {
        this.fuehrungsstellenForm.toggleDownloads(sichtbar);
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
        // Das Markup wird bei jedem render() neu gesetzt, das <select> ist also
        // jedes Mal ein frisches Element und braucht das Widget erneut.
        this.templatePicker?.destroy();
        this.templatePicker = MultiSelect.enhance(
            document.getElementById("funkspruchVorlage") as HTMLSelectElement | null,
            {
                placeholder: "Vorlagen auswählen ...",
                search: "Vorlage suchen ...",
                empty: "Keine passende Vorlage"
            }
        );
    }
}
