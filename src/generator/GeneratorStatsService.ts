import type { Nachricht } from "../types/Nachricht";
import { FunkUebung } from "../models/FunkUebung";

export interface UebungsDauerStats {
    optimal: number;
    schlecht: number;
    durchschnittOptimal: number;
    durchschnittSchlecht: number;
    optimalFormatted: { stunden: number; minuten: number };
    schlechtFormatted: { stunden: number; minuten: number };
}

export interface VerteilungsStats {
    labels: string[];
    counts: number[];
}

export class GeneratorStatsService {
    berechneUebungsdauer(nachrichtenDaten: Nachricht[]): UebungsDauerStats {
        let gesamtDauerOptimal = 0;
        let gesamtDauerSchlecht = 0;
        let totalMessages = 0;

        nachrichtenDaten.forEach((nachricht: Nachricht) => {
            const textLaenge = nachricht.nachricht.length;
            const empfaengerAnzahl = nachricht.empfaenger.length;

            const zeitVerbindungsaufbau = 5 + (empfaengerAnzahl - 1) * 3;
            const zeitVerbindungsabbau = 3;
            const zeitSprechen = textLaenge / 2;
            const zeitMitschrift = textLaenge;
            const zeitEmpfaenger = (empfaengerAnzahl - 1) * 2;

            const zeitOptimal = zeitSprechen + zeitMitschrift + zeitEmpfaenger + zeitVerbindungsaufbau + zeitVerbindungsabbau;
            gesamtDauerOptimal += zeitOptimal;

            const wiederholungsFaktor = Math.random() < 0.3 ? 1.5 : 1;
            const zeitSchlecht = zeitOptimal * wiederholungsFaktor;
            gesamtDauerSchlecht += zeitSchlecht;

            totalMessages++;
        });

        const format = (min: number) => ({
            stunden: Math.floor(min / 60),
            minuten: Math.floor(min % 60)
        });

        return {
            optimal: gesamtDauerOptimal / 60,
            schlecht: gesamtDauerSchlecht / 60,
            durchschnittOptimal: totalMessages ? gesamtDauerOptimal / totalMessages : 0,
            durchschnittSchlecht: totalMessages ? gesamtDauerSchlecht / totalMessages : 0,
            optimalFormatted: format(gesamtDauerOptimal / 60),
            schlechtFormatted: format(gesamtDauerSchlecht / 60)
        };
    }

    berechneVerteilung(uebung: FunkUebung): VerteilungsStats {
        const labels: string[] = [];
        const counts: number[] = [];
        const dist: Record<string, number> = {};
        const leitung = uebung.leitung;

        uebung.teilnehmerListe.forEach(t => {
            if (t !== leitung) {
                labels.push(t);
                dist[t] = 0;
            }
        });

        uebung.teilnehmerListe.forEach(t => {
            if (t !== leitung) {
                uebung.nachrichten[t]?.forEach(n => {
                    n.empfaenger.forEach(e => {
                        if (e === "Alle") {
                            uebung.teilnehmerListe.forEach(ta => {
                                if (ta !== t && dist[ta] !== undefined) {
                                    dist[ta]++;
                                }
                            });
                        } else if (dist[e] !== undefined) {
                            dist[e]++;
                        }
                    });
                    if (n.empfaenger.includes(t) && dist[t] !== undefined) {
                        dist[t]++;
                    }
                });
            }
        });

        labels.forEach(t => counts.push(dist[t] ?? 0));
        return { labels, counts };
    }
}
