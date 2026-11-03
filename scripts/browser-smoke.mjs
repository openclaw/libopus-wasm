import assert from "node:assert/strict";
import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { build, preview } from "vite";

assert.ok(process.argv[2], "pass the isolated, installed package consumer directory");
const root = resolve(process.argv[2]);
await cp(new URL("../test/browser/installed-package/", import.meta.url), root, { recursive: true });
const config = { root, configFile: false, logLevel: "warn" };
await build(config);
const server = await preview({ ...config, preview: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("requestfailed", (request) => errors.push(request.failure()?.errorText));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => typeof window.runBrowserSmoke === "function");
  const initialRequests = requests.length;
  let timeout;
  let result;
  try {
    // A renderer-side timer cannot fire while synchronous WASM is stuck.
    result = await Promise.race([
      page.evaluate(() => window.runBrowserSmoke()),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("codec timed out")), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.deepEqual(errors, []);
  assert.equal(result.crossOriginIsolated, false);
  assert.equal(result.sharedArrayBuffer, "undefined");
  assert.equal(result.buffer, "undefined");
  assert.ok(requests.every((url) => !/\.wasm(?:[?#]|$)/.test(url)), "no external WASM asset");
  assert.equal(requests.length, initialRequests, "codec initialization must not fetch assets");
  assert.equal(result.results.length, 2);
  for (const [index, frame] of result.results.entries()) {
    const { packetBytes, ...actual } = frame;
    assert.ok(packetBytes > 0);
    assert.deepEqual(actual, {
      float: index === 1,
      decodedSamples: 1920,
      finite: true,
      audible: true,
      samples: 960,
      channels: 2,
      durationMs: 20,
    });
  }
  console.log("Packed browser Int16/Float32 encode/decode passed without external WASM or isolation.");
} finally {
  try {
    await browser?.close();
  } finally {
    await server.close();
  }
}
