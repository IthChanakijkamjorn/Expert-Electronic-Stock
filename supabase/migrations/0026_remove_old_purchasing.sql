-- Removes the old purchase order PO-00001 and the "ITC" supplier (lines go with the order).
-- Stock already received stays: movements only keep the text comment "PO PO-00001".
delete from public.purchase_orders;
delete from public.suppliers;
