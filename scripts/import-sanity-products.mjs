// Usage: node scripts/import-sanity-products.mjs > import-products.sql
// Then paste the output into the Supabase SQL Editor. Re-running is safe (upsert by sanity_id).
const projectId = "q1vklck6";
const dataset = "production";
const query = encodeURIComponent(
  `*[_type == "product"]{_id, name, brand, category}`,
);
const url = `https://${projectId}.apicdn.sanity.io/v2023-01-01/data/query/${dataset}?query=${query}`;

const res = await fetch(url);
if (!res.ok) throw new Error(`Sanity request failed: ${res.status}`);
const { result } = await res.json();

const q = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const rows = result
  .filter((p) => p.name)
  .map((p) => `(${q(p._id)}, ${q(p.name)}, ${q(p.brand)}, ${q(p.category)})`);

if (rows.length === 0) throw new Error("No products found");

console.log(
  `insert into public.products (sanity_id, name, brand, category) values\n${rows.join(",\n")}\n` +
    `on conflict (sanity_id) do update set name = excluded.name, brand = excluded.brand, category = excluded.category;`,
);
console.error(`Generated ${rows.length} products`);
