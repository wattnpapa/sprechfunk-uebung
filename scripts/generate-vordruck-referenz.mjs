// Erzeugt eine Referenz-PDF zum Ausrichten der Vordruck-Koordinaten.
//
//   npm run build            # dist/assets/*.png werden als Hintergrund gebraucht
//   npm run vordruck:referenz
//
// Ergebnis: vordruck-referenz.pdf (gitignored) mit vier A5-Seiten:
//   1  Nachrichtenvordruck, alle Felder gefüllt
//   2  derselbe Vordruck mit Millimeter-Raster und numerierten Ankerpunkten
//   3  Meldevordruck, alle Felder gefüllt
//   4  derselbe Vordruck mit Raster und Ankerpunkten
//
// Zusätzlich listet das Skript auf der Konsole jeden gezeichneten Text mit den
// tatsächlich verwendeten x/y-Werten auf. Die Nummern der Liste entsprechen den
// blauen Nummern auf den Rasterseiten – so lässt sich jeder Wert im Quellcode
// eindeutig zuordnen.
//
// Die Koordinaten werden nicht im Skript gepflegt, sondern zur Laufzeit
// mitprotokolliert: `pdf.text` wird gekapselt, während die echten Klassen
// `Nachrichtenvordruck` und `Meldevordruck` zeichnen. Die Liste kann also nicht
// veralten.
//
// Optionen:
//   --out <pfad>    Zielpfad der PDF (Default vordruck-referenz.pdf)
//   --ohne-xzeit    Nummernfeld mit laufender Nummer statt "X+12" füllen
//   --ohne-raster   nur die gefüllten Seiten erzeugen, ohne Rasterseiten
//   --alle-felder   zusätzliche Seite mit jedem bekannten Ankreuzfeld
//
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = path.resolve(repoRoot, outIndex >= 0 ? args[outIndex + 1] : "vordruck-referenz.pdf");
const mitXZeit = !args.includes("--ohne-xzeit");
const mitRaster = !args.includes("--ohne-raster");
const alleFelder = args.includes("--alle-felder");

const HARNESS_ID = "\0vordruck-harness";
const HARNESS_PATH = "/vordruck-referenz-harness.html";

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".json": "application/json; charset=utf-8"
};

/**
 * Bündelt einen virtuellen Einstiegspunkt, der die echten Vordruck-Klassen
 * importiert und `window.__vordruckReferenz` bereitstellt.
 *
 * Der Einstiegspunkt ist bewusst virtuell: eine Datei unter `src/` würde in
 * `tsc` und ESLint mitlaufen, eine unter `scripts/` läge außerhalb des
 * `rootDir` der tsconfig.
 */
