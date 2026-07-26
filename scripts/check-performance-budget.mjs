import fs from "node:fs";
import zlib from "node:zlib";

const budgets = [
    // Gemessene Baseline mit terser: 1.44 MB roh / 413 kB gzip. Die Grenze
    // liegt rund 10 % darueber, damit sie Ausreisser faengt statt bei jedem
    // Feature zu reissen. Wer sie anhebt, prueft vorher die groessten Posten:
    // Firestore (805 kB unminifiziert) samt re2js, jsPDF und Chart.js.
    // Nachladen statt buendeln schlaegt jede Budgeterhoehung - JSZip, marked
    // und die jsPDF-Extras liegen bereits in eigenen Chunks.
    // Historie: Die vorherige Grenze (2.8 MB / 660 kB) wurde nie gegen einen
    // echten CI-Build geprueft; der Build lag ab Tag eins bei 3.17 MB / 743 kB.
    { file: "dist/bundle.js", maxBytes: 1_600_000, maxGzipBytes: 460_000 },
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
