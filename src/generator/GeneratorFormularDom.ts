import type { FunkUebung } from "../models/FunkUebung";
import { setLoesungswortUI } from "./GeneratorLoesungswortDom";

/**
 * Kopfdaten, Verteilung, Spielmodus und Spruch/Durchsage im Formular des
 * Generators: lesen, setzen und die abhängigen Bereiche ein- und ausblenden.
 */

function eingabe(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
}

function eingabeOderNull(id: string): HTMLInputElement | null {
    return document.getElementById(id) as HTMLInputElement | null;
}

function getNachrichtenArtFormData(): Pick<FunkUebung, "nachrichtenArtAktiv" | "spruchAnteilProzent"> {
    const checkbox = eingabeOderNull("nachrichtenArtAktiv");
    const anteil = eingabeOderNull("prozentSprueche");
    return {
        nachrichtenArtAktiv: checkbox?.checked ?? false,
        spruchAnteilProzent: Number(anteil?.value ?? 50)
    };
}

function leseXZeit(): Pick<FunkUebung, "xZeitIntervallMinuten" | "xZeitStartOffsetMinuten"> {
    return {
        xZeitIntervallMinuten: Number(eingabeOderNull("xZeitIntervallMinuten")?.value) || 3,
        xZeitStartOffsetMinuten: Number(eingabeOderNull("xZeitStartOffsetMinuten")?.value) || 0
    };
}

export function getFormData(): Partial<FunkUebung> {
    const datumVal = eingabe("datum").value;
    const spielModusRadio = document.querySelector<HTMLInputElement>("input[name=\"spielModus\"]:checked");
    // Immer setzen: Sonst bliebe nach einer Führungsstellen-Übung (die den
    // Modus auf X-Zeit stellt) der Altwert stehen, obwohl das Formular
    // „Klassisch" zeigt.
    const spielModus = spielModusRadio?.value === "xZeit" ? "xZeit" : "klassisch";

    return {
        name: eingabe("nameDerUebung").value,
        rufgruppe: eingabe("rufgruppe").value,
        leitung: eingabe("leitung").value,
        spruecheProTeilnehmer: Number(eingabe("spruecheProTeilnehmer").value),
        spruecheAnAlle: Number(eingabe("spruecheAnAlle").value),
        spruecheAnMehrere: Number(eingabe("spruecheAnMehrere").value),
        buchstabierenAn: Number(eingabe("spruecheAnBuchstabieren").value),
        datum: datumVal ? new Date(datumVal) : new Date(),
        anmeldungAktiv: eingabe("anmeldungAktiv").checked,
        autoStaerkeErgaenzen: eingabe("autoStaerkeErgaenzen").checked,
        ...getNachrichtenArtFormData(),
        spielModus,
        ...leseXZeit()
    };
}

function setzeWertWennDa(id: string, wert: string): void {
    const input = eingabeOderNull(id);
    if (input) {
        input.value = wert;
    }
}

function setzeSpielModus(uebung: FunkUebung): void {
    const modusVal = uebung.spielModus === "xZeit" ? "xZeit" : "klassisch";
    const modusRadio = document.querySelector<HTMLInputElement>(`input[name="spielModus"][value="${modusVal}"]`);
    if (modusRadio) {
        modusRadio.checked = true;
    }
    setzeWertWennDa("xZeitIntervallMinuten", String(uebung.xZeitIntervallMinuten ?? 3));
    setzeWertWennDa("xZeitStartOffsetMinuten", String(uebung.xZeitStartOffsetMinuten ?? 0));
    updateXZeitOptionsVisibility();
}

function setNachrichtenArtFormData(uebung: FunkUebung): void {
    const checkbox = eingabeOderNull("nachrichtenArtAktiv");
    if (checkbox) {
        checkbox.checked = uebung.nachrichtenArtAktiv ?? false;
    }
    setzeWertWennDa("prozentSprueche", String(uebung.spruchAnteilProzent ?? 50));
    updateNachrichtenArtOptionsVisibility();
}