async function baueHarnessBundle() {
    const entry = `
import { jsPDF } from "jspdf";
import { FunkUebung } from ${JSON.stringify(path.join(repoRoot, "src/models/FunkUebung.ts"))};
import { Nachrichtenvordruck } from ${JSON.stringify(path.join(repoRoot, "src/pdf/Nachrichtenvordruck.ts"))};
import { Meldevordruck } from ${JSON.stringify(path.join(repoRoot, "src/pdf/Meldevordruck.ts"))};
import { NACHRICHTENVORDRUCK_ANKREUZFELDER } from ${JSON.stringify(path.join(repoRoot, "src/vordruck/felder.ts"))};

const SEITE_BREITE = 148;
const SEITE_HOEHE = 210;

function baueUebung(optionen) {
    const uebung = new FunkUebung("vordruck-referenz");
    uebung.id = "REFERENZ-0000";
    uebung.name = "Vordruck-Referenz – alle Felder gefüllt";
    uebung.rufgruppe = "T_OL_GOLD-1";
    uebung.leitung = "Heros Wind 10";
    uebung.createDate = new Date(optionen.zeitpunkt);
    uebung.datum = new Date(optionen.zeitpunkt);
    uebung.teilnehmerListe = [
        "Heros Oldenburg 16/11",
        "Heros Wilhelmshaven 21/10",
        "Heros Bad Zwischenahn 19/51",
        "Heros Jever 21/10"
    ];
    uebung.teilnehmerStellen = {
        "Heros Oldenburg 16/11": "Bereitstellungsraum Nord",
        "Heros Wilhelmshaven 21/10": "Abschnittsleitung Hafen",
        "Heros Bad Zwischenahn 19/51": "Verpflegungsstelle Süd",
        "Heros Jever 21/10": "Technische Einsatzleitung"
    };
    return uebung;
}

function baueNachricht(optionen, art) {
    const nachricht = {
        id: 7,
        art,
        empfaenger: [
            "Heros Wilhelmshaven 21/10",
            "Heros Bad Zwischenahn 19/51",
            "Heros Jever 21/10"
        ],
        nachricht: "Erkundung an der SCHLEUSE abgeschlossen, Zufahrt ist frei.\\n"
            + "Wir sind mit 1/2/9 im Bereitstellungsraum eingetroffen und einsatzbereit.\\n"
            + "Benötigen zusätzlich zwei Stromerzeuger und Beleuchtungsmaterial, Kennwort BERGUNG.",
        loesungsbuchstaben: ["3K"],
        staerken: [{ fuehrer: 1, unterfuehrer: 2, helfer: 9 }]
    };
    if (optionen.mitXZeit) {
        nachricht.xZeitSlot = 12;
    }
    return nachricht;
}

/** Kapselt pdf.text, um jede Zeichenoperation samt Koordinaten festzuhalten. */
function protokolliere(pdf, seite, protokoll) {
    const original = pdf.text.bind(pdf);
    pdf.text = function (text, x, y, optionen) {
        protokoll.push({
            seite,
            text: Array.isArray(text) ? text.join(" | ") : String(text),
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            fontSize: Math.round(pdf.getFontSize() * 100) / 100,
            align: optionen && optionen.align ? optionen.align : "",
            angle: optionen && optionen.angle ? optionen.angle : 0
        });
        return original(text, x, y, optionen);
    };
    return () => {
        pdf.text = original;
    };
}

function zeichneRaster(pdf) {
    pdf.setLineWidth(0.1);
    for (let x = 0; x <= SEITE_BREITE; x += 5) {
        pdf.setDrawColor(255, x % 10 === 0 ? 120 : 200, x % 10 === 0 ? 120 : 200);
        pdf.line(x, 0, x, SEITE_HOEHE);
    }
    for (let y = 0; y <= SEITE_HOEHE; y += 5) {
        pdf.setDrawColor(255, y % 10 === 0 ? 120 : 200, y % 10 === 0 ? 120 : 200);
        pdf.line(0, y, SEITE_BREITE, y);
    }

    pdf.setTextColor(200, 0, 0);
    pdf.setFontSize(4);
    for (let x = 10; x < SEITE_BREITE; x += 10) {
        pdf.text(String(x), x + 0.3, 3);
        pdf.text(String(x), x + 0.3, SEITE_HOEHE - 0.8);
    }
    for (let y = 10; y < SEITE_HOEHE; y += 10) {
        pdf.text(String(y), 0.5, y - 0.5);
        pdf.text(String(y), SEITE_BREITE - 5, y - 0.5);
    }
    pdf.setTextColor(0, 0, 0);
}

/** Setzt an jede protokollierte Position ein Kreuz mit laufender Nummer. */
function zeichneAnker(pdf, eintraege) {
    pdf.setLineWidth(0.2);
    eintraege.forEach(eintrag => {
        pdf.setDrawColor(0, 90, 200);
        pdf.line(eintrag.x - 1.6, eintrag.y, eintrag.x + 1.6, eintrag.y);
        pdf.line(eintrag.x, eintrag.y - 1.6, eintrag.x, eintrag.y + 1.6);
        pdf.setTextColor(0, 90, 200);
        pdf.setFontSize(5);
        pdf.text(String(eintrag.nr), eintrag.x + 1.9, eintrag.y - 0.6);
    });
    pdf.setTextColor(0, 0, 0);
}

window.__vordruckReferenz = function (optionen) {
    const uebung = baueUebung(optionen);
    const teilnehmer = "Heros Oldenburg 16/11";
    const protokoll = [];
    const pdf = new jsPDF("p", "mm", "a5");
    let ersteSeite = true;

    /**
     * Zeichnet einen Vordruck einmal gefüllt und – bei aktivem Raster – ein
     * zweites Mal mit Raster und Ankerpunkten. Der Zeichner wird zweimal
     * aufgerufen, damit beide Seiten garantiert identisch aufgebaut sind.
     */
    function vordruckSeiten(bezeichnung, zeichne) {
        if (ersteSeite) {
            ersteSeite = false;
        } else {
            pdf.addPage();
        }

        const stop = protokolliere(pdf, bezeichnung, protokoll);
        zeichne();
        stop();

        const eintraege = protokoll
            .filter(e => e.seite === bezeichnung)
            .map((e, i) => ({ ...e, nr: i + 1 }));

        if (optionen.mitRaster) {
            pdf.addPage();
            zeichne();
            zeichneRaster(pdf);
            zeichneAnker(pdf, eintraege);
        }

        return eintraege;
    }

    const eintraege = [
        ...vordruckSeiten("Nachrichtenvordruck, art = spruch – src/pdf/Nachrichtenvordruck.ts", () => {
            new Nachrichtenvordruck(teilnehmer, uebung, pdf, baueNachricht(optionen, "spruch")).draw();
        }),
        ...vordruckSeiten("Nachrichtenvordruck, art = durchsage – src/pdf/Nachrichtenvordruck.ts", () => {
            new Nachrichtenvordruck(teilnehmer, uebung, pdf, baueNachricht(optionen, "durchsage")).draw();
        }),
        ...vordruckSeiten("Meldevordruck – src/pdf/Meldevordruck.ts", () => {
            new Meldevordruck(teilnehmer, uebung, pdf, baueNachricht(optionen, "spruch")).draw();
        })
    ];

    // Eine Seite mit jedem bekannten Ankreuzfeld – zum Ausrichten der Felder,
    // die im Übungsbetrieb nicht belegt werden. Die Klasse selbst kreuzt hier
    // nichts an (leere Belegung, keine Art), alle Kreuze kommen aus der Liste.
    if (optionen.alleFelder) {
        const bezeichnung = "Alle Felder – src/vordruck/felder.ts";
        const felderEintraege = Object.entries(NACHRICHTENVORDRUCK_ANKREUZFELDER)
            .map(([name, position], index) => ({
                seite: bezeichnung,
                text: name,
                x: position.x,
                y: position.y,
                fontSize: 16,
                align: "",
                angle: 0,
                nr: index + 1
            }));

        // Beispielwerte fuer jedes Feld: Datum/Uhrzeit im BOS-Format,
        // Handzeichen zwei- bis dreistellig, Abfassungszeit im NATO-Format.
        const vermerk = { datum: "31.08.", uhrzeit: "11:31", handzeichen: "RUD" };
        const beispielDaten = {
            // Ankreuzfelder schaltet diese Seite aus – alle Kreuze kommen aus
            // der Liste, damit auch die sich ausschließenden zu sehen sind.
            uebermittlungsweg: undefined,
            richtung: undefined,
            aufnahmevermerk: vermerk,
            annahmevermerk: vermerk,
            befoerderungsvermerk: vermerk,
            abfassungszeit: "311131aug26",
            zeichen: "RUD",
            funktion: "S 2",
            quittung: { uhrzeit: "11:31", zeichen: "RUD", stelle: "TEL" },
            vermerke: "Rückfrage"
        };

        const zeichneAlle = () => {
            new Nachrichtenvordruck(teilnehmer, uebung, pdf, baueNachricht(optionen, undefined))
                .mitDaten(beispielDaten)
                .draw();
            pdf.setFontSize(16);
            felderEintraege.forEach(eintrag => pdf.text("x", eintrag.x, eintrag.y));
        };

        pdf.addPage();
        zeichneAlle();

        if (optionen.mitRaster) {
            pdf.addPage();
            zeichneAlle();
            zeichneRaster(pdf);
            zeichneAnker(pdf, felderEintraege);
        }

        eintraege.push(...felderEintraege);
    }

    const bytes = pdf.output("arraybuffer");
    let binaer = "";
    const view = new Uint8Array(bytes);
    for (let i = 0; i < view.length; i++) {
        binaer += String.fromCharCode(view[i]);
    }

    return { pdfBase64: btoa(binaer), eintraege };
};
`;

    const bundle = await rollup({
        input: HARNESS_ID,
        onwarn: warnung => {
            if (warnung.code !== "CIRCULAR_DEPENDENCY" && warnung.code !== "THIS_IS_UNDEFINED") {
                console.warn(`  rollup: ${warnung.message}`);
            }
        },
        plugins: [
            {
                name: "vordruck-harness",
                resolveId: id => (id === HARNESS_ID ? id : null),
                load: id => (id === HARNESS_ID ? entry : null)
            },
            resolve({
                browser: true,
                preferBuiltins: false,
                extensions: [".mjs", ".js", ".ts"],
                dedupe: ["jspdf"]
            }),
            commonjs({ include: ["node_modules/**"], transformMixedEsModules: true }),
            typescript({ tsconfig: path.join(repoRoot, "tsconfig.json"), outDir: null, declaration: false })
        ]
    });
    const { output } = await bundle.generate({ format: "iife", inlineDynamicImports: true });
    await bundle.close();
    return output[0].code;
}

