import fs from "node:fs";
import zlib from "node:zlib";

const budgets = [
    // Baseline nach dem Ausbau von jQuery und select2: 2.57 MB roh / 623 kB gzip
    // (davor 2.92 MB / 724 kB). Wer die Grenze anhebt, sollte vorher pruefen, ob
    // Chart.js, jsPDF oder pdf.js nicht nachgeladen statt gebundelt werden koennen.
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
