import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(repoRoot, "scripts", "build-docs-site.mjs");

function buildPage(body: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "libopus-docs-test-"));
  const docs = path.join(root, "docs");
  fs.mkdirSync(docs);

  try {
    const writeDoc = (name: string, content: string) =>
      fs.writeFileSync(path.join(docs, name), content);
    writeDoc("index.md", "# Home\n\nWelcome.\n");
    writeDoc("install.md", "# Install\n\nInstall locally.\n");
    writeDoc("quickstart.md", "# Quickstart\n\nStart locally.\n");
    writeDoc("api-reference.md", body);

    execFileSync(process.execPath, [builder], { cwd: root });
    const first = fs.readFileSync(
      path.join(root, "dist", "docs-site", "api-reference.html"),
      "utf8",
    );
    execFileSync(process.execPath, [builder], { cwd: root });
    const second = fs.readFileSync(
      path.join(root, "dist", "docs-site", "api-reference.html"),
      "utf8",
    );

    expect(second).toBe(first);
    return first;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function pageToc(page: string): string {
  const toc = page.match(/<nav class="toc"[\s\S]*?<\/nav>/)?.[0];
  expect(toc).toBeDefined();
  return toc!;
}

describe("docs site headings", () => {
  it("escapes malicious heading text once in the TOC", () => {
    const page = buildPage(
      [
        "# API reference",
        "",
        "## Safe",
        "",
        '## <img src=x onerror=alert("toc")> <scr<script>ipt>alert("toc")</scr<script>ipt>',
        "",
      ].join("\n"),
    );
    const toc = pageToc(page);

    expect(toc).toBe(
      '<nav class="toc" aria-label="On this page"><h2>On this page</h2>' +
        '<a class="toc-l2" href="#safe">Safe</a>' +
        '<a class="toc-l2" href="#img-src-x-onerror-alert-toc-scr-script-ipt-alert-toc-scr-script-ipt">' +
        '&lt;img src=x onerror=alert(&quot;toc&quot;)&gt; ' +
        '&lt;scr&lt;script&gt;ipt&gt;alert(&quot;toc&quot;)&lt;/scr&lt;script&gt;ipt&gt;</a></nav>',
    );
    expect(toc).not.toMatch(/&amp;lt;|<img|<script/i);
  });

  it("renders deterministic labels and unique anchors from heading facts", () => {
    const page = buildPage(
      [
        "# API reference",
        "",
        "## Repeat",
        "",
        "> ### **Nested [label](https://example.com)** and `code`",
        "",
        "## Repeat",
        "",
        "## Repeat 2",
        "",
        "### Fish &amp; Chips",
        "",
      ].join("\n"),
    );
    const toc = pageToc(page);

    expect(toc).toBe(
      '<nav class="toc" aria-label="On this page"><h2>On this page</h2>' +
        '<a class="toc-l2" href="#repeat">Repeat</a>' +
        '<a class="toc-l3" href="#nested-label-https-example-com-and-code">Nested label and code</a>' +
        '<a class="toc-l2" href="#repeat-2">Repeat</a>' +
        '<a class="toc-l2" href="#repeat-2-2">Repeat 2</a>' +
        '<a class="toc-l3" href="#fish-amp-chips">Fish &amp;amp; Chips</a></nav>',
    );

    const headingIds = [...page.matchAll(/<h[23] id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const tocIds = [...toc.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(tocIds).toEqual(headingIds);
    expect(new Set(headingIds).size).toBe(headingIds.length);
    expect(page).toMatch(
      /<h3 id="nested-label-https-example-com-and-code">[^<]*<a class="anchor"[^>]*>#<\/a><strong>Nested <a href="https:\/\/example\.com">label<\/a><\/strong> and <code>code<\/code><\/h3>/,
    );
  });
});
