import { FunkUebung } from "../models/FunkUebung";
import pdfGenerator from "../services/pdfGenerator";

interface LinkRowOptions {
    typ: string;
    name: string;
    url: string;
    mailtoUrl?: string;
    uebung?: FunkUebung;
    codeText?: string;
    copyValue?: string;
}

interface TeilnehmerMailtoOptions {
    uebungsName: string;
    teilnehmerName: string;
    teilnehmerUrl: string;
    uebungCode: string;
    teilnehmerCode: string;
}

export class GeneratorLinksRenderer {
    public renderLinks(uebung: FunkUebung): void {
        const linkContainer = document.getElementById("uebung-links");
        const teilnehmerLinksContainer = document.getElementById("links-teilnehmer-container");

        if (!linkContainer || !teilnehmerLinksContainer || !uebung.id) {
            return;
        }

        const baseUrl = this.getBaseUrl();
        const urlUebung = `${baseUrl}#/generator/${uebung.id}`;
        const urlUebungLeitung = `${baseUrl}#/uebungsleitung/${uebung.id}`;
        const uebungCode = (uebung.uebungCode || "").toUpperCase();

        teilnehmerLinksContainer.innerHTML = "";
        this.appendLinkRow(
            teilnehmerLinksContainer,
            {
                typ: "Übung",
                name: "-",
                url: urlUebung,
                mailtoUrl: this.createUebungMailtoLink(uebung.name || "Sprechfunk-Übung", urlUebung),
                uebung
            }
        );
        this.appendLinkRow(
            teilnehmerLinksContainer,
            {
                typ: "Übungsleitung",
                name: "-",
                url: urlUebungLeitung,
                mailtoUrl: this.createUebungsleitungMailtoLink(uebung.name || "Sprechfunk-Übung", urlUebungLeitung)
            }
        );

        if (uebung.teilnehmerIds) {
            Object.entries(uebung.teilnehmerIds).forEach(([participantCode, name]) => {
                const normalizedParticipantCode = participantCode.toUpperCase();
                const joinUrl = this.createTeilnehmerJoinUrl(uebungCode, normalizedParticipantCode);
                const joinText = [
                    `Teilnehmer-Zugang für "${uebung.name || "Sprechfunk-Übung"}"`,
                    `URL: ${joinUrl}`,
                    `Teilnehmer Code: ${uebungCode} / ${normalizedParticipantCode}`
                ].join("\n");
                this.appendLinkRow(
                    teilnehmerLinksContainer,
                    {
                        typ: "Teilnehmer",
                        name,
                        url: joinUrl,
                        mailtoUrl: this.createMailtoLink({
                            uebungsName: uebung.name || "Sprechfunk-Übung",
                            teilnehmerName: name,
                            teilnehmerUrl: joinUrl,
                            uebungCode,
                            teilnehmerCode: normalizedParticipantCode
                        }),
                        uebung,
                        codeText: `Teilnehmer Code: ${uebungCode} / ${normalizedParticipantCode}`,
                        copyValue: joinText
                    }
                );
            });
        }

        linkContainer.style.display = "block";
    }

    private appendLinkRow(container: HTMLElement, options: LinkRowOptions): void {
        const { typ, name, url, mailtoUrl, uebung, codeText, copyValue } = options;
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
        if (codeText) {
            const codes = document.createElement("div");
            codes.className = "small mt-1 text-muted";
            codes.textContent = codeText;
            linkCell.appendChild(codes);
        }
        row.appendChild(linkCell);

        const actionsCell = document.createElement("div");
        actionsCell.className = "generator-link-actions";

        actionsCell.appendChild(this.createOpenLinkButton(url));
        actionsCell.appendChild(this.createCopyLinkButton(typ, copyValue || url));

        if (mailtoUrl) {
            actionsCell.appendChild(this.createMailLinkButton(typ, mailtoUrl));
        }

        if (uebung && typ === "Teilnehmer") {
            actionsCell.appendChild(this.createTeilnehmerDownloadButton(uebung, name));
        }

        row.appendChild(actionsCell);
        container.appendChild(row);
    }

    private createOpenLinkButton(url: string): HTMLAnchorElement {
        const openLink = document.createElement("a");
        openLink.href = url;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.className = "btn btn-outline-primary btn-sm";
        openLink.innerHTML = "<i class=\"fas fa-arrow-up-right-from-square\"></i> Öffnen";
        return openLink;
    }

    private createCopyLinkButton(typ: string, value: string): HTMLButtonElement {
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "btn btn-outline-secondary btn-sm";
        copyButton.setAttribute("data-analytics-id", `generator-link-copy-${typ.toLowerCase()}`);
        copyButton.innerHTML = "<i class=\"fas fa-copy\"></i> Kopieren";
        copyButton.addEventListener("click", () => {
            this.copyTextToClipboard(value)
                .then(() => this.showLinkActionFeedback("Zugangsdaten wurden kopiert.", false))
                .catch(() => this.showLinkActionFeedback("Kopieren fehlgeschlagen.", true));
        });
        return copyButton;
    }

    private createMailLinkButton(typ: string, mailtoUrl: string): HTMLButtonElement {
        const mailButton = document.createElement("button");
        mailButton.type = "button";
        mailButton.className = "btn btn-outline-primary btn-sm";
        mailButton.setAttribute("data-analytics-id", `generator-link-mail-${typ.toLowerCase()}`);
        mailButton.innerHTML = "<i class=\"fas fa-envelope\"></i> Mail";
        mailButton.addEventListener("click", () => {
            window.location.href = mailtoUrl;
        });
        return mailButton;
    }

    private createTeilnehmerDownloadButton(uebung: FunkUebung, name: string): HTMLButtonElement {
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
        return downloadButton;
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

    private showLinkActionFeedback(message: string, isError: boolean): void {
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

    private createMailtoLink(options: TeilnehmerMailtoOptions): string {
        const { uebungsName, teilnehmerName, teilnehmerUrl, uebungCode, teilnehmerCode } = options;
        const subject = `Sprechfunk-Übung: ${uebungsName} - ${teilnehmerName}`;
        const bodyLines = [
            `Hallo ${teilnehmerName},`,
            "",
            `hier ist dein Zugang zur Teilnehmeransicht der Übung "${uebungsName}":`,
            teilnehmerUrl,
            "",
            `Übungscode: ${uebungCode}`,
            `Teilnehmercode: ${teilnehmerCode}`,
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

    private createTeilnehmerJoinUrl(uebungCode: string, teilnehmerCode: string): string {
        const params = new URLSearchParams();
        params.set("uc", uebungCode);
        params.set("tc", teilnehmerCode);
        return `${this.getBaseUrl()}#/teilnehmer?${params.toString()}`;
    }
}
