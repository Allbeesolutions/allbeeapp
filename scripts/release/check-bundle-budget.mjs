import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
const dir = "dist/assets";
const files = await readdir(dir);
const limits = { main: 525 * 1024, totalJs: 2.5 * 1024 * 1024 };
let main = 0, totalJs = 0, mainFile = "";
for (const file of files) {
  if (!file.endsWith(".js")) continue;
  const bytes = (await stat(join(dir, file))).size;
  totalJs += bytes;
  if (/^index-[^.]+\.js$/.test(file)) { main = bytes; mainFile = file; }
}
const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
console.log(`[bundle] main ${mainFile}: ${kb(main)} / ${kb(limits.main)}`);
console.log(`[bundle] total JS: ${kb(totalJs)} / ${kb(limits.totalJs)}`);
if (!main || main > limits.main || totalJs > limits.totalJs) {
  console.error("Bundle performance budget exceeded. Split or lazy-load new code before release.");
  process.exit(1);
}
