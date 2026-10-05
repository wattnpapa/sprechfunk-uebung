import type { FunkUebung } from "../models/FunkUebung";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import type { UebungsleitungStorage } from "../types/Storage";
import { uiFeedback } from "../core/UiFeedback";
import { parseHHMMtoMs } from "../utils/xzeit";
import type { EffektiverStatus } from "./auswertung";
import { buildCockpitAnzeige } from "./cockpit";
import { buildFaelligkeit, buildPlan, zaehleFaelligkeit } from "./nachrichtenplan";
import type { UebungsleitungView } from "./UebungsleitungView";
import {
    basisWechselFrage,
    minutenZurueck,
    stattdessenJetztFrage,
    uhrzeitJetzt,
    vergangenerBeginnFrage,
    VORSCHLAG_RUECKFRAGE_AB_MIN
} from "./xZeitBasisWechsel";

type CockpitView = Pick<UebungsleitungView,
    "setCockpitVisible" | "setCockpitBasisInputValue" | "bindCockpitEvents" | "updateCockpit"
    | "scrollZuPlanZustand" | "zeigeRueckgaengig">;

/** Was das Cockpit vom Controller braucht; Zustand wird bei jedem Aufruf frisch gelesen. */
export interface CockpitHost {
    storage(): UebungsleitungStorage | null;
    uebung(): FunkUebung | null;
    effektiverStatus(): EffektiverStatus;
    teilnehmerDocs(): TeilnehmerLiveDoc[];
    save(): void;
    renderNachrichten(): void;
    view: CockpitView;
}

type Ausloeser = "jetzt" | "eingabe" | "vorschlag";

/**
 * X-Zeit-Cockpit der Übungsleitung: Kacheln, Ticker und die verbindliche
 * Basis. Eine schon gesetzte Basis wird nur nach Rückfrage mit alter und
 * neuer Zeit ersetzt, danach gibt es ein Rückgängig (THW-Review 2026-10-05,
 * destructive-action P1-1); ein weit zurückliegender geplanter Beginn wird
 * nicht ohne Nachfrage übernommen (workflow W1).
 */
export class CockpitSteuerung {
    private interval: ReturnType<typeof setInterval> | null = null;
    /** Minute des letzten Plan-Renderns – die Fälligkeit ändert sich minütlich. */
    private letzteFaelligkeitsMinute = -1;

    constructor(private host: CockpitHost) {}

    public init(): void {
        if (this.host.uebung()?.spielModus !== "xZeit") {
            return;
        }
        const view = this.host.view;
        view.setCockpitVisible(true);
        view.setCockpitBasisInputValue(this.basis() ?? "");
        view.bindCockpitEvents(
            value => this.aendereBasis(value, "eingabe"),
            () => this.aendereBasis(uhrzeitJetzt(new Date()), "jetzt"),
            value => this.aendereBasis(value, "vorschlag"),
            () => view.scrollZuPlanZustand("ueberfaellig")
        );
        this.update();
        this.interval = setInterval(() => this.tick(), 1000);
        // Eigener Aufräum-Hook: der Listener aus startLiveSync fehlt, wenn der
        // Live-Sync deaktiviert ist – der Ticker darf trotzdem nicht weiterlaufen.
        window.addEventListener("hashchange", () => this.stop(), { once: true });
    }

