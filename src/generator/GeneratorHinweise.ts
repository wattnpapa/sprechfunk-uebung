import type { FeldFehler } from "./GeneratorValidierung";

/**
 * Rückmeldungen des Generators, die stehen bleiben, bis sie erledigt sind:
 * Fehler am Feld, Fehlerkasten an der Aktionsleiste, Hinweis auf eine schon
 * gespeicherte Übung, veraltetes Ergebnis, wiederhergestellter Entwurf,
 * Rückgängig nach dem Entfernen eines Teilnehmers und die Statusleiste.
 *
 * Alle Zugriffe sind null-sicher: Fehlt ein Element (andere Ansicht, Tests
 * ohne DOM), passiert nichts.
 */

export interface ModusAnzeige {
    gespeichert: boolean;
    name?: string;
    uebungCode?: string;
}

export interface StatusleistenWerte {
    teilnehmer: number;
    nachrichten: string;
    loesungswoerter: string;
    dauer: string;
}

const FEHLER_KLASSE = "generator-feldfehler";
const ENTFERNT_ANZEIGEDAUER_MS = 10000;

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
    if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return null;
    }
    return document.getElementById(id) as T | null;
}

function zeigen(element: HTMLElement | null, sichtbar: boolean): void {
    if (element) {
        element.hidden = !sichtbar;
    }
}

export class GeneratorHinweise {
    private formularBindung: AbortController | null = null;
    private entferntTimer: ReturnType<typeof setTimeout> | null = null;
    private entwurfTimer: ReturnType<typeof setTimeout> | null = null;

    // --- Fehler am Feld ------------------------------------------------------

    /** Markiert die Felder, setzt den Text darunter und springt zum ersten. */
    public zeigeFeldFehler(fehler: FeldFehler[]): void {
        let erstes: HTMLElement | null = null;
        fehler.forEach(({ feld, text }) => {
            const ziel = this.findeFeld(feld);
            if (!ziel) {
                return;
            }
            erstes ??= ziel;
            ziel.classList.add("is-invalid");
            ziel.setAttribute("aria-invalid", "true");
            const meldungId = `${feld}-fehler`;
            ziel.setAttribute("aria-describedby", meldungId);
            document.getElementById(meldungId)?.remove();
            const meldung = document.createElement("div");
            meldung.id = meldungId;
            meldung.className = `invalid-feedback d-block ${FEHLER_KLASSE}`;
            meldung.textContent = text;
            this.ankerFuer(ziel).insertAdjacentElement("afterend", meldung);
        });
        const fokus = erstes as HTMLElement | null;
        if (fokus) {
            fokus.scrollIntoView?.({ block: "center", behavior: "smooth" });
            fokus.focus?.({ preventScroll: true });
        }
    }

