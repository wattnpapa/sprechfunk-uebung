/**
 * Formularteil der Führungsstellen-Übung im Generator: Drehbuch-Auswahl,
 * Rollenbesetzung (beübte Stelle, übergeordnete Stelle, Einsatzabschnitte,
 * je mit Funkrufname und Stellenname) und der Drehbuch-Download. Reine DOM-Arbeit; die Grenzen der
 * Abschnittszahl kommen vom Controller aus dem gewählten Drehbuch.
 */

/** Rollenbesetzung, wie das Formular sie liefert (ohne Slug). */
export interface FuehrungsstellenRollenFormular {
    beuebteStelle: string;
    uebergeordnet: string;
    unterstellt: string[];
    beginn?: string;
    /** Stellenname je Funkrufname; nur gefüllte Felder. */
    stellen?: Record<string, string>;
}

/** Eine Zeile der Abschnittsliste: Funkrufname und Stellenname. */
export interface AbschnittZeile {
    funkrufname: string;
    stelle: string;
}

/** Erlaubte Zahl von Einsatzabschnitten laut gewähltem Drehbuch. */
export interface AbschnittsGrenzen {
    min: number;
    max: number;
}

export class GeneratorFuehrungsstellenForm {
    public populateSelect(uebungen: Record<string, { titel: string }>, selected?: string): void {
        const selectBox = document.getElementById("fuehrungsstelleAuswahl") as HTMLSelectElement | null;
        if (!selectBox) {
            return;
        }
        selectBox.innerHTML = "";
        for (const [slug, eintrag] of Object.entries(uebungen)) {
            const option = document.createElement("option");
            option.value = slug;
            option.textContent = eintrag.titel;
            option.selected = slug === selected;
            selectBox.appendChild(option);
        }
    }

    public getSelected(): string {
        const selectBox = document.getElementById("fuehrungsstelleAuswahl") as HTMLSelectElement | null;
        return selectBox?.value ?? "";
    }

    public bindChange(onChange: () => void, signal: AbortSignal): void {
        document.getElementById("fuehrungsstelleAuswahl")?.addEventListener("change", () => onChange(), { signal });
    }

    /** Hinzufügen und Entfernen von Einsatzabschnitten; die Liste selbst rendert der Controller neu. */
    public bindAbschnittEvents(onAdd: () => void, onRemove: (index: number) => void, signal: AbortSignal): void {
        document.getElementById("fuehrungsstelleAbschnittHinzufuegen")?.addEventListener("click", () => onAdd(), { signal });
        document.getElementById("fuehrungsstelleAbschnitte")?.addEventListener("click", e => {
            const btn = (e.target as HTMLElement).closest(".fuehrungsstelle-abschnitt-entfernen") as HTMLElement | null;
            if (btn) {
                onRemove(Number(btn.dataset["index"]));
            }
        }, { signal });
    }

    public setRollen(rollen: FuehrungsstellenRollenFormular, grenzen: AbschnittsGrenzen): void {
        const stellen = rollen.stellen ?? {};
        this.setWert("fuehrungsstelleBeuebteStelle", rollen.beuebteStelle);
        this.setWert("fuehrungsstelleBeuebteStelleName", stellen[rollen.beuebteStelle] ?? "");
        this.setWert("fuehrungsstelleUebergeordnet", rollen.uebergeordnet);
        this.setWert("fuehrungsstelleUebergeordnetName", stellen[rollen.uebergeordnet] ?? "");
        this.setWert("fuehrungsstelleBeginn", rollen.beginn ?? "");
        this.renderAbschnitte(
            rollen.unterstellt.map(funkrufname => ({ funkrufname, stelle: stellen[funkrufname] ?? "" })),
            grenzen
        );
    }

    public getRollen(): FuehrungsstellenRollenFormular {
        const abschnitte = this.getAbschnittZeilen();
        const beuebteStelle = this.wert("fuehrungsstelleBeuebteStelle");
        const uebergeordnet = this.wert("fuehrungsstelleUebergeordnet");
        const beginn = this.wert("fuehrungsstelleBeginn");
        const stellen: Record<string, string> = {};
        const merke = (funkrufname: string, stelle: string): void => {
            if (funkrufname && stelle) {
                stellen[funkrufname] = stelle;
            }
        };
        merke(beuebteStelle, this.wert("fuehrungsstelleBeuebteStelleName"));
        merke(uebergeordnet, this.wert("fuehrungsstelleUebergeordnetName"));
        abschnitte.forEach(zeile => merke(zeile.funkrufname, zeile.stelle));
        return {
            beuebteStelle,
            uebergeordnet,
            unterstellt: abschnitte.map(zeile => zeile.funkrufname),
            ...(beginn ? { beginn } : {}),
            ...(Object.keys(stellen).length > 0 ? { stellen } : {})
        };
    }

