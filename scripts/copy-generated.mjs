import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "src", "generated");
const outputDir = path.join(repoRoot, "dist", "generated");

await fs.mkdir(outputDir, { recursive: true });
await fs.copyFile(
  path.join(sourceDir, "libopus.generated.mjs"),
  path.join(outputDir, "libopus.generated.mjs"),
);
