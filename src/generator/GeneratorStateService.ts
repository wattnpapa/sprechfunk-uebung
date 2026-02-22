import { FunkUebung } from "../models/FunkUebung";

export type LoesungswortOption = "none" | "central" | "individual";

export class GeneratorStateService {
    updateTeilnehmerName(uebung: FunkUebung, index: number, newName: string): void {
        if (index < 0 || index >= uebung.teilnehmerListe.length) {
            return;
        }
        const oldName = uebung.teilnehmerListe[index] ?? "";
        if (oldName !== newName) {
            if (uebung.teilnehmerStellen && uebung.teilnehmerStellen[oldName] !== undefined) {
                uebung.teilnehmerStellen[newName] = uebung.teilnehmerStellen[oldName];
                uebung.teilnehmerStellen = this.omitKey(uebung.teilnehmerStellen, oldName);
            }
            if (uebung.loesungswoerter && uebung.loesungswoerter[oldName] !== undefined) {
                uebung.loesungswoerter[newName] = uebung.loesungswoerter[oldName];
                uebung.loesungswoerter = this.omitKey(uebung.loesungswoerter, oldName);
            }
        }
        uebung.teilnehmerListe[index] = newName;
    }

    updateTeilnehmerStelle(uebung: FunkUebung, teilnehmer: string, stelle: string): void {
        if (!uebung.teilnehmerStellen) {
            uebung.teilnehmerStellen = {};
        }
        if (stelle.trim() === "") {
            uebung.teilnehmerStellen = this.omitKey(uebung.teilnehmerStellen, teilnehmer);
        } else {
            uebung.teilnehmerStellen[teilnehmer] = stelle;
        }
    }

    addTeilnehmer(uebung: FunkUebung): void {
        uebung.teilnehmerListe.push("");
    }

    removeTeilnehmer(uebung: FunkUebung, index: number): void {
        const teilnehmer = uebung.teilnehmerListe[index];
        if (!teilnehmer) {
            return;
        }
        if (uebung.teilnehmerStellen) {
            uebung.teilnehmerStellen = this.omitKey(uebung.teilnehmerStellen, teilnehmer);
        }
        if (uebung.loesungswoerter) {
            uebung.loesungswoerter = this.omitKey(uebung.loesungswoerter, teilnehmer);
        }
        uebung.teilnehmerListe.splice(index, 1);
    }

    resetLoesungswoerter(uebung: FunkUebung): void {
        uebung.loesungswoerter = {};
    }

    setZentralesLoesungswort(uebung: FunkUebung, wort: string): void {
        uebung.teilnehmerListe.forEach(t => {
            uebung.loesungswoerter[t] = wort;
        });
    }

    setIndividuelleLoesungswoerter(uebung: FunkUebung, woerter: string[]): void {
        if (woerter.length === 0) {
            return;
        }
        uebung.teilnehmerListe.forEach((t, i) => {
            const word = woerter[i % woerter.length];
            if (word) {
                uebung.loesungswoerter[t] = word;
            }
        });
    }

    shuffleLoesungswoerter(
        uebung: FunkUebung,
        option: LoesungswortOption,
        predefinedWoerter: string[]
    ): { centralWord?: string; error?: string } {
        this.resetLoesungswoerter(uebung);

        if (option === "central") {
            if (predefinedWoerter.length === 0) {
                return { error: "Keine vordefinierten Lösungswörter verfügbar." };
            }
            const zentralesWort = predefinedWoerter[
                Math.floor(Math.random() * predefinedWoerter.length)
            ] ?? "";
            this.setZentralesLoesungswort(uebung, zentralesWort);
            return { centralWord: zentralesWort };
        }

        if (option === "individual") {
            const shuffledWords = [...predefinedWoerter].sort(() => Math.random() - 0.5);
            if (shuffledWords.length === 0) {
                return { error: "Keine vordefinierten Lösungswörter verfügbar." };
            }
            this.setIndividuelleLoesungswoerter(uebung, shuffledWords);
        }

        return {};
    }

    private omitKey<T extends Record<string, string>>(obj: T, key: string): T {
        return Object.fromEntries(
            Object.entries(obj).filter(([k]) => k !== key)
        ) as T;
    }
}
