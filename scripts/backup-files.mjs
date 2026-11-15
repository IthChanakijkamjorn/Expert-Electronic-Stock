// Downloads every object in the private "files" bucket into the given folder.
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [outDir] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!outDir || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node backup-files.mjs <outDir>");
  process.exit(1);
}
const bucket = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("files");

async function walk(prefix) {
  const paths = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) paths.push(...(await walk(full)));
      else paths.push(full);
    }
    if (data.length < 1000) break;
  }
  return paths;
}

const files = await walk("");
let bytes = 0;
for (const p of files) {
  const { data, error } = await bucket.download(p);
  if (error) throw new Error(`${p}: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  bytes += buf.length;
  const dest = path.join(outDir, p);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}
console.log(`Backed up ${files.length} files (${(bytes / 1048576).toFixed(1)} MB)`);
