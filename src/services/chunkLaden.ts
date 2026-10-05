/**
 * Nachladen eines Rollup-Chunks per import(), das einen Netzaussetzer
 * übersteht (THW-Review 2026-10-05, offline P1-1).
 *
 * Browser merken sich ein gescheitertes import() derselben Modul-URL für die
 * Lebensdauer der Seite: ein zweiter Versuch scheitert sofort, ohne das Netz
 * zu fragen. Der Lader vergisst deshalb ein abgelehntes Versprechen und ruft
 * den Chunk beim nächsten Mal unter neuer Adresse ab (angehängter Parameter),
 * sofern die Fehlermeldung die Adresse verrät.
 */

/**
 * Adresse des Chunks aus der Fehlermeldung (Chromium: „Failed to fetch
 * dynamically imported module: <url>“, Firefox: „error loading dynamically
 * imported module: <url>“). Safari nennt keine Adresse.
 */
export function chunkUrlAusFehler(err: unknown): string | undefined {
    const text = err instanceof Error ? err.message : String(err ?? "");
    const treffer = /(https?:\/\/\S+?\.m?js)(?:\?\S*)?(?=\s|$|["'),])/.exec(text);
    return treffer?.[1];
}

/** Neue Adresse für den nächsten Versuch: gleiche Datei, anderer Cache-Schlüssel. */
export function neuerVersuchUrl(url: string, nummer: number): string {
    return `${url}${url.includes("?") ? "&" : "?"}neuladen=${nummer}`;
}

/** Lädt mit `url`, wenn ein Neuversuch unter neuer Adresse nötig ist, sonst den gebündelten Import. */
export type ChunkImporter<T> = (url?: string) => Promise<T>;

export interface ChunkLader<T> {
    lade(): Promise<T>;
    /** Nur für Tests: Importer ersetzen und Zustand vergessen. */
    setzeZurueck(importer?: ChunkImporter<T>): void;
}

export function erzeugeChunkLader<T>(standard: ChunkImporter<T>): ChunkLader<T> {
    let importer = standard;
    let versprechen: Promise<T> | undefined;
    let fehlgeschlageneUrl: string | undefined;
    let versuch = 0;
    return {
        lade() {
            if (versprechen) {
                return versprechen;
            }
            const url = fehlgeschlageneUrl ? neuerVersuchUrl(fehlgeschlageneUrl, ++versuch) : undefined;
            versprechen = importer(url).catch((err: unknown) => {
                versprechen = undefined;
                fehlgeschlageneUrl ??= chunkUrlAusFehler(err);
                throw err;
            });
            return versprechen;
        },
        setzeZurueck(neu?: ChunkImporter<T>) {
            importer = neu ?? standard;
            versprechen = undefined;
            fehlgeschlageneUrl = undefined;
            versuch = 0;
        }
    };
}

/**
 * Variabler Import einer absoluten Adresse (Neuversuch); Rollup lässt ihn
 * unverändert. Ein gebündelter Chunk exportiert nicht unter den
 * Originalnamen: Rollup legt für den dynamischen Import ein
 * Namensraum-Objekt an und exportiert es unter einem verkürzten Namen. Gesucht
 * wird deshalb das Objekt, auf das `passt` zutrifft – der Modul-Namensraum
 * selbst (ungebündelt) oder einer seiner Exporte.
 */
export async function importiereUrl<T>(url: string, passt: (kandidat: Record<string, unknown>) => boolean): Promise<T> {
    const ns = await (import(/* @vite-ignore */ url) as Promise<Record<string, unknown>>);
    return findeNamensraum<T>(ns, passt);
}

export function findeNamensraum<T>(ns: Record<string, unknown>, passt: (kandidat: Record<string, unknown>) => boolean): T {
    const kandidaten: unknown[] = [ns, ...Object.values(ns)];
    const treffer = kandidaten.find(k => typeof k === "object" && k !== null && passt(k as Record<string, unknown>));
    if (!treffer) {
        throw new Error("Nachgeladener Chunk ohne den erwarteten Export.");
    }
    return treffer as T;
}

/** Prüft, ob `kandidat[export]` eine Funktion bzw. ein Objekt mit Methode `methode` ist. */
export function hatFunktion(exportName: string, methode?: string): (kandidat: Record<string, unknown>) => boolean {
    return kandidat => {
        const wert = kandidat[exportName] as Record<string, unknown> | undefined;
        if (methode === undefined) {
            return typeof wert === "function";
        }
        return typeof wert === "object" && wert !== null && typeof wert[methode] === "function";
    };
}
