import type { FunkUebung } from "../models/FunkUebung";
import type { SyncInfo } from "../services/LiveStatusService";
import type { TeilnehmerStatus } from "../types/Storage";
import { zaehleErledigt, type EffektiverStatus } from "./auswertung";
import { lageJeTeilnehmer, type Faelligkeit } from "./lagebild";
import type { LageAnzeige } from "./lageMarkup";
import { naechsteFuerLage, zaehleFaelligkeit } from "./nachrichtenplan";
import type { FlattenedNachricht } from "./nachrichtenTypen";
import { reaktionsBilanz } from "./reaktion";
import { zaehleVeralteteStatus } from "./veraltet";

/** „05.10. um 21:03“ – wann die aktuelle Fassung der Übung erzeugt wurde. */
export function fassungVomText(createDate: Date | string | undefined): string {
    const d = createDate ? new Date(createDate) : null;
    if (!d || Number.isNaN(d.getTime())) {
        return "–";
    }
    const zwei = (n: number) => String(n).padStart(2, "0");
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. um ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

function verbindungAus(info: SyncInfo | null): LageAnzeige["verbindung"] | undefined {
    if (!info) {
        return undefined;
    }
    return {
        state: info.state,
        offen: info.offeneAenderungen,
        ...(info.letzteBestaetigungUm ? { letzteBestaetigungUm: info.letzteBestaetigungUm } : {})
    };
}

/** Alles, was die Lagezeile zeigt – aus Plan, Status, Fälligkeit und Verbindung. */
export function buildLageAnzeige(daten: {
    uebung: Pick<FunkUebung, "createDate" | "fuehrungsstelle">;
    teilnehmerStatus: Record<string, TeilnehmerStatus>;
    nachrichten: FlattenedNachricht[];
    effektiv: EffektiverStatus;
    faelligkeit: Record<string, Faelligkeit>;
    hideAbgesetzt: boolean;
    syncInfo: SyncInfo | null;
    jetztMs: number;
}): LageAnzeige {
    const { uebung, nachrichten, effektiv, faelligkeit } = daten;
    const { ueberfaellig, faellig } = zaehleFaelligkeit(faelligkeit);
    const veraltet = zaehleVeralteteStatus(uebung.createDate, effektiv, daten.teilnehmerStatus);
    const verbindung = verbindungAus(daten.syncInfo);
    return {
        teilnehmer: lageJeTeilnehmer(nachrichten, effektiv),
        naechste: naechsteFuerLage(nachrichten, effektiv, faelligkeit),
        zuBestaetigen: zaehleErledigt(nachrichten, effektiv).nurGemeldet,
        hideAbgesetzt: daten.hideAbgesetzt,
        ueberfaellig,
        faellig,
        reaktionen: uebung.fuehrungsstelle ? reaktionsBilanz(nachrichten, effektiv) : null,
        veraltet: veraltet > 0 ? { anzahl: veraltet, fassungVom: fassungVomText(uebung.createDate) } : null,
        jetztMs: daten.jetztMs,
        ...(verbindung ? { verbindung } : {})
    };
}
