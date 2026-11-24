-- The backoffice is the source of truth for products; listed ones are pushed to the website (Sanity).
-- Website-only fields are nullable: null means "not managed here yet", so publishing leaves the website's value alone.
alter table public.products
  add column if not exists on_website boolean not null default false,
  add column if not exists featured boolean,
  add column if not exists at_a_glance text[],
  add column if not exists specifications jsonb,
  add column if not exists website_datasheet_id uuid references public.product_files (id) on delete set null,
  -- {hash, image, datasheet} of the last push, so unchanged products are skipped and files are not re-uploaded.
  add column if not exists website_synced jsonb;

-- Products that came from the website are already listed there.
update public.products set on_website = true where sanity_id is not null;
