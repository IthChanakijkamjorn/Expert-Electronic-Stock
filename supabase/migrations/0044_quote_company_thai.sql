-- Drop the saved English quotation heading so new quotations use the Thai default.
delete from public.company_defaults where kind = 'quote';
