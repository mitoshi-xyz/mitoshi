// Takes the sealed desks straight from the desk-setup console (a developer machine) into public/desks, ready for the
// next deploy, and keeps a copy of them and of every setup wallet's words in a private folder (the words are how the
// money comes back if the browser's storage goes). Listens on 127.0.0.1 only. The desk files are encrypted under the
// key in the judges' link; the words file is written readable by its owner only.
// Usage: node scripts/desk-receiver.mjs <private folder for the copies>
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = 3398;
const HTTP = { ok: 200, noContent: 204, bad: 400, notFound: 404 };
const ORIGINS = new Set(["http://localhost:3300", "http://localhost:3301"]);
const OWNER_ONLY = 0o600;
const [folder] = process.argv.slice(2);
if (!folder) {
  console.error("usage: node scripts/desk-receiver.mjs <private folder for the copies>");
  process.exit(1);
}
await mkdir(folder, { recursive: true });
const out = join(import.meta.dirname, "..", "public", "desks");

async function saveWords(text) {
  const { network, treasury, desks } = JSON.parse(text);
  if (!treasury || !desks) throw new Error("not a words file");
  const path = join(folder, `judge-desk-words-${network}.json`);
  await writeFile(path, text, { mode: OWNER_ONLY });
  return `saved the words of the treasury and ${Object.keys(desks).length} desks (${network}) to ${path}`;
}

async function publish(text) {
  const { index, desks } = JSON.parse(text);
  const numbers = Object.keys(desks).filter((n) => desks[n]);
  if (!index || numbers.length === 0) throw new Error("not a desk file: no index or no desks");
  const copy = join(folder, "mitoshi-desks.json");
  await writeFile(copy, text);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "index.bin"), Buffer.from(index, "base64"));
  for (const n of numbers) await writeFile(join(out, `${n}.bin`), Buffer.from(desks[n], "base64"));
  return `published ${numbers.length} desks to ${out} (copy: ${copy})`;
}

const ROUTES = { "/desks": publish, "/words": saveWords };

createServer((req, res) => {
  const origin = req.headers.origin ?? "";
  if (ORIGINS.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.writeHead(HTTP.noContent).end();
  const route = ROUTES[req.url ?? ""];
  if (req.method !== "POST" || !route || !ORIGINS.has(origin)) return res.writeHead(HTTP.notFound).end();
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    route(Buffer.concat(chunks).toString("utf8")).then(
      (done) => {
        console.log(done);
        res.writeHead(HTTP.ok, { "content-type": "text/plain" }).end("ok");
      },
      (e) => res.writeHead(HTTP.bad, { "content-type": "text/plain" }).end(String(e)),
    );
  });
}).listen(PORT, "127.0.0.1", () => console.log(`desk receiver on http://127.0.0.1:${PORT}/desks`));
