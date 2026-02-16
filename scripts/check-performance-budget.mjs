import fs from "node:fs";
import zlib from "node:zlib";

const budgets = [
    { file: "dist/bundle.js", maxBytes: 4_200_000, maxGzipBytes: 980_000 },
    { file: "dist/bundle.css", maxBytes: 420_000, maxGzipBytes: 70_000 },
    { file: "dist/style.css", maxBytes: 60_000, maxGzipBytes: 12_000 }
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