    public stop(): void {
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /** Vom Controller nach jedem Neuzeichnen des Plans gemeldet. */
    public merkeRenderMinute(nowMs: number): void {
        this.letzteFaelligkeitsMinute = Math.floor(nowMs / 60000);
    }

    private tick(): void {
        this.update();
        // Überfällig / jetzt fällig / später ändert sich nur minütlich.
        if (Math.floor(Date.now() / 60000) !== this.letzteFaelligkeitsMinute) {
            this.host.renderNachrichten();
        }
    }

    /** Nur die Basis der Leitung ist verbindlich (THW-Review workflow F2). */
    public basis(): string | null {
        return this.host.storage()?.xZeitBasis || null;
    }

    /** Basis in Millisekunden – nur im X-Zeit-Modus, sonst `null`. */
    public basisMs(now?: Date): number | null {
        const basis = this.basis();
        return this.host.uebung()?.spielModus === "xZeit" && basis ? parseHHMMtoMs(basis, now) : null;
    }

    public update(): void {
        const uebung = this.host.uebung();
        if (!uebung) {
            return;
        }
        const now = new Date();
        const basisMs = this.basisMs(now);
        this.host.view.updateCockpit(buildCockpitAnzeige({
            uebung,
            effektiv: this.host.effektiverStatus(),
            basis: this.basis(),
            docs: this.host.teilnehmerDocs(),
            now,
            hinterPlan: basisMs === null ? null : this.zaehleFaellig(basisMs, now)
        }));
    }

    /** Eine andere Leitung hat die Basis geändert: Eingabefeld und Kacheln nachziehen. */
    public remoteBasisUebernommen(): void {
        this.host.view.setCockpitBasisInputValue(this.basis() ?? "");
        this.update();
    }

    private zaehleFaellig(basisMs: number, now: Date): { ueberfaellig: number; faellig: number } {
        const uebung = this.host.uebung();
        if (!uebung) {
            return { ueberfaellig: 0, faellig: 0 };
        }
        return zaehleFaelligkeit(buildFaelligkeit(buildPlan(uebung), this.host.effektiverStatus(), basisMs, {
            intervallMinuten: uebung.xZeitIntervallMinuten,
            jetztMs: now.getTime()
        }));
    }

    private ueberfaelligMit(basis: string | null, now: Date): number {
        const ms = basis ? parseHHMMtoMs(basis, now) : null;
        return ms === null ? 0 : this.zaehleFaellig(ms, now).ueberfaellig;
    }

    /**
     * Fragt nach, wo es nötig ist, und liefert die tatsächlich zu setzende
     * Basis – `null`, wenn abgebrochen wurde.
     */
    private bestaetigeBasis(neu: string, ausloeser: Ausloeser, now: Date): string | null {
        const alt = this.basis();
        const zurueck = ausloeser === "vorschlag" && neu ? minutenZurueck(neu, now) : null;
        if (zurueck !== null && zurueck >= VORSCHLAG_RUECKFRAGE_AB_MIN) {
            if (uiFeedback.confirm(vergangenerBeginnFrage(neu, zurueck, this.ueberfaelligMit(neu, now)))) {
                return neu;
            }
            const jetzt = uhrzeitJetzt(now);
            return uiFeedback.confirm(stattdessenJetztFrage(jetzt)) ? jetzt : null;
        }
        if (!alt) {
            return neu;
        }
        const frage = basisWechselFrage({
            alt,
            neu,
            ueberfaelligVorher: this.ueberfaelligMit(alt, now),
            ueberfaelligNachher: this.ueberfaelligMit(neu, now)
        });
        return uiFeedback.confirm(frage) ? neu : null;
    }

    public aendereBasis(wert: string, ausloeser: Ausloeser): void {
        const alt = this.basis();
        if ((wert || null) === alt) {
            return;
        }
        const neu = this.bestaetigeBasis(wert, ausloeser, new Date());
        if (neu === null || (neu || null) === alt) {
            this.host.view.setCockpitBasisInputValue(alt ?? "");
            return;
        }
        this.setzeBasis(neu);
        this.host.view.zeigeRueckgaengig(
            `X-Zeit-Basis ${alt ?? "–"} → ${neu || "–"} geändert – gilt für alle.`,
            () => this.setzeBasis(alt ?? "")
        );
    }

    /**
     * Setzt die verbindliche X-Zeit-Basis. Sie geht über `leitung-public` an
     * alle Leitungs-Arbeitsplätze und Teilnehmer.
     */
    private setzeBasis(value: string): void {
        const storage = this.host.storage();
        if (!storage) {
            return;
        }
        if (value) {
            storage.xZeitBasis = value;
        } else {
            delete storage.xZeitBasis;
        }
        storage.xZeitBasisGeaendertUm = new Date().toISOString();
        this.host.view.setCockpitBasisInputValue(value);
        this.host.save();
        this.update();
        this.host.renderNachrichten();
    }
}
