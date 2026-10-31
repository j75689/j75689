// Renders github-readme-stats cards to static SVG files by calling the
// upstream API handlers directly, so the README doesn't depend on the
// (frequently paused) public Vercel instance.
//
// Usage: node render-cards.mjs <github-readme-stats dir> <output dir>
// Requires PAT_1 (a GitHub token) in the environment.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [grsDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
if (!grsDir || !outDir) {
  console.error("usage: node render-cards.mjs <grs-dir> <out-dir>");
  process.exit(1);
}

const common = { theme: "tokyonight", hide_border: "true" };
const pin = (username, repo) => ({
  file: `pin-${username}-${repo}.svg`,
  handler: "pin",
  query: { username, repo, description_lines_count: "3", ...common },
});

const cards = [
  pin("bnb-chain", "bsc"),
  pin("bnb-chain", "reth-bsc-trail"),
  pin("bnb-chain", "greenfield"),
  pin("j75689", "anyship"),
  pin("j75689", "cueflow"),
  pin("j75689", "Tmaster"),
  pin("j75689", "goscraper"),
  {
    file: "stats.svg",
    handler: "index",
    query: { username: "j75689", show_icons: "true", ...common },
  },
  {
    file: "top-langs.svg",
    handler: "top-langs",
    query: { username: "j75689", layout: "compact", ...common },
  },
];

const render = async (handler, query) => {
  const mod = await import(pathToFileURL(path.join(grsDir, "api", `${handler}.js`)));
  let body;
  const res = {
    setHeader() {},
    status() {
      return res;
    },
    send(b) {
      body = b;
      return b;
    },
  };
  await mod.default({ query }, res);
  return String(body ?? "");
};

fs.mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const { file, handler, query } of cards) {
  const svg = (await render(handler, query)).trim();
  // Error cards from the upstream renderer contain this marker; keep the
  // previous good file instead of publishing an error image.
  if (!svg.startsWith("<svg") || svg.includes("Something went wrong")) {
    const reason = [...svg.matchAll(/<tspan[^>]*>([^<]+)<\/tspan>|<text[^>]*>([^<]+)<\/text>/g)]
      .map((m) => (m[1] ?? m[2]).trim())
      .filter(Boolean)
      .join(" | ");
    console.error(`✗ ${file}: render failed: ${reason || svg.slice(0, 200)}`);
    failed++;
    continue;
  }
  fs.writeFileSync(path.join(outDir, file), svg);
  console.log(`✓ ${file}`);
}
process.exit(failed ? 1 : 0);
