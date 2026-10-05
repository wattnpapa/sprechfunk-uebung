import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { createRandomSeed, createSeededRng, type Rng } from "../utils/random";
import type { Szenario } from "../types/Szenario";
import {
    fuehrungsstellenTeilnehmerListe,
    type FuehrungsstellenUebung
} from "../types/FuehrungsstellenUebung";
import {
    UEBUNG_CODE_LENGTH,
    ensureJoinCodes,
    generateShortCode
} from "./generationCodes";
import { pruefeFuehrungsstellenKonfiguration, verteileNachrichtenNachDrehbuch } from "./generationFuehrungsstelle";
import { verteileNachrichtenNachSzenario } from "./generationSzenario";
import { verteileNachrichtenFair } from "./generationVerteilung";
import {
    assignXZeitSlots,
    markiereNachrichtenArt,
    verteileLoesungswoerterMitIndex
} from "./generationNachbearbeitung";
import { berechneLoesungsStaerken } from "./generationStaerken";

export class GenerationService {
    /**
     * Zufallsquelle des laufenden Generierungsvorgangs. Wird zu Beginn von
     * `generate` aus dem Seed der Übung aufgebaut.
     */
    private rng: Rng = Math.random;

    /**
     * Hauptfunktion zum Erstellen einer Übung.
     * Füllt die Nachrichten, Lösungswörter und Stärken.
     *
     * Mit `szenario` werden die Nachrichten nicht zufällig verteilt, sondern
     * aus dem Drehbuch des Szenarios erzeugt. Lösungswörter, Buchstabier-
     * Balancierung und Auto-Stärkemeldungen entfallen dann bewusst: Sie
     * schreiben Nachrichtentexte um bzw. hängen Inhalte an, was kuratierte
     * Szenariotexte zerstören würde.
     */
    public generate(uebung: FunkUebung, szenario?: Szenario): void {
        uebung.createDate = new Date();
        this.rng = this.erzeugeZufallsquelle(uebung);
        uebung.fuehrungsstelle = undefined;
        if (szenario) {
            uebung.szenarioSlug = szenario.slug;
            uebung.loesungswoerter = {};
            uebung.autoStaerkeErgaenzen = false;
            // Ohne Balancierung entstehen keine gezielten Buchstabier-Aufgaben;
            // ein Restwert aus dem Formular würde statHatBuchstabieren verfälschen.
            uebung.buchstabierenAn = 0;
            uebung.nachrichten = this.verteileNachrichtenNachSzenario(uebung, szenario);
        } else {
            uebung.szenarioSlug = undefined;
            uebung.nachrichten = this.verteileNachrichtenFair(uebung);
        }
        this.assignXZeitSlots(uebung);
        this.verteileLoesungswoerterMitIndex(uebung);
        this.finalisiere(uebung);
    }

    /**
     * Führungsstellen-Übung: Die Nachrichten kommen aus dem Drehbuch, die
     * Rollen aus `uebung.fuehrungsstelle`. Die beübte Stelle sendet nichts,
     * alle anderen senden nur an sie. Die Minute jeder Nachricht wird als
     * X-Zeit-Slot übernommen, damit Teilnehmeransicht und Cockpit die
     * Fälligkeit anzeigen; Anmeldung, Lösungswörter, Auto-Stärken und
     * Buchstabier-Balancierung entfallen wie im Szenario-Modus.
     */
    public generateFuehrungsstelle(uebung: FunkUebung, drehbuch: FuehrungsstellenUebung): void {
        const konfiguration = pruefeFuehrungsstellenKonfiguration(uebung, drehbuch);
        uebung.createDate = new Date();
        this.rng = this.erzeugeZufallsquelle(uebung);
        uebung.szenarioSlug = undefined;
        uebung.loesungswoerter = {};
        uebung.autoStaerkeErgaenzen = false;
        uebung.buchstabierenAn = 0;
        // Die Anmeldungen stehen als erste Nachrichten im Drehbuch.
        uebung.anmeldungAktiv = false;
        uebung.nachrichtenArtAktiv = false;
        uebung.spielModus = "xZeit";
        uebung.funksprueche = [];
        uebung.verwendeteVorlagen = [];
        uebung.teilnehmerListe = fuehrungsstellenTeilnehmerListe(konfiguration);
        // Stellennamen wie in der klassischen Übung: Was eingetragen ist, steht
        // auf den Vordrucken als Anschrift; nichts wird aus dem Drehbuch erfunden.
        uebung.teilnehmerStellen = { ...(konfiguration.stellen ?? {}) };
        uebung.nachrichten = verteileNachrichtenNachDrehbuch(drehbuch, konfiguration);
        // Keine Soll-Stärke: Die Drehbücher melden laufende Stände derselben
        // Einheit (Anmeldung, Änderung, Abschlussstand) und Teilsummen; eine
        // Addition aller Treffer ergäbe eine Zahl, die nirgends im Drehbuch steht.
        this.finalisiere(uebung, false);
    }

