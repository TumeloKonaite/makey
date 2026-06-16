import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "src");
const target = join(root, "dist");

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log("Built frontend/dist");
