import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const result = await build({
  configFile: false,
  logLevel: "error",
  build: { write: false, minify: true, lib: { entry: "dist/index.js", formats: ["es"] } },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(build => {
  if (!("output" in build)) throw new Error("unexpected bundle result");
  return build.output;
});
const chunks = outputs.filter(file => file.type === "chunk");
const gzipBytes = gzipSync(chunks.map(chunk => chunk.code).join("\n")).byteLength;
const javascriptBytes = chunks.reduce((size, chunk) => size + Buffer.byteLength(chunk.code), 0);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, "core must have no runtime dependencies");
assert.ok(gzipBytes < 220000, `browser entry grew to ${gzipBytes} gzip bytes`);
let distBytes = 0;
for (const entry of await readdir("dist", { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) distBytes += (await readFile(`${entry.parentPath}/${entry.name}`)).byteLength;
}
console.log(JSON.stringify({ javascriptBytes, gzipBytes, distBytes, runtimeDependencies: 0 }));
