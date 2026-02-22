import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const templatePath = path.join(root, "src", "firebase-config.template.js");
const outputPath = path.join(root, "src", "firebase-config.js");

const replacements = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? "",
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "",
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? "",
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID ?? "",
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID ?? ""
};

let content = await readFile(templatePath, "utf8");
for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`\${${key}}`, value);
}

await writeFile(outputPath, content, "utf8");
