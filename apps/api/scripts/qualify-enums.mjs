// drizzle-kit occasionally emits an `app` enum column type without its schema prefix
// (e.g. `"status" timetable_version_status`), which fails because `app` is not on the search_path.
// This post-generate step qualifies such column types in every migration. It is idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const enums = new Set();
for (const f of files) {
  for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/CREATE TYPE "app"\."(\w+)"/g)) enums.add(m[1]);
}
let changed = 0;
for (const f of files) {
  const file = path.join(dir, f);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/^(\s*"\w+" )(\w+)(?=[\s,[])/gm, (all, prefix, type) => (enums.has(type) ? `${prefix}"app"."${type}"` : all));
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log(`qualified enum types in ${f}`);
  }
}
if (!changed) console.log('enum types already qualified');
