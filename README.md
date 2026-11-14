# Expert Electronic Back Office

Private stock-management app (Next.js + Supabase). Thai by default, English available.

## Setup
1. Create a Supabase project and run `supabase/migrations/0001_profiles.sql`, then `0002_products_movements.sql`, `0003_projects.sql`, `0004_product_files_shares.sql`, `0005_admin_delete.sql`, `0006_admin_delete_org_tower.sql` and `0007_card_positions.sql`, in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. Create users in Supabase Auth, then promote the first admin:
   `update public.profiles set role = 'admin' where id = '<user id>';`
4. `npm install && npm run dev`

## Import existing products (one-off)
`node scripts/import-sanity-products.mjs > import-products.sql`, then paste the file into the Supabase SQL editor. Safe to re-run.