    public entferneFeldFehler(): void {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
            return;
        }
        document.querySelectorAll(`.${FEHLER_KLASSE}`).forEach(node => node.remove());
        document.querySelectorAll("#mainAppArea .is-invalid").forEach(node => {
            node.classList.remove("is-invalid");
            node.removeAttribute("aria-invalid");
            node.removeAttribute("aria-describedby");
        });
    }

    /** Ein korrigiertes Feld verliert seine Markierung sofort. */
    private entferneFehlerAn(ausloeser: HTMLElement): void {
        // Das native <select> der Vorlagen ist versteckt, markiert ist sein Widget daneben.
        const ziel = ausloeser.id === "funkspruchVorlage"
            ? (ausloeser.parentElement?.querySelector<HTMLElement>(".multiselect") ?? ausloeser)
            : ausloeser;
        const markiert = ziel.classList.contains("is-invalid") ? ziel : ziel.closest(".is-invalid");
        if (!(markiert instanceof HTMLElement)) {
            return;
        }
        const meldungId = markiert.getAttribute("aria-describedby");
        if (meldungId) {
            document.getElementById(meldungId)?.remove();
        }
        markiert.classList.remove("is-invalid");
        markiert.removeAttribute("aria-invalid");
        markiert.removeAttribute("aria-describedby");
    }

    private findeFeld(feld: string): HTMLElement | null {
        const zeile = /^teilnehmer-(\d+)$/.exec(feld);
        if (zeile) {
            return document.querySelector<HTMLElement>(`#teilnehmer-body .teilnehmer-input[data-index="${zeile[1]}"]`);
        }
        const abschnitt = /^abschnitt-(\d+)$/.exec(feld);
        if (abschnitt) {
            return document.querySelector<HTMLElement>(
                `#fuehrungsstelleAbschnitte .fuehrungsstelle-abschnitt[data-index="${abschnitt[1]}"]`
            );
        }
        if (feld === "funkspruchVorlage") {
            // Das native <select> ist hinter dem Multi-Select-Widget versteckt.
            const select = el("funkspruchVorlage");
            return (select?.parentElement?.querySelector<HTMLElement>(".multiselect")) ?? select;
        }
        return el(feld);
    }

    /** Hinter Eingabegruppen gehört die Meldung unter die ganze Gruppe. */
    private ankerFuer(ziel: HTMLElement): HTMLElement {
        const gruppe = ziel.closest(".input-group");
        return gruppe instanceof HTMLElement ? gruppe : ziel;
    }

    // --- Fehlerkasten an der Aktionsleiste -----------------------------------

    public zeigeFehlerBox(text: string | null): void {
        const box = el("generatorFehler");
        if (!box) {
            return;
        }
        box.textContent = text ?? "";
        zeigen(box, !!text);
    }

    // --- Laufender Vorgang ---------------------------------------------------

    public setzeBeschaeftigt(beschaeftigt: boolean): void {
        ["startUebungBtn", "ueberschreibenBtn"].forEach(id => {
            const button = el<HTMLButtonElement>(id);
            if (button) {
                button.disabled = beschaeftigt;
                button.setAttribute("aria-busy", String(beschaeftigt));
            }
        });
        const status = el("generatorArbeitsStatus");
        if (status) {
            status.textContent = beschaeftigt ? "Übung wird erzeugt und gespeichert …" : "";
        }
    }

    // --- Neue oder gespeicherte Übung -----------------------------------------

    public zeigeModus(modus: ModusAnzeige): void {
        const start = el("startUebungBtn");
        const label = start?.querySelector(".generator-start-label") ?? null;
        if (label) {
            label.textContent = modus.gespeichert ? "Als neue Übung generieren" : "Übung generieren";
        }
        zeigen(el("ueberschreibenBtn"), modus.gespeichert);
        const hinweis = el("generatorActionHinweis");
        if (hinweis) {
            hinweis.textContent = modus.gespeichert
                ? `Diese Übung ist gespeichert${modus.uebungCode ? ` (Übungscode ${modus.uebungCode})` : ""}. ` +
                  "Links und Ausdrucke sind womöglich schon verteilt. „Als neue Übung generieren“ legt eine " +
                  "eigene Übung mit neuen Codes an, die bisherige bleibt unverändert."
                : "Prüfe Einstellungen und Teilnehmer, dann starte die Generierung.";
        }
    }

    // --- Veraltetes Ergebnis --------------------------------------------------

    public markiereErgebnisVeraltet(veraltet: boolean): void {
        if (veraltet) {
            this.zeigeErgebnisHinweis(null);
        }
        zeigen(el("generatorErgebnisVeraltet"), veraltet);
        el("output-container")?.classList.toggle("is-veraltet", veraltet);
    }

    // --- Entwurf ---------------------------------------------------------------

    /**
     * Hinweis auf einen wiederhergestellten Entwurf. Neben „Entwurf verwerfen“
     * steht ein harmloses „Hinweis ausblenden“, damit der einzige Knopf nicht
     * als Schließen missverstanden wird (THW-Review 2026-10-05,
     * destructive-action P2-2). Mit `profilName` stammen die Eingaben aus
     * einem Profil statt aus dem Entwurf.
     */
    public zeigeEntwurfHinweis(gespeichertAm: Date | null, onVerwerfen?: () => void, profilName?: string): void {
        this.stoppeEntwurfTimer();
        const box = el("generatorEntwurfHinweis");
        if (!box) {
            return;
        }
        zeigen(box, !!gespeichertAm);
        const text = el("generatorEntwurfText");
        if (text && gespeichertAm) {
            const zeit = gespeichertAm.toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
            });
            text.textContent = profilName
                ? `Profil „${profilName}“ geladen. Prüfe Datum und Name, noch ist keine Übung gespeichert.`
                : `Deine Eingaben vom ${zeit} wurden wiederhergestellt. ` +
                  "Sie liegen nur in diesem Browser, noch ist keine Übung gespeichert.";
        }
        const knopf = el<HTMLButtonElement>("generatorEntwurfVerwerfen");
        if (knopf) {
            zeigen(knopf, true);
            knopf.onclick = onVerwerfen ? () => onVerwerfen() : null;
        }
        zeigen(el("generatorEntwurfRueckgaengig"), false);
        this.bindeAusblenden();
    }

    /** Nach dem Verwerfen: 10 s lang „Rückgängig“, wie beim Entfernen eines Teilnehmers. */
    public zeigeEntwurfVerworfen(onRueckgaengig: () => void): void {
        this.stoppeEntwurfTimer();
        const box = el("generatorEntwurfHinweis");
        if (!box) {
            return;
        }
        const text = el("generatorEntwurfText");
        if (text) {
            text.textContent = "Entwurf verworfen, das Formular ist leer.";
        }
        zeigen(el("generatorEntwurfVerwerfen"), false);
        const rueckgaengig = el<HTMLButtonElement>("generatorEntwurfRueckgaengig");
        if (rueckgaengig) {
            zeigen(rueckgaengig, true);
            rueckgaengig.onclick = () => {
                this.stoppeEntwurfTimer();
                zeigen(box, false);
                onRueckgaengig();
            };
        }
        this.bindeAusblenden();
        zeigen(box, true);
        this.entwurfTimer = setTimeout(() => {
            this.entwurfTimer = null;
            zeigen(box, false);
        }, ENTFERNT_ANZEIGEDAUER_MS);
    }

    private bindeAusblenden(): void {
        const ausblenden = el<HTMLButtonElement>("generatorEntwurfAusblenden");
        if (ausblenden) {
            ausblenden.onclick = () => {
                this.stoppeEntwurfTimer();
                zeigen(el("generatorEntwurfHinweis"), false);
            };
        }
    }

    private stoppeEntwurfTimer(): void {
        if (this.entwurfTimer !== null) {
            clearTimeout(this.entwurfTimer);
            this.entwurfTimer = null;
        }
    }

    // --- Rückmeldung zum Ergebnis ------------------------------------------------

    /**
     * Steht oben im Ergebnis statt als Toast unten rechts, wo er die
     * Linktabelle verdeckte (THW-Review 2026-10-05, stress-test P3-2).
     */
    public zeigeErgebnisHinweis(text: string | null, warnung = false): void {
        const box = el("generatorErgebnisHinweis");
        if (!box) {
            return;
        }
        box.textContent = text ?? "";
        box.classList.toggle("alert-success", !warnung);
        box.classList.toggle("alert-warning", warnung);
        zeigen(box, !!text);
    }

    // --- Teilnehmer entfernt ---------------------------------------------------

    public zeigeEntferntHinweis(name: string | null, onRueckgaengig?: () => void): void {
        const box = el("teilnehmerEntferntHinweis");
        if (this.entferntTimer !== null) {
            clearTimeout(this.entferntTimer);
            this.entferntTimer = null;
        }
        if (!box) {
            return;
        }
        if (name === null) {
            zeigen(box, false);
            return;
        }
        const text = el("teilnehmerEntferntText");
        if (text) {
            text.textContent = name ? `„${name}“ entfernt.` : "Leere Zeile entfernt.";
        }
        const knopf = el<HTMLButtonElement>("teilnehmerEntferntRueckgaengig");
        if (knopf) {
            knopf.onclick = () => {
                this.zeigeEntferntHinweis(null);
                onRueckgaengig?.();
            };
        }
        zeigen(box, true);
        this.entferntTimer = setTimeout(() => this.zeigeEntferntHinweis(null), ENTFERNT_ANZEIGEDAUER_MS);
    }

    // --- Statusleiste ------------------------------------------------------------

    public aktualisiereStatusleiste(werte: StatusleistenWerte): void {
        const setze = (id: string, wert: string) => {
            const ziel = el(id);
            if (ziel) {
                ziel.textContent = wert;
            }
        };
        setze("statusTeilnehmerCount", String(werte.teilnehmer));
        setze("statusNachrichtenCount", werte.nachrichten);
        setze("statusLoesungswortMode", werte.loesungswoerter);
        setze("statusDauerEstimate", werte.dauer);
    }

    public setzeDauer(text: string): void {
        const ziel = el("statusDauerEstimate");
        if (ziel) {
            ziel.textContent = text;
        }
    }

    // --- Zusatzaktionen ------------------------------------------------------------

    public bindAktionen(handler: { onUeberschreiben: () => void; onBlattBeuebteStelle: () => void }): void {
        const ueberschreiben = el<HTMLButtonElement>("ueberschreibenBtn");
        if (ueberschreiben) {
            ueberschreiben.onclick = () => handler.onUeberschreiben();
        }
        const blatt = el<HTMLButtonElement>("beuebteStelleBlattBtn");
        if (blatt) {
            blatt.onclick = () => handler.onBlattBeuebteStelle();
        }
    }

    /** Hinweis im Ergebnis, dass die beübte Stelle keinen Link bekommt. */
    public zeigeBeuebteStelle(name: string | null): void {
        const hinweis = el("beuebteStelleHinweis");
        if (!hinweis) {
            return;
        }
        hinweis.textContent = name
            ? `Die beübte Stelle „${name}“ bekommt keinen Link und darf Drehbuch und Rollenkarten nicht sehen. ` +
              "Gib ihr zu Übungsbeginn Ausgangslage und Auftrag auf Papier:"
            : "";
    }

    // --- Formularänderungen ------------------------------------------------------

    /**
     * Meldet jede Änderung im Formular (Eingabe, Auswahl, Knopf), damit der
     * Controller Entwurf, Statusleiste und den Veraltet-Hinweis nachführt.
     * Die Suche im Vorlagen-Widget ändert nichts und zählt nicht.
     */
    public bindFormularAenderung(onAenderung: () => void): void {
        this.formularBindung?.abort();
        const layout = typeof document !== "undefined" && typeof document.querySelector === "function"
            ? document.querySelector<HTMLElement>(".generator-setup-layout")
            : null;
        if (!layout) {
            this.formularBindung = null;
            return;
        }
        this.formularBindung = new AbortController();
        const { signal } = this.formularBindung;
        const melde = (event: Event) => {
            const ziel = event.target;
            if (!(ziel instanceof HTMLElement) || ziel.classList.contains("multiselect-search")) {
                return;
            }
            if (event.type === "click" && !ziel.closest("button")) {
                return;
            }
            if (event.type !== "click") {
                this.entferneFehlerAn(ziel);
            }
            onAenderung();
        };
        layout.addEventListener("input", melde, { signal });
        layout.addEventListener("change", melde, { signal });
        layout.addEventListener("click", melde, { signal });
    }
}
