// Takes the sealed desks straight from the desk-setup console (a developer machine) into public/desks, ready for the
// next deploy, and keeps the console's file as a copy. Listens on 127.0.0.1 only. The files are encrypted under the
// key in the judges' link; nothing here can open them.
// Usage: node scripts/desk-receiver.mjs <copy path for mitoshi-desks.json>
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = 3398;
const HTTP = { ok: 200, noContent: 204, bad: 400, notFound: 404 };
const ORIGINS = new Set(["http://localhost:3300", "http://localhost:3301"]);
const [copy] = process.argv.slice(2);
if (!copy) {
  console.error("usage: node scripts/desk-receiver.mjs <copy path for mitoshi-desks.json>");
  process.exit(1);
}
const out = join(import.meta.dirname, "..", "public", "desks");

async function publish(text) {
  const { index, desks } = JSON.parse(text);
  const numbers = Object.keys(desks).filter((n) => desks[n]);
  if (!index || numbers.length === 0) throw new Error("not a desk file: no index or no desks");
  await writeFile(copy, text);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "index.bin"), Buffer.from(index, "base64"));
  for (const n of numbers) await writeFile(join(out, `${n}.bin`), Buffer.from(desks[n], "base64"));
  return numbers.length;
}

createServer((req, res) => {
  const origin = req.headers.origin ?? "";
  if (ORIGINS.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.writeHead(HTTP.noContent).end();
  if (req.method !== "POST" || req.url !== "/desks" || !ORIGINS.has(origin)) return res.writeHead(HTTP.notFound).end();
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    publish(Buffer.concat(chunks).toString("utf8")).then(
      (n) => {
        console.log(`published ${n} desks to ${out} (copy: ${copy})`);
        res.writeHead(HTTP.ok, { "content-type": "text/plain" }).end(`published ${n} desks`);
      },
      (e) => res.writeHead(HTTP.bad, { "content-type": "text/plain" }).end(String(e)),
    );
  });
}).listen(PORT, "127.0.0.1", () => console.log(`desk receiver on http://127.0.0.1:${PORT}/desks`));
