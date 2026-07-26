import fs from "node:fs";
import zlib from "node:zlib";

const budgets = [
    // Gemessene Baseline: 2.76 MB roh / 655 kB gzip. Die Grenze stammt aus dem
    // jQuery-/select2-Ausbau, wurde dort aber nie gegen einen echten CI-Build
    // geprueft - der Build lag ab Tag eins bei 3.17 MB / 743 kB und damit rot.
    // Wieder unter die Grenze gebracht durch: MD5-Tiefimport statt der ganzen
    // crypto-js-Cipher-Suite, Chart.js-Registrierung auf Bar + Scatter begrenzt
    // (src/core/chart.ts) sowie Nachladen von JSZip und marked.
    // Der Puffer ist mit 38 kB roh / 5 kB gzip duenn. Naechste Hebel, bevor
    // jemand die Grenze anhebt: keine Minifizierung in rollup.config.js (roh der
    // groesste Posten), Firestore 805 kB + re2js 287 kB, jsPDF 339 kB.
    { file: "dist/bundle.js", maxBytes: 2_800_000, maxGzipBytes: 660_000 },
    // Baseline nach dem Ausbau des select2-Bootstrap-5-Themes: 290 kB roh / 51 kB gzip.
    { file: "dist/bundle.css", maxBytes: 320_000, maxGzipBytes: 56_000 },
    // Baseline nach dem Token-System-Umbau ("Amtlich", LCARS): 71.9 kB roh / 13.4 kB gzip.
    { file: "dist/style.css", maxBytes: 90_000, maxGzipBytes: 16_000 }
];

const failures = [];

for (const budget of budgets) {
    if (!fs.existsSync(budget.file)) {
        failures.push(`${budget.file}: file missing (run npm run build before perf:budget)`);
        continue;
    }

    const content = fs.readFileSync(budget.file);
    const size = content.length;
    const gzipSize = zlib.gzipSync(content).length;

    if (size > budget.maxBytes) {
        failures.push(`${budget.file}: ${size} > ${budget.maxBytes} bytes`);
    }
    if (gzipSize > budget.maxGzipBytes) {
        failures.push(`${budget.file} (gzip): ${gzipSize} > ${budget.maxGzipBytes} bytes`);
    }

    process.stdout.write(`${budget.file}: raw=${size} gzip=${gzipSize}\n`);
}

if (failures.length > 0) {
    console.error("\nPerformance budget exceeded:");
    failures.forEach(f => console.error(`- ${f}`));
    process.exit(1);
}

process.stdout.write("\nPerformance budget check passed.\n");
