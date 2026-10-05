import { escapeHtml } from "../utils/html";

interface RenderTeilnehmerOptions {
    teilnehmerListe: string[];
    teilnehmerStellen: Record<string, string>;
    loesungswoerter: Record<string, string>;
    showStellenname: boolean;
    loesungswortOption: "none" | "central" | "individual";
}

export class GeneratorTeilnehmerTableRenderer {
    public render(container: HTMLElement, options: RenderTeilnehmerOptions): void {
        const { teilnehmerListe, teilnehmerStellen, loesungswoerter, showStellenname, loesungswortOption } = options;
        container.innerHTML = this.buildCheckboxHtml(showStellenname) + this.buildTableShell(showStellenname, loesungswortOption === "individual");
        const tbody = container.querySelector("#teilnehmer-body");
        if (!tbody) {
            return;
        }
        teilnehmerListe.forEach((teilnehmer, index) => {
            const row = document.createElement("tr");
            row.innerHTML = this.buildRowHtml({
                teilnehmer,
                index,
                stellenname: teilnehmerStellen?.[teilnehmer] ?? "",
                loesungswort: loesungswoerter[teilnehmer] || "",
                showStellenname,
                isIndividuell: loesungswortOption === "individual"
            });
            tbody.appendChild(row);
        });
    }

    private buildCheckboxHtml(showStellenname: boolean): string {
        return `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="showStellennameCheckbox" ${showStellenname ? "checked" : ""}>
                <label class="form-check-label" for="showStellennameCheckbox">Stellenname anzeigen</label>
                <small class="form-text text-muted d-block">Bezeichnung der Stelle, z. B. „Zugtrupp“. Steht auf den Vordrucken als Anschrift und in der Übungsleitung neben dem Funkrufnamen.</small>
            </div>
        `;
    }

    private buildTableShell(showStellenname: boolean, isIndividuell: boolean): string {
        let tableHeaders = "<th>Funkrufnamen</th>";
        if (showStellenname) {
            tableHeaders += "<th>Name der Stelle</th>";
        }
        if (isIndividuell) {
            tableHeaders += "<th id='loesungswortHeader'>Lösungswort</th>";
        }
        tableHeaders += "<th style=\"width: 50px;\">Aktion</th>";
        return `
            <div class="table-responsive generator-teilnehmer-tabelle">
                <table class="table table-bordered">
                    <thead class="table-dark">
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody id="teilnehmer-body"></tbody>
                </table>
            </div>
        `;
    }

    private buildRowHtml(options: {
        teilnehmer: string;
        index: number;
        stellenname: string;
        loesungswort: string;
        showStellenname: boolean;
        isIndividuell: boolean;
    }): string {
        const { teilnehmer, index, stellenname, loesungswort, showStellenname, isIndividuell } = options;
        const stellenInput = showStellenname
            ? `<td>
                    <input type="text" class="form-control stellenname-input" data-index="${index}" value="${escapeHtml(stellenname)}" placeholder="Name der Stelle" aria-label="Name der Stelle für Teilnehmer ${index + 1}">
               </td>`
            : "";
        const loesungswortInput = isIndividuell
            ? `<td><input type="text" class="form-control loesungswort-input" id="loesungswort-${index}" value="${escapeHtml(loesungswort)}" placeholder="Lösungswort" aria-label="Lösungswort für Teilnehmer ${index + 1}"></td>`
            : "";
        return `
            <td>
                <input type="text" class="form-control teilnehmer-input" data-index="${index}" value="${escapeHtml(teilnehmer)}" placeholder="Funkrufname Teilnehmer ${index + 1}" aria-label="Funkrufname Teilnehmer ${index + 1}">
            </td>
            ${stellenInput}
            ${loesungswortInput}
            <td><button class="btn btn-danger btn-sm delete-teilnehmer" data-index="${index}" aria-label="Teilnehmer ${index + 1} entfernen" title="Teilnehmer entfernen"><i class="fas fa-trash" aria-hidden="true"></i></button></td>
        `;
    }
}

export interface TeilnehmerHandler {
    onTeilnehmerNameChange: (index: number, val: string) => void;
    onStellennameChange: (index: number, val: string) => void;
    onDelete: (index: number) => void;
    onShowStellennameToggle: (checked: boolean) => void;
}

/** Ereignisse der Teilnehmertabelle, delegiert am Container. */
export function bindeTeilnehmerContainer(signal: AbortSignal, handler: TeilnehmerHandler): void {
    const container = document.getElementById("teilnehmer-container");
    if (!container) {
        return;
    }
    container.addEventListener("input", e => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("teilnehmer-input")) {
            handler.onTeilnehmerNameChange(Number(target.dataset["index"]), (target as HTMLInputElement).value);
        }
        if (target.classList.contains("stellenname-input")) {
            handler.onStellennameChange(Number(target.dataset["index"]), (target as HTMLInputElement).value);
        }
    }, { signal });

    container.addEventListener("click", e => {
        const btn = (e.target as HTMLElement).closest(".delete-teilnehmer") as HTMLElement;
        if (btn) {
            handler.onDelete(Number(btn.dataset["index"]));
        }
    }, { signal });

    container.addEventListener("change", e => {
        const target = e.target as HTMLInputElement;
        if (target.id === "showStellennameCheckbox") {
            handler.onShowStellennameToggle(target.checked);
        }
    }, { signal });
}
