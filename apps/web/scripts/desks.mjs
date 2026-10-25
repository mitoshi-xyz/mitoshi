// Publishes the judges' desks: splits the console's download (mitoshi-desks.json) into the static files the desk gate
// reads, public/desks/index.bin and public/desks/1.bin…6.bin. They are encrypted under the key in the judges' link,
// are not kept in git, and ship with the next deploy.
// Usage: node scripts/desks.mjs <path to mitoshi-desks.json>
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [source] = process.argv.slice(2);
if (!source) {
  console.error("usage: node scripts/desks.mjs <mitoshi-desks.json>");
  process.exit(1);
}
const out = join(import.meta.dirname, "..", "public", "desks");
const { index, desks } = JSON.parse(await readFile(source, "utf8"));
const numbers = Object.keys(desks).filter((n) => desks[n]);
if (!index || numbers.length === 0) throw new Error("not a desk file: no index or no desks");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(join(out, "index.bin"), Buffer.from(index, "base64"));
for (const n of numbers) await writeFile(join(out, `${n}.bin`), Buffer.from(desks[n], "base64"));
console.log(`wrote index.bin and ${numbers.length} desks to ${out}`);