/** Datum für ein Eingabefeld vom Typ date. */
function alsDatumsfeld(datum: FunkUebung["datum"]): string {
    const date = new Date(datum);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function setFormData(uebung: FunkUebung): void {
    eingabe("nameDerUebung").value = uebung.name || "";
    eingabe("rufgruppe").value = uebung.rufgruppe || "";
    eingabe("leitung").value = uebung.leitung || "";
    eingabe("spruecheProTeilnehmer").value = uebung.spruecheProTeilnehmer.toString();
    eingabe("datum").value = alsDatumsfeld(uebung.datum);
    eingabe("anmeldungAktiv").checked = uebung.anmeldungAktiv;
    eingabe("autoStaerkeErgaenzen").checked = uebung.autoStaerkeErgaenzen;

    setNachrichtenArtFormData(uebung);
    setzeSpielModus(uebung);
    // Prozentwerte und absolute Werte setzen
    updateDistributionInputs(uebung);
    // Lösungswort-Optionen setzen
    setLoesungswortUI(uebung.loesungswoerter);
}

export function updateXZeitOptionsVisibility(): void {
    const radio = document.querySelector<HTMLInputElement>("input[name=\"spielModus\"]:checked");
    const container = document.getElementById("xZeitOptionsContainer");
    if (container) {
        container.style.display = radio?.value === "xZeit" ? "block" : "none";
    }
}

export function updateNachrichtenArtOptionsVisibility(): void {
    const checkbox = eingabeOderNull("nachrichtenArtAktiv");
    const container = document.getElementById("nachrichtenArtOptionsContainer");
    if (container) {
        container.style.display = checkbox?.checked ? "block" : "none";
    }
}

/**
 * Anzeige „= n je Teilnehmer“. Die Spans heißen calcAnAlle, calcAnMehrere,
 * calcAnBuchstabieren, die versteckten Felder spruecheAnAlle usw.
 */
function setzeAnzeige(idAnzahl: string, wert: number): void {
    const span = document.getElementById("calc" + idAnzahl.replace("sprueche", ""));
    if (span) {
        span.textContent = wert.toString();
    }
}

export function updateDistributionInputs(uebung: FunkUebung): void {
    const proTeilnehmer = uebung.spruecheProTeilnehmer || 1;

    const update = (idProzent: string, idAnzahl: string, wert: number) => {
        const prozent = Math.round((wert / proTeilnehmer) * 100);
        setzeWertWennDa(idProzent, prozent.toString());
        setzeWertWennDa(idAnzahl, wert.toString());
        setzeAnzeige(idAnzahl, wert);
    };

    update("prozentAnAlle", "spruecheAnAlle", uebung.spruecheAnAlle || 0);
    update("prozentAnMehrere", "spruecheAnMehrere", uebung.spruecheAnMehrere || 0);
    update("prozentAnBuchstabieren", "spruecheAnBuchstabieren", uebung.buchstabierenAn || 0);
}

export function syncDistributionFromPercentInputs(): void {
    const proTeilnehmer = Math.max(1, Number(eingabeOderNull("spruecheProTeilnehmer")?.value) || 0);

    const sync = (idProzent: string, idAnzahl: string) => {
        const prozentInput = eingabeOderNull(idProzent);
        const anzahlInput = eingabeOderNull(idAnzahl);
        if (!prozentInput || !anzahlInput) {
            return;
        }
        const prozent = Math.max(0, Math.min(100, Number(prozentInput.value) || 0));
        const anzahl = Math.round((proTeilnehmer * prozent) / 100);
        anzahlInput.value = String(anzahl);
        setzeAnzeige(idAnzahl, anzahl);
    };

    sync("prozentAnAlle", "spruecheAnAlle");
    sync("prozentAnMehrere", "spruecheAnMehrere");
    sync("prozentAnBuchstabieren", "spruecheAnBuchstabieren");
}
