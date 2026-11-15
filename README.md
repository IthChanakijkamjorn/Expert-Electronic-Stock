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

## Backups

`.github/workflows/backup.yml` runs daily (and on demand from the Actions tab). It dumps the database, downloads the
`files` bucket, encrypts everything with GPG and uploads it to a private Cloudflare R2 bucket, keeping 30 days.

Repository secrets (Settings → Secrets and variables → Actions): `SUPABASE_DB_URL` (session pooler connection string),
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Keep the passphrase somewhere safe: without it a backup cannot be opened.

Restore: `gpg -d backup-YYYY-MM-DD.tar.gpg | tar -x`, then `pg_restore` the `database.dump` into a database.
