import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const opusVersion = "1.6.1";
const opusTarball = `opus-${opusVersion}.tar.gz`;
const opusUrl = `https://downloads.xiph.org/releases/opus/${opusTarball}`;
const opusSha256 = "6ffcb593207be92584df15b32466ed64bbec99109f007c82205f0194572411a1";
const cacheDir = path.join(repoRoot, ".cache");
const sourceDir = path.join(cacheDir, `opus-${opusVersion}`);
const buildDir = path.join(cacheDir, `opus-${opusVersion}-build`);
const generatedDir = path.join(repoRoot, "src", "generated");
const outputPath = path.join(generatedDir, "libopus.generated.mjs");

await fs.mkdir(cacheDir, { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });

if (!(await exists(path.join(sourceDir, "configure")))) {
  const tarballPath = path.join(cacheDir, opusTarball);
  await downloadFile(opusUrl, tarballPath);
  await verifySha256(tarballPath, opusSha256);
  await run("tar", ["-xzf", tarballPath, "-C", cacheDir], { cwd: repoRoot });
}

await fs.rm(buildDir, { recursive: true, force: true });
await fs.mkdir(buildDir, { recursive: true });

await run(
  "emconfigure",
  [
    path.join(sourceDir, "configure"),
    "--disable-doc",
    "--disable-extra-programs",
    "--disable-shared",
    "--enable-static",
    "--host=wasm32-unknown-emscripten",
  ],
  { cwd: buildDir },
);
await run("emmake", ["make", "-j", String(Math.max(1, Math.min(8, cpuCount())))], {
  cwd: buildDir,
});

const exportedFunctions = [
  "_free",
  "_malloc",
  "_oc_create_decoder",
  "_oc_create_encoder",
  "_oc_decode",
  "_oc_destroy_decoder",
  "_oc_destroy_encoder",
  "_oc_encode",
  "_oc_encoder_ctl_set_bitrate",
  "_oc_encoder_ctl_set_fec",
  "_oc_encoder_ctl_set_packet_loss_percent",
  "_oc_get_version_string",
  "_oc_strerror",
];

await run(
  "emcc",
  [
    "-O3",
    "-flto",
    "-I",
    path.join(buildDir, "include"),
    "-I",
    path.join(sourceDir, "include"),
    path.join(repoRoot, "native", "opus_wasm_wrapper.c"),
    path.join(buildDir, ".libs", "libopus.a"),
    "-o",
    outputPath,
    "-s",
    "ALLOW_MEMORY_GROWTH=1",
    "-s",
    "ASSERTIONS=0",
    "-s",
    "ENVIRONMENT=node",
    "-s",
    "EXPORT_ES6=1",
    "-s",
    `EXPORTED_FUNCTIONS=${JSON.stringify(exportedFunctions)}`,
    "-s",
    'EXPORTED_RUNTIME_METHODS=["HEAP16","HEAPU8","UTF8ToString"]',
    "-s",
    "MODULARIZE=1",
    "-s",
    "SINGLE_FILE=1",
  ],
  { cwd: repoRoot },
);

console.log(`built ${path.relative(repoRoot, outputPath)} from libopus ${opusVersion}`);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url, destination) {
  if (await exists(destination)) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(destination, data);
}

async function verifySha256(filePath, expected) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  const actual = hash.digest("hex");
  if (actual !== expected) {
    throw new Error(`sha256 mismatch for ${path.basename(filePath)}: ${actual}`);
  }
}

function cpuCount() {
  return Number(process.env.LIBOPUS_WASM_BUILD_JOBS) || 4;
}

async function run(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with ${signal ?? code}`));
    });
  });
}
