import type { GeneratorProfil } from "./GeneratorProfile";

/**
 * DOM der Profil-Leiste im Generator. Die Leiste liegt außerhalb von
 * `.generator-setup-layout`, damit Eingaben hier nicht als Änderung der
 * Übung zählen (kein Entwurf, kein „Ergebnis veraltet“).
 */

export interface ProfilAktionen {
    onSpeichern: (name: string) => void;
    onLaden: (name: string) => void;
    onExportieren: (name: string) => void;
    onLoeschen: (name: string) => void;
    onDatei: (datei: File) => void;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
    if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return null;
    }
    return document.getElementById(id) as T | null;
}

export class GeneratorProfilView {
    private bindung: AbortController | null = null;

    /** Füllt die Auswahl; `ausgewaehlt` bleibt markiert, sonst das erste Profil. */
    public zeigeProfile(profile: GeneratorProfil[], ausgewaehlt?: string): void {
        const auswahl = el<HTMLSelectElement>("profilAuswahl");
        if (!auswahl) {
            return;
        }
        auswahl.replaceChildren();
        if (profile.length === 0) {
            const leer = document.createElement("option");
            leer.value = "";
            leer.textContent = "Noch kein Profil in diesem Browser";
            auswahl.appendChild(leer);
        }
        for (const profil of profile) {
            const option = document.createElement("option");
            option.value = profil.name;
            option.textContent = profil.name;
            option.selected = profil.name === ausgewaehlt;
            auswahl.appendChild(option);
        }
        auswahl.disabled = profile.length === 0;
        for (const id of ["profilLadenBtn", "profilExportBtn", "profilLoeschenBtn"]) {
            const knopf = el<HTMLButtonElement>(id);
            if (knopf) {
                knopf.disabled = profile.length === 0;
            }
        }
        const anzahl = el("profilAnzahl");
        if (anzahl) {
            anzahl.textContent = profile.length > 0 ? `(${profile.length} gespeichert)` : "";
        }
    }

    public setzeName(name: string): void {
        const feld = el<HTMLInputElement>("profilName");
        if (feld && !feld.value.trim()) {
            feld.value = name;
        }
    }

    /** Klappt die Leiste auf, etwa nachdem ein Profil gespeichert wurde. */
    public oeffne(): void {
        const leiste = el<HTMLDetailsElement>("generatorProfile");
        if (leiste) {
            leiste.open = true;
        }
    }

    public bind(aktionen: ProfilAktionen): void {
        this.bindung?.abort();
        const leiste = el("generatorProfile");
        if (!leiste) {
            this.bindung = null;
            return;
        }
        this.bindung = new AbortController();
        const { signal } = this.bindung;
        const gewaehlt = () => el<HTMLSelectElement>("profilAuswahl")?.value ?? "";
        const klick = (id: string, aktion: () => void) => {
            el(id)?.addEventListener("click", aktion, { signal });
        };
        klick("profilSpeichernBtn", () => aktionen.onSpeichern(el<HTMLInputElement>("profilName")?.value ?? ""));
        el("profilName")?.addEventListener("keydown", event => {
            if ((event as KeyboardEvent).key === "Enter") {
                event.preventDefault();
                aktionen.onSpeichern(el<HTMLInputElement>("profilName")?.value ?? "");
            }
        }, { signal });
        klick("profilLadenBtn", () => aktionen.onLaden(gewaehlt()));
        klick("profilExportBtn", () => aktionen.onExportieren(gewaehlt()));
        klick("profilLoeschenBtn", () => aktionen.onLoeschen(gewaehlt()));
        const datei = el<HTMLInputElement>("profilDatei");
        klick("profilDateiBtn", () => datei?.click());
        datei?.addEventListener("change", () => {
            const gewaehlteDatei = datei.files?.[0];
            if (gewaehlteDatei) {
                aktionen.onDatei(gewaehlteDatei);
            }
            // Dieselbe Datei soll ein zweites Mal gewählt werden können.
            datei.value = "";
        }, { signal });
    }

    /** Startet den Download der Profildatei. */
    public herunterladen(inhalt: string, dateiname: string): void {
        const blob = new Blob([inhalt], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = dateiname;
        document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
}
