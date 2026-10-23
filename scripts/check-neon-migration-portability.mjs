import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../database/neon/', import.meta.url));
const files = readdirSync(directory)
  .filter((name) => /^\d{3}_.+\.sql$/.test(name))
  .sort();

if (files.length === 0) throw new Error('No executable Neon migrations found');

const forbidden = [
  /\bauth\.(?:uid|users|jwt|role)\b/i,
  /\bsupabase_realtime\b/i,
  /\bstorage\.(?:objects|buckets)\b/i,
  /\banon\b/i,
];

const failures = [];
files.forEach((file, index) => {
  const expected = String(index + 1).padStart(3, '0');
  if (!file.startsWith(`${expected}_`)) failures.push(`${file}: expected sequence ${expected}`);
  const source = readFileSync(join(directory, file), 'utf8');
  const sql = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');
  if (!/\binsert\s+into\s+allbee_platform\.schema_migrations\b/i.test(sql)) {
    failures.push(`${file}: no migration-registry write`);
  }
  for (const pattern of forbidden) {
    if (pattern.test(sql)) failures.push(`${file}: Supabase-only reference ${pattern}`);
  }
});

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS ${files.length} ordered Neon migrations: registry and portability checks`);
}
