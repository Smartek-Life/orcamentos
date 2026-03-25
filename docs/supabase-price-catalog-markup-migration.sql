-- Executar no SQL Editor do Supabase atual
-- Adiciona markup ao catalogo e transforma sale_price em valor calculado

alter table public.price_catalog
add column if not exists markup numeric(12, 4);

update public.price_catalog
set markup = case
  when coalesce(cost, 0) > 0 and coalesce(sale_price, 0) > 0 then round((sale_price / cost)::numeric, 4)
  else coalesce(markup, 0)
end
where markup is null;

alter table public.price_catalog
alter column markup set default 0,
alter column markup set not null;

alter table public.price_catalog
drop column if exists sale_price;

alter table public.price_catalog
add column sale_price numeric(12, 2)
generated always as (round((cost * markup)::numeric, 2)) stored;