    /**
     * Schritte, die jeder Generierungspfad zum Schluss durchläuft. Ohne
     * `mitStaerken` bleibt die Soll-Stärke leer, die Leitungsansicht blendet
     * die Spalte dann aus.
     */
    private finalisiere(uebung: FunkUebung, mitStaerken = true): void {
        this.ensureJoinCodes(uebung);
        this.updateChecksum(uebung);
        if (mitStaerken) {
            this.berechneLoesungsStaerken(uebung);
        } else {
            uebung.loesungsStaerken = {};
        }
        // Erst hier, weil die Art von `staerken` und `loesungsbuchstaben` abhängt
        // und beide vorher gefüllt werden.
        this.markiereNachrichtenArt(uebung);
    }

    /**
     * Legt die Zufallsquelle für einen Generierungslauf fest.
     *
     * Ist an der Übung kein Seed hinterlegt, wird einer erzeugt und dort
     * gespeichert. Damit lässt sich jede Übung nachträglich exakt wiederholen –
     * für Vergleichsläufe zweier Gruppen oder um einen gemeldeten Fehler
     * nachzustellen –, ohne dass jemand vorher an das Setzen eines Seeds denken
     * muss.
     */
    private erzeugeZufallsquelle(uebung: FunkUebung): Rng {
        if (!uebung.seed) {
            uebung.seed = createRandomSeed();
        }
        return createSeededRng(uebung.seed);
    }

    /**
     * Sorgt dafür, dass der Übungscode gegenüber dem Bestand eindeutig ist.
     * Die Bestandsprüfung wird injiziert, damit dieser Service frei von
     * Firestore-Abhängigkeiten bleibt.
     *
     * @returns true, wenn ein freier Code vergeben werden konnte.
     */
    public async ensureUniqueUebungCode(
        uebung: FunkUebung,
        istVergeben: (code: string) => Promise<boolean>,
        maxVersuche = 5
    ): Promise<boolean> {
        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            if (!(await istVergeben(uebung.uebungCode))) {
                return true;
            }
            uebung.uebungCode = this.generateShortCode(UEBUNG_CODE_LENGTH);
        }
        return !(await istVergeben(uebung.uebungCode));
    }

    /**
     * Die Formel liegt im Modell, weil `toJson()` vor dem Speichern ohnehin
     * dort nachrechnet. Zwei Kopien würden früher oder später auseinanderlaufen.
     */
    public updateChecksum(uebung: FunkUebung) {
        uebung.updateChecksum();
    }

    private assignXZeitSlots(uebung: FunkUebung): void {
        assignXZeitSlots(uebung);
    }

    private ensureJoinCodes(uebung: FunkUebung): void {
        ensureJoinCodes(uebung);
    }

    private generateShortCode(length: number): string {
        return generateShortCode(length);
    }

    private markiereNachrichtenArt(uebung: FunkUebung): void {
        markiereNachrichtenArt(uebung, this.rng);
    }

    private verteileNachrichtenFair(uebung: FunkUebung): Record<string, Nachricht[]> {
        return verteileNachrichtenFair(uebung, this.rng);
    }

    private verteileNachrichtenNachSzenario(uebung: FunkUebung, szenario: Szenario): Record<string, Nachricht[]> {
        return verteileNachrichtenNachSzenario(uebung, szenario, this.rng);
    }

    private verteileLoesungswoerterMitIndex(uebung: FunkUebung): void {
        verteileLoesungswoerterMitIndex(uebung, this.rng);
    }

    private berechneLoesungsStaerken(uebung: FunkUebung): void {
        berechneLoesungsStaerken(uebung, this.rng);
    }
}
