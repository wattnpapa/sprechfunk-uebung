/**
 * Formularteil der Führungsstellen-Übung im Generator: Drehbuch-Auswahl,
 * Rollenbesetzung (beübte Stelle, übergeordnete Stelle, Einsatzabschnitte)
 * und der Drehbuch-Download. Reine DOM-Arbeit; die Grenzen der
 * Abschnittszahl kommen vom Controller aus dem gewählten Drehbuch.
 */

/** Rollenbesetzung, wie das Formular sie liefert (ohne Slug). */
export interface FuehrungsstellenRollenFormular {
    beuebteStelle: string;
    uebergeordnet: string;
    unterstellt: string[];
    beginn?: string;
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
        const beuebt = document.getElementById("fuehrungsstelleBeuebteStelle") as HTMLInputElement | null;
        const stab = document.getElementById("fuehrungsstelleUebergeordnet") as HTMLInputElement | null;
        const beginn = document.getElementById("fuehrungsstelleBeginn") as HTMLInputElement | null;
        if (beuebt) {
            beuebt.value = rollen.beuebteStelle;
        }
        if (stab) {
            stab.value = rollen.uebergeordnet;
        }
        if (beginn) {
            beginn.value = rollen.beginn ?? "";
        }
        this.renderAbschnitte(rollen.unterstellt, grenzen);
    }

    public getRollen(): FuehrungsstellenRollenFormular {
        const wert = (id: string): string =>
            ((document.getElementById(id) as HTMLInputElement | null)?.value ?? "").trim();
        const unterstellt = Array.from(
            document.querySelectorAll<HTMLInputElement>("#fuehrungsstelleAbschnitte .fuehrungsstelle-abschnitt")
        ).map(input => input.value.trim());
        const beginn = wert("fuehrungsstelleBeginn");
        return {
            beuebteStelle: wert("fuehrungsstelleBeuebteStelle"),
            uebergeordnet: wert("fuehrungsstelleUebergeordnet"),
            unterstellt,
            ...(beginn ? { beginn } : {})
        };
    }

    public renderAbschnitte(namen: string[], grenzen: AbschnittsGrenzen): void {
        const container = document.getElementById("fuehrungsstelleAbschnitte");
        if (!container) {
            return;
        }
        container.innerHTML = "";
        namen.forEach((name, index) => {
            container.appendChild(this.buildAbschnittZeile(name, index, namen.length <= grenzen.min));
        });
        const hinzufuegen = document.getElementById("fuehrungsstelleAbschnittHinzufuegen") as HTMLButtonElement | null;
        if (hinzufuegen) {
            hinzufuegen.disabled = namen.length >= grenzen.max;
        }
        const hinweis = document.getElementById("fuehrungsstelleAbschnitteHinweis");
        if (hinweis) {
            hinweis.textContent = grenzen.min === grenzen.max
                ? `Das Drehbuch ist für ${grenzen.max} Einsatzabschnitte ausgelegt.`
                : `Das Drehbuch ist für ${grenzen.min} bis ${grenzen.max} Einsatzabschnitte ausgelegt; ` +
                  "bei weniger Abschnitten führt ein Abschnitt mehrere Einsatzstellen.";
        }
    }

    private buildAbschnittZeile(name: string, index: number, entfernenGesperrt: boolean): HTMLElement {
        const zeile = document.createElement("div");
        zeile.className = "input-group input-group-sm mb-1";
        const label = document.createElement("span");
        label.className = "input-group-text";
        label.textContent = `EA ${index + 1}`;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control fuehrungsstelle-abschnitt";
        input.dataset["index"] = String(index);
        input.value = name;
        input.setAttribute("aria-label", `Funkrufname Einsatzabschnitt ${index + 1}`);
        const entfernen = document.createElement("button");
        entfernen.type = "button";
        entfernen.className = "btn btn-outline-secondary fuehrungsstelle-abschnitt-entfernen";
        entfernen.dataset["index"] = String(index);
        entfernen.textContent = "×";
        entfernen.setAttribute("aria-label", `Einsatzabschnitt ${index + 1} entfernen`);
        entfernen.disabled = entfernenGesperrt;
        zeile.append(label, input, entfernen);
        return zeile;
    }

    public toggleDownloads(sichtbar: boolean): void {
        const el = document.getElementById("fuehrungsstelleDownloads");
        if (el) {
            el.style.display = sichtbar ? "block" : "none";
        }
    }
}