    /** Die Abschnittszeilen, wie sie gerade im Formular stehen (getrimmt). */
    public getAbschnittZeilen(): AbschnittZeile[] {
        return Array.from(
            document.querySelectorAll<HTMLElement>("#fuehrungsstelleAbschnitte .fuehrungsstelle-abschnitt-zeile")
        ).map(zeile => ({
            funkrufname: (zeile.querySelector<HTMLInputElement>(".fuehrungsstelle-abschnitt")?.value ?? "").trim(),
            stelle: (zeile.querySelector<HTMLInputElement>(".fuehrungsstelle-abschnitt-stelle")?.value ?? "").trim()
        }));
    }

    private wert(id: string): string {
        return ((document.getElementById(id) as HTMLInputElement | null)?.value ?? "").trim();
    }

    private setWert(id: string, wert: string): void {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input) {
            input.value = wert;
        }
    }

    public renderAbschnitte(zeilen: AbschnittZeile[], grenzen: AbschnittsGrenzen): void {
        const container = document.getElementById("fuehrungsstelleAbschnitte");
        if (!container) {
            return;
        }
        container.innerHTML = "";
        zeilen.forEach((zeile, index) => {
            container.appendChild(this.buildAbschnittZeile(zeile, index, zeilen.length <= grenzen.min));
        });
        const hinzufuegen = document.getElementById("fuehrungsstelleAbschnittHinzufuegen") as HTMLButtonElement | null;
        if (hinzufuegen) {
            hinzufuegen.disabled = zeilen.length >= grenzen.max;
        }
        const hinweis = document.getElementById("fuehrungsstelleAbschnitteHinweis");
        if (hinweis) {
            hinweis.textContent = grenzen.min === grenzen.max
                ? `Das Drehbuch ist für ${grenzen.max} Einsatzabschnitte ausgelegt.`
                : `Das Drehbuch ist für ${grenzen.min} bis ${grenzen.max} Einsatzabschnitte ausgelegt; ` +
                  "bei weniger Abschnitten führt ein Abschnitt mehrere Einsatzstellen.";
        }
    }

    private buildAbschnittZeile(daten: AbschnittZeile, index: number, entfernenGesperrt: boolean): HTMLElement {
        const zeile = document.createElement("div");
        zeile.className = "input-group input-group-sm mb-1 fuehrungsstelle-abschnitt-zeile";
        const label = document.createElement("span");
        label.className = "input-group-text";
        label.textContent = `EA ${index + 1}`;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control fuehrungsstelle-abschnitt";
        input.dataset["index"] = String(index);
        input.value = daten.funkrufname;
        input.placeholder = "Funkrufname";
        input.setAttribute("aria-label", `Funkrufname Einsatzabschnitt ${index + 1}`);
        const stelle = document.createElement("input");
        stelle.type = "text";
        stelle.className = "form-control fuehrungsstelle-abschnitt-stelle";
        stelle.dataset["index"] = String(index);
        stelle.value = daten.stelle;
        stelle.placeholder = `Stellenname, z. B. Einsatzabschnitt ${index + 1}`;
        stelle.setAttribute("aria-label", `Stellenname Einsatzabschnitt ${index + 1}`);
        const entfernen = document.createElement("button");
        entfernen.type = "button";
        entfernen.className = "btn btn-outline-secondary fuehrungsstelle-abschnitt-entfernen";
        entfernen.dataset["index"] = String(index);
        entfernen.textContent = "×";
        entfernen.setAttribute("aria-label", `Einsatzabschnitt ${index + 1} entfernen`);
        entfernen.disabled = entfernenGesperrt;
        zeile.append(label, input, stelle, entfernen);
        return zeile;
    }

    public toggleDownloads(sichtbar: boolean): void {
        const el = document.getElementById("fuehrungsstelleDownloads");
        if (el) {
            el.style.display = sichtbar ? "block" : "none";
        }
    }
}