/**
 * Statischer Server auf `dist`. Nötig, weil die Vordrucke ihr Hintergrundbild
 * per relativer URL laden und jsPDF dafür einen Browser-Kontext braucht.
 */
function starteServer() {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");
        if (url.pathname === HARNESS_PATH) {
            res.writeHead(200, { "Content-Type": MIME[".html"] });
            res.end("<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Vordruck-Referenz</title></head><body></body></html>");
            return;
        }
        const ziel = path.join(distDir, path.normalize(url.pathname));
        if (!ziel.startsWith(distDir)) {
            res.writeHead(403).end();
            return;
        }
        try {
            const inhalt = await readFile(ziel);
            res.writeHead(200, { "Content-Type": MIME[path.extname(ziel)] ?? "application/octet-stream" });
            res.end(inhalt);
        } catch {
            res.writeHead(404).end();
        }
    });

    return new Promise(fertig => {
        server.listen(0, "127.0.0.1", () => fertig({ server, port: server.address().port }));
    });
}

function formatiereTabelle(eintraege, seite) {
    const zeilen = eintraege.filter(e => e.seite === seite);
    const kopf = ["Nr", "x", "y", "pt", "Inhalt"];
    const daten = zeilen.map(e => [
        String(e.nr),
        e.x.toFixed(1),
        e.y.toFixed(1),
        e.fontSize.toFixed(1),
        `${e.text.slice(0, 58)}${e.text.length > 58 ? "…" : ""}${e.angle ? ` (${e.angle}° gedreht)` : ""}${e.align ? ` (${e.align})` : ""}`
    ]);
    const breiten = kopf.map((titel, i) =>
        Math.max(titel.length, ...daten.map(zeile => zeile[i].length))
    );
    const formatiere = zeile => zeile.map((wert, i) => wert.padEnd(breiten[i])).join("  ");
    return [formatiere(kopf), breiten.map(b => "-".repeat(b)).join("  "), ...daten.map(formatiere)].join("\n");
}

