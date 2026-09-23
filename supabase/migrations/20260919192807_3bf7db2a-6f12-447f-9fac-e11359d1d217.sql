-- Auto-generate internal part codes (PRD-1001, PRD-1002, ...) on insert
ALTER TABLE public.products
  ALTER COLUMN code SET DEFAULT ('PRD-' || nextval('public.product_code_seq')::text);