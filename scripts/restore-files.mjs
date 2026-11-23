// Uploads every file in the given folder into the private "files" bucket (creating it if needed).
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const [srcDir] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!srcDir || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node restore-files.mjs <srcDir>");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { error: bucketError } = await supabase.storage.createBucket("files", { public: false });
if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(srcDir);
let done = 0;
for (const file of files) {
  const key = path.relative(srcDir, file).split(path.sep).join("/");
  const { error } = await supabase.storage.from("files").upload(key, await readFile(file), { upsert: true });
  if (error) throw new Error(`${key}: ${error.message}`);
  done++;
}
console.log(`Restored ${done} files`);