async function main() {
    try {
        await readFile(path.join(distDir, "assets/nachrichtenvordruck4fach.png"));
    } catch {
        console.error("dist/assets/nachrichtenvordruck4fach.png fehlt – bitte zuerst 'npm run build' ausführen.");
        process.exitCode = 1;
        return;
    }

    console.log("Bündle Vordruck-Klassen …");
    const harnessCode = await baueHarnessBundle();

    const { server, port } = await starteServer();
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.on("pageerror", fehler => console.error(`  Browser-Fehler: ${fehler.message}`));
        await page.goto(`http://127.0.0.1:${port}${HARNESS_PATH}`);
        await page.addScriptTag({ content: harnessCode });

        const ergebnis = await page.evaluate(optionen => globalThis.__vordruckReferenz(optionen), {
            zeitpunkt: "2026-01-15T09:30:00",
            mitXZeit,
            mitRaster,
            alleFelder
        });

        await writeFile(outFile, Buffer.from(ergebnis.pdfBase64, "base64"));
        console.log(`\nPDF geschrieben: ${path.relative(repoRoot, outFile)}`);
        for (const abschnitt of [...new Set(ergebnis.eintraege.map(e => e.seite))]) {
            console.log(`\n${abschnitt}`);
            console.log(formatiereTabelle(ergebnis.eintraege, abschnitt));
        }
        console.log("\nDie Nr entspricht den blauen Ankerpunkten auf den Rasterseiten der PDF.");
    } finally {
        await browser.close();
        server.close();
    }
}

await main();
