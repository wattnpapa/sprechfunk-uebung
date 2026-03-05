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
            <table class="table table-bordered">
                <thead class="table-dark">
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody id="teilnehmer-body"></tbody>
            </table>
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
                    <input type="text" class="form-control stellenname-input" data-index="${index}" value="${stellenname}" placeholder="Name der Stelle">
               </td>`
            : "";
        const loesungswortInput = isIndividuell
            ? `<td><input type="text" class="form-control loesungswort-input" id="loesungswort-${index}" value="${loesungswort}" placeholder="Lösungswort"></td>`
            : "";
        return `
            <td>
                <input type="text" class="form-control teilnehmer-input" data-index="${index}" value="${teilnehmer}">
            </td>
            ${stellenInput}
            ${loesungswortInput}
            <td><button class="btn btn-danger btn-sm delete-teilnehmer" data-index="${index}" data-analytics-id="generator-delete-teilnehmer-${index}"><i class="fas fa-trash"></i></button></td>
        `;
    }
}
