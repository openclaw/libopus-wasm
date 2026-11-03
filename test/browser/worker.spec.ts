import { expect, test } from "@playwright/test";

test("AudioWorklet capture blocks encode in a module Worker and decode on the main thread", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/examples/browser.html");
  await page.locator("#start").click();
  await expect(page.locator("#status")).toHaveText("Decoded 5 packets");
  expect(errors).toEqual([]);
});


test("worker reset discards a partial capture frame", async ({ page }) => {
  await page.goto("/examples/browser.html");
  const packets = await page.evaluate(async () => {
    const worker = new Worker("/examples/encode-worker.js", { type: "module" });
    try {
      await new Promise<void>((resolve, reject) => {
        worker.onerror = reject;
        worker.onmessage = ({ data }) => data.type === "ready" ? resolve() : reject(new Error(data.message));
      });
      const result = new Promise<number[][]>((resolve, reject) => {
        const packets: number[][] = [];
        worker.onerror = reject;
        worker.onmessage = ({ data }) => {
          if (data.type === "error") reject(new Error(data.message));
          else if (data.type === "packet") {
            packets.push(Array.from(data.packet));
            if (packets.length === 2) resolve(packets);
          }
        };
      });
      worker.postMessage({ type: "pcm", samples: new Float32Array(128).fill(0.9) });
      worker.postMessage({ type: "reset" });
      worker.postMessage({ type: "pcm", samples: new Float32Array(1920) });
      const moduleUrl = "/dist/index.js";
      const { createEncoder } = await import(moduleUrl);
      const reference = await createEncoder({ channels: 1 });
      try {
        return { actual: await result, expected: [
          Array.from(reference.encodeFloat(new Float32Array(960))),
          Array.from(reference.encodeFloat(new Float32Array(960))),
        ] };
      } finally { reference.free(); }
    } finally { worker.terminate(); }
  });
  expect(packets.actual).toEqual(packets.expected);
});
