/**
 * `pnpm --filter @mitoshi/docs diagrams`: renders the system maps from the built site (out/) to PNG with headless
 * Chrome, using the site's own CSS and fonts, so the README shows exactly what the docs show.
 *
 *   default      the README pictures, dark theme, 1600 px wide: .github/assets/architecture.png, funding-flow.png
 *   --all <dir>  every diagram, wide and tall, dark and light, into <dir> (for checking the drawings)
 *
 * Needs a build first (`pnpm --filter @mitoshi/docs build`) and Google Chrome (CHROME=/path/to/chrome to override).
 * Chrome is driven over the DevTools protocol, so each picture is clipped to the figure exactly.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
const ASSETS = fileURLToPath(new URL("../../../.github/assets/", import.meta.url));
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const README_WIDTH = 1600;
const INSPECT_WIDE = 1440;
const INSPECT_TALL = 375;
const PAD = 48;
const VIEWPORT_HEIGHT = 900;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/** Which built page holds each diagram. */
const PAGES = {
  "system-map": "architecture.html",
  "ohttp-hops": "architecture.html",
  "funding-flow": "architecture.html",
  lifecycle: "private-wallets.html",
};
const README = [
  { id: "system-map", file: "architecture.png" },
  { id: "funding-flow", file: "funding-flow.png" },
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** One export page: the figure alone, on its own ground, with the site's stylesheets and font classes. */
function exportPage(id, variant, theme, width) {
  const html = readFileSync(join(OUT, PAGES[id]), "utf8");
  const figure = html.match(new RegExp(`<figure[^>]*data-diagram="${id}"[^>]*>[\\s\\S]*?</figure>`))?.[0];
  if (!figure) throw new Error(`${id}: no figure in ${PAGES[id]}`);
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  const fonts = html.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "";
  const other = variant === "wide" ? "tall" : "wide";
  return `<!doctype html><html lang="en" class="${fonts} ${theme}"><head><meta charset="utf-8">
${sheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n")}
<style>
  html, body { margin: 0; background: var(--mt-surface-1); }
  .dg { margin: 0; border: 0; border-radius: 0; padding: ${PAD}px; width: ${width}px; box-sizing: border-box; }
  .dg figcaption, .dg-${other} { display: none !important; }
  .dg-${variant} { display: block !important; max-width: none; }
</style></head><body>${figure}</body></html>`;
}

/** Serves out/ plus the export pages, on a free local port. */
function serve(pages) {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pages.has(path)) {
      res.writeHead(HTTP_OK, { "content-type": TYPES[".html"] });
      res.end(pages.get(path));
      return;
    }
    const file = join(OUT, normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(OUT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(HTTP_NOT_FOUND);
      res.end();
      return;
    }
    res.writeHead(HTTP_OK, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** Starts headless Chrome on a throwaway profile and returns its DevTools browser endpoint. */
function launch(profile) {
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--hide-scrollbars",
    "about:blank",
  ]);
  return new Promise((resolve, reject) => {
    let log = "";
    chrome.stderr.on("data", (chunk) => {
      log += chunk;
      const ws = log.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if (ws) resolve({ chrome, ws });
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited (${code}) before it was ready:\n${log}`)));
  });
}

/** A minimal DevTools protocol session over one WebSocket (flat mode: page commands carry a sessionId). */
function connect(url) {
  const socket = new WebSocket(url);
  const waiting = new Map();
  const listeners = [];
  let next = 1;
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else for (const l of listeners) l(msg);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = next++;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const once = (method, sessionId) =>
    new Promise((resolve) => {
      const l = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(msg.params);
        }
      };
      listeners.push(l);
    });
  return new Promise((resolve) => socket.addEventListener("open", () => resolve({ send, once, socket })));
}

/** Loads a page at a width, waits for its fonts, and saves the figure, clipped exactly. */
async function shoot(cdp, url, width, file) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  const { result } = await cdp.send(
    "Runtime.evaluate",
    {
      expression:
        "document.fonts.ready.then(() => JSON.stringify(document.querySelector('.dg').getBoundingClientRect()))",
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  const box = JSON.parse(result.value);
  const { data } = await cdp.send(
    "Page.captureScreenshot",
    {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.round(box.width), height: Math.ceil(box.height), scale: 1 },
    },
    sessionId,
  );
  writeFileSync(file, Buffer.from(data, "base64"));
  await cdp.send("Target.closeTarget", { targetId });
  console.log(`${file} (${Math.round(box.width)}×${Math.ceil(box.height)})`);
}

const pages = new Map();
const jobs = [];
const all = process.argv.indexOf("--all");
if (all > 0) {
  const dir = process.argv[all + 1];
  if (!dir) throw new Error("--all needs a folder");
  mkdirSync(dir, { recursive: true });
  for (const id of Object.keys(PAGES)) {
    for (const [variant, width] of [
      ["wide", INSPECT_WIDE],
      ["tall", INSPECT_TALL],
    ]) {
      for (const theme of ["dark", "light"]) {
        const path = `/__${id}-${variant}-${theme}.html`;
        pages.set(path, exportPage(id, variant, theme, width));
        jobs.push({ path, width, file: join(dir, `${id}-${variant}-${theme}.png`) });
      }
    }
  }
} else {
  mkdirSync(ASSETS, { recursive: true });
  for (const { id, file } of README) {
    const path = `/__${id}.html`;
    pages.set(path, exportPage(id, "wide", "dark", README_WIDTH));
    jobs.push({ path, width: README_WIDTH, file: join(ASSETS, file) });
  }
}

const server = await serve(pages);
const profile = mkdtempSync(join(tmpdir(), "mitoshi-diagrams-"));
const { chrome, ws } = await launch(profile);
try {
  const cdp = await connect(ws);
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const job of jobs) await shoot(cdp, `${base}${job.path}`, job.width, job.file);
  cdp.socket.close();
} finally {
  // Chrome writes to its profile until it exits, so the profile is removed after that.
  await new Promise((resolve) => {
    chrome.once("exit", resolve);
    chrome.kill();
  });
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
