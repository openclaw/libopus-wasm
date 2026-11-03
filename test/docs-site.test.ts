import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builder = path.join(repoRoot, "scripts", "build-docs-site.mjs");

describe("docs site discovery and URLs", () => {
  it.each([
    { cname: "", broken: false },
    { cname: "docs.example.com", broken: false },
    { cname: "docs.example.com", broken: true },
  ])("handles nested pages with %j", ({ cname, broken }) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "libopus-docs-test-"));
    const docs = path.join(root, "docs");
    const output = path.join(root, "dist", "docs-site");
    try {
      const section = cname ? "guide" : "";
      const guideSource = cname ? "guide/README.md" : "guide.md";
      const guideOutput = cname ? "guide/index.html" : "guide.html";
      fs.mkdirSync(path.join(docs, section), { recursive: true });
      fs.writeFileSync(path.join(docs, "index.md"), `# Home\n\n[Guide](${guideSource})\n`);
      fs.writeFileSync(path.join(docs, "install.md"), "# Install\n");
      fs.writeFileSync(path.join(docs, "quickstart.md"), "# Quickstart\n");
      fs.writeFileSync(path.join(docs, guideSource),
        `# Guide\n\n[Details](details.md#${broken ? "missing" : "topic"})\n`);
      fs.writeFileSync(path.join(docs, section, "details.md"), "# Details\n\n## Topic\n");
      fs.writeFileSync(path.join(docs, "ignored.txt"), "[Bad](missing.md)");
      if (cname) fs.writeFileSync(path.join(root, "CNAME"), cname);
      const build = () => execFileSync(process.execPath, [builder], { cwd: root, stdio: "pipe" });
      if (broken) {
        expect(build).toThrow(/missing anchor/);
        return;
      }
      build();
      const guide = fs.readFileSync(path.join(output, guideOutput), "utf8");
      const details = fs.readFileSync(path.join(output, section, "details.html"), "utf8");
      const home = fs.readFileSync(path.join(output, "index.html"), "utf8");
      const llms = fs.readFileSync(path.join(output, "llms.txt"), "utf8");
      expect(guide).toContain('href="details.html#topic"');
      expect(details).toContain('id="topic"');
      expect(fs.existsSync(path.join(output, "ignored.html"))).toBe(false);
      expect(guide).toContain(`rel="canonical" href="${cname ? `https://${cname}/guide/` : "guide.html"}"`);
      expect(home).toContain(`rel="canonical" href="${cname ? `https://${cname}/` : "index.html"}"`);
      expect(llms).toContain(`- Guide: ${cname ? `https://${cname}/guide/` : "guide.html"}`);
      expect(llms).toContain(`- Details: ${cname ? `https://${cname}/guide/` : ""}details.html`);
      build();
      expect(fs.readFileSync(path.join(output, guideOutput), "utf8")).toBe(guide);
      expect(fs.readFileSync(path.join(output, "llms.txt"), "utf8")).toBe(llms);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function buildPage(body: string, checkDeterminism = false): string {
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
    if (checkDeterminism) {
      execFileSync(process.execPath, [builder], { cwd: root });
      const second = fs.readFileSync(
        path.join(root, "dist", "docs-site", "api-reference.html"),
        "utf8",
      );
      expect(second).toBe(first);
    }
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
      true,
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
