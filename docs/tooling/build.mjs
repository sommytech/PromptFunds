// Render docs/*.md -> branded PDFs. Usage: node build.mjs <docsDir> <outDir> [onlyFile]
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { marked } from "marked";
import matter from "gray-matter";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("/opt/npm-tools/node_modules/playwright");

const [docsDir, outDir, only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync("/tmp/mmd-");
const logo = `<svg viewBox="0 0 40 40" width="34" height="34"><rect width="40" height="40" rx="11" fill="#0E7C66"/><path d="M13 29V11h8.5a6 6 0 0 1 0 12H17" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28.5" cy="28.5" r="3.2" fill="#F5A524"/></svg>`;
const css = fs.readFileSync(new URL("./doc.css", import.meta.url), "utf8");

let n = 0;
function renderMermaid(code) {
  const inF = path.join(tmp, `d${++n}.mmd`), outF = path.join(tmp, `d${n}.svg`);
  fs.writeFileSync(inF, code);
  fs.writeFileSync(path.join(tmp, "cfg.json"), JSON.stringify({ theme: "base", themeVariables: { primaryColor: "#E6F4F0", primaryBorderColor: "#0E7C66", primaryTextColor: "#0B1B33", lineColor: "#64748B", fontFamily: "Inter, Arial", fontSize: "14px", secondaryColor: "#FEF3DC", tertiaryColor: "#F7F8F6" } }));
  execFileSync("mmdc", ["-i", inF, "-o", outF, "-c", path.join(tmp, "cfg.json"), "-b", "transparent", "-q"], { stdio: "inherit" });
  return `<figure class="diagram">${fs.readFileSync(outF, "utf8").replace(/<\?xml[^>]*>/, "")}</figure>`;
}

const renderer = new marked.Renderer();
const baseCode = renderer.code.bind(renderer);
renderer.code = (tok) => (tok.lang === "mermaid" ? renderMermaid(tok.text) : baseCode(tok));
marked.use({ renderer, gfm: true });

const browser = await chromium.launch();
for (const file of fs.readdirSync(docsDir).filter((f) => f.endsWith(".md") && (!only || f === only)).sort()) {
  const { data, content } = matter(fs.readFileSync(path.join(docsDir, file), "utf8"));
  let body = marked.parse(content).replace(/src="(?!https?:|file:|data:)([^"]+)"/g, (_, p) => { const f = path.resolve(docsDir, p); const mime = f.endsWith(".png") ? "image/png" : "image/jpeg"; return `src="data:${mime};base64,${fs.readFileSync(f).toString("base64")}"`; });
  body = body.replace(/<li>\[ \] /g, '<li class="task">☐ ').replace(/<li>\[x\] /g, '<li class="task">☑ ');
  body = body.replace(/■/g, '<span class="gantt">■</span>');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <section class="cover">
    <div class="cover-top">${logo}<span class="wordmark">Prompt<b>Funds</b></span></div>
    <div class="cover-mid"><p class="doc-type">${data.doc}</p><h1 class="cover-title">${data.title}</h1><p class="cover-sub">${data.subtitle}</p></div>
    <div class="cover-meta"><div><span>Version</span>${data.version}</div><div><span>Date</span>November 2026</div><div><span>Prepared for</span>Prompt Funds / cooperative lending clients</div><div><span>Classification</span>Confidential</div></div>
  </section>
  <main>${body}</main></body></html>`;
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const out = path.join(outDir, file.replace(/\.md$/, ".pdf"));
  await page.pdf({
    path: out, format: "A4", printBackground: true, margin: { top: "22mm", bottom: "20mm", left: "18mm", right: "18mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%;font:8px Inter,Arial;color:#64748B;padding:0 18mm;display:flex;justify-content:space-between"><span>Prompt Funds · ${data.title}</span><span>Confidential</span></div>`,
    footerTemplate: `<div style="width:100%;font:8px Inter,Arial;color:#64748B;padding:0 18mm;display:flex;justify-content:space-between"><span>v${data.version} · November 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  await page.close();
  console.log("wrote", out);
}
await browser.close();
