import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, "..", "package.json");
const readmePath = path.join(__dirname, "..", "README.md");

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const homepage = typeof pkg.homepage === "string" ? pkg.homepage : "";

if (!homepage) {
    console.error("Missing homepage in package.json");
    process.exit(1);
}

const base = homepage.replace(/\/$/, "");
const coverageUrl = `${base}/coverage/`;

const readme = fs.readFileSync(readmePath, "utf8");
const regex = /\[!\[Coverage Report\]\([^)]+\)\]\([^)]+\)/;
const replacement = `[![Coverage Report](https://img.shields.io/badge/Coverage%20Report-HTML-blue)](${coverageUrl})`;

if (!regex.test(readme)) {
    console.error("Coverage Report badge not found in README.md");
    process.exit(1);
}

const updated = readme.replace(regex, replacement);
fs.writeFileSync(readmePath, updated);
