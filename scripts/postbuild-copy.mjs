import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

await mkdir(dist, { recursive: true });

await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "src", "index.html"), path.join(dist, "index.html"));
await cp(path.join(root, "howto.md"), path.join(dist, "howto.md"));
await cp(path.join(root, "src", "styles", "main.css"), path.join(dist, "style.css"));
await cp(path.join(root, "src", "firebase-config.js"), path.join(dist, "firebase-config.js"));
await cp(path.join(root, "src", "robots.txt"), path.join(dist, "robots.txt"));
await cp(path.join(root, "src", "sitemap.xml"), path.join(dist, "sitemap.xml"));
