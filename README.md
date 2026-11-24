# Expert Electronic Back Office

Private stock-management app (Next.js + Supabase). Thai by default, English available.

## Setup
1. Create a Supabase project and run `supabase/migrations/0001_profiles.sql`, then `0002_products_movements.sql`, `0003_projects.sql`, `0004_product_files_shares.sql`, `0005_admin_delete.sql`, `0006_admin_delete_org_tower.sql` and `0007_card_positions.sql`, in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. Create users in Supabase Auth, then promote the first admin:
   `update public.profiles set role = 'admin' where id = '<user id>';`
3b. Login CAPTCHA (Cloudflare Turnstile): create a Turnstile widget, put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and paste the secret key in Supabase → Authentication → Attack Protection (CAPTCHA). Leave both unset for local dev.
4. `npm install && npm run dev`

## Import existing products (one-off)
`node scripts/import-sanity-products.mjs > import-products.sql`, then paste the file into the Supabase SQL editor. Safe to re-run.

## Products and the website
The back office is the only place products are managed; the website (Sanity) gets a copy.

1. Fill in `<BRAND>_products.xlsx` in the `studio` repo's `import/` folder (copy `import/_TEMPLATE_products.xlsx`; its
   "How to use" sheet explains every column), and put photos/PDFs in `import/images/<Brand>/` and `import/datasheets/<Brand>/`.
2. Push, then Products → Import → Start import. Products, photos and datasheets are added or updated, and every product
   with Website = TRUE (or empty) is pushed to the website; Website = FALSE removes it from the website.

Re-importing is safe: products match on Brand + Model (or Name), and unchanged products are not re-sent, so the website
is only redeployed for real changes. Quantity only sets the opening stock of new products; re-imports ignore it.
The ดาวน์โหลด Excel button (Products and Product list pages, `/export/products`) downloads the same layout
(`src/lib/productSheet.ts`), so an export can be edited and imported back: on Products → Import, use
**อัปโหลดไฟล์ Excel** to pick the edited file directly (no GitHub push). Photos and datasheets named in it are still
taken from `studio/import/`, or can be added on the product page. Editing a product, its photo or its files in the back office also updates the website;
the product page has a Website box for show/hide, featured and which datasheet is public.
Needs `SANITY_WRITE_TOKEN` (Editor token) and migration `0046_website_sync.sql`. Do not edit products in Sanity Studio:
the next import overwrites those changes.

## Backups

`.github/workflows/backup.yml` runs weekly on Saturday 09:00 Thailand time (and on demand from the Actions tab). It dumps the database, downloads the
`files` bucket, encrypts everything with GPG and uploads it to a private Cloudflare R2 bucket, keeping 30 days.

Repository secrets (Settings → Secrets and variables → Actions): `SUPABASE_DB_URL` (session pooler connection string),
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Keep the passphrase somewhere safe: without it a backup cannot be opened.

Restore into a new Supabase project: download the backup from R2, run `npm ci`, then
`BACKUP_PASSPHRASE=... TARGET_DB_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... scripts/restore.sh backup-YYYY-MM-DD.tar.gpg`
(`TARGET_DB_URL` is the new project's session pooler string). Then point the site's Supabase env vars at the new project.
Needs `gpg` and PostgreSQL 17 client tools. Test it on a free scratch project before you need it.
