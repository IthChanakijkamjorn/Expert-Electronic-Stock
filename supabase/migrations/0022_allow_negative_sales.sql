-- Tax invoices (type 'sale') may take stock below zero so sales can be recorded before goods are ordered.
-- Receiving or any other positive movement is always allowed, even while stock is negative.
-- All other deductions (issue, transfer out, ...) still cannot go below zero.
create or replace function public.check_stock_not_negative() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_qty bigint;
begin
  if new.location_id is null then
    select id into new.location_id from public.locations where is_default;
  end if;
  if new.quantity >= 0 or new.type = 'sale' then
    return new;
  end if;
  perform 1 from public.products where id = new.product_id for update;
  select coalesce(sum(quantity), 0) into current_qty
    from public.stock_movements
    where product_id = new.product_id and location_id = new.location_id;
  if current_qty + new.quantity < 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
  return new;
end $$;
