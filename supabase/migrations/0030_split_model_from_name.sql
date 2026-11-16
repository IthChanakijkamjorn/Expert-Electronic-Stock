-- Best-effort: use the first model-like word (letters + digits, e.g. AM40, EM180-LP) in the name as the model (sku).
-- Names are left unchanged. Products whose guess is already taken are skipped. Fix the rest on the product page.
do $$
declare
  r record;
  tok text;
begin
  for r in select id, name from public.products where coalesce(btrim(sku), '') = '' loop
    select t into tok
    from regexp_split_to_table(r.name, '\s+') with ordinality as x(t, n)
    where t ~ '^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9][A-Za-z0-9./-]*$'
    order by n
    limit 1;
    if tok is not null then
      begin
        update public.products set sku = tok where id = r.id;
      exception when unique_violation then
        null;
      end;
    end if;
  end loop;
end $$;
