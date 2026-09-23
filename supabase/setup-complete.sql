-- ============================================
-- پنل مدیریت قطعات احمدی — Setup کامل دیتابیس
-- اجرا کنید در: Supabase Dashboard → SQL Editor
-- ============================================

-- ===== 1. Roles =====
create type public.app_role as enum ('admin');

-- ===== 2. Profiles & Auth =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles readable by authenticated" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== 3. Sequences =====
create sequence public.product_code_seq start 1001;
create sequence public.sale_invoice_seq start 1001;
create sequence public.purchase_invoice_seq start 1001;
create sequence public.return_invoice_seq start 1001;

-- ===== 4. Products =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  purchase_price bigint not null default 0,
  sale_price bigint not null default 0,
  stock integer not null default 0,
  unit text not null default 'عدد',
  critical_level integer not null default 5,
  car_models text[] not null default '{}',
  image_url text,
  note text,
  is_active boolean not null default true,
  last_sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index products_code_idx on public.products (code);
create index products_active_idx on public.products (is_active);
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products admin all" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create or replace function public.set_product_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'PRD-' || nextval('public.product_code_seq');
  end if;
  return new;
end; $$;
create trigger products_code before insert on public.products for each row execute function public.set_product_code();

-- ===== 5. Price & Stock History =====
create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price_type text not null check (price_type in ('purchase','sale')),
  old_price bigint,
  new_price bigint not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index pph_product_idx on public.product_price_history (product_id, created_at desc);
grant select, insert on public.product_price_history to authenticated;
grant all on public.product_price_history to service_role;
alter table public.product_price_history enable row level security;
create policy "pph admin all" on public.product_price_history for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.product_stock_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change integer not null,
  stock_after integer not null,
  reason text not null,
  invoice_id uuid,
  invoice_number text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index psh_product_idx on public.product_stock_history (product_id, created_at desc);
grant select, insert on public.product_stock_history to authenticated;
grant all on public.product_stock_history to service_role;
alter table public.product_stock_history enable row level security;
create policy "psh admin all" on public.product_stock_history for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== 6. Customers & Suppliers =====
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_idx on public.customers (name);
grant select, insert, update on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "customers admin all" on public.customers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_name_idx on public.suppliers (name);
grant select, insert, update on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "suppliers admin all" on public.suppliers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_updated_at();

-- ===== 7. Invoices =====
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  kind text not null check (kind in ('sale','purchase','return')),
  return_kind text check (return_kind in ('sale','purchase')),
  related_invoice_id uuid references public.invoices(id),
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  issued_at timestamptz not null default now(),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','unpaid','partial','returned')),
  shipping_cost bigint not null default 0,
  items_total bigint not null default 0,
  total bigint not null default 0,
  paid_amount bigint not null default 0,
  note text,
  car_model text,
  plate text,
  is_void boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_kind_idx on public.invoices (kind, issued_at desc);
create index invoices_number_idx on public.invoices (number);
create index invoices_status_idx on public.invoices (payment_status);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_supplier_idx on public.invoices (supplier_id);
grant select, insert, update on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "invoices admin all" on public.invoices for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id),
  product_code text,
  product_name text not null,
  unit_price bigint not null default 0,
  quantity integer not null default 1,
  line_total bigint generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index invoice_items_product_idx on public.invoice_items (product_id);
grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;
alter table public.invoice_items enable row level security;
create policy "invoice_items admin all" on public.invoice_items for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== 8. Payments =====
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount bigint not null,
  paid_at timestamptz not null default now(),
  method text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index payments_invoice_idx on public.payments (invoice_id, paid_at desc);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments admin all" on public.payments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ===== 9. Audit Logs =====
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_name text,
  action text not null,
  entity text,
  entity_id text,
  summary text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs (created_at desc);
create index audit_actor_idx on public.audit_logs (actor_id);
create index audit_action_idx on public.audit_logs (action);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "audit admin insert" on public.audit_logs for insert to authenticated with check (public.has_role(auth.uid(),'admin'));

-- ===== 10. Settings =====
create table public.settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'احمدی',
  brand_phone text,
  brand_address text,
  brand_logo_url text,
  default_critical_level integer not null default 5,
  invoice_fields jsonb not null default '{"note":true,"car_model":true,"plate":true,"qr":true,"shipping":true}'::jsonb,
  idle_lock_minutes integer not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "settings admin all" on public.settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.settings (id) values (true);

-- ===== 11. Invoice Creation Function (Atomic) =====
create or replace function public.create_invoice(payload jsonb)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kind text := payload->>'kind';
  v_return_kind text := nullif(payload->>'return_kind','');
  v_number text;
  v_invoice public.invoices;
  v_item jsonb;
  v_items_total bigint := 0;
  v_shipping bigint := coalesce((payload->>'shipping_cost')::bigint, 0);
  v_paid bigint := coalesce((payload->>'paid_amount')::bigint, 0);
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_stock_delta integer;
  v_new_stock integer;
  v_old_purchase bigint;
begin
  if v_actor is null or not public.has_role(v_actor,'admin') then
    raise exception 'دسترسی مجاز نیست';
  end if;

  select coalesce(nullif(full_name,''), username) into v_actor_name from public.profiles where id = v_actor;

  if v_kind = 'sale' then
    v_number := 'S-' || nextval('public.sale_invoice_seq');
  elsif v_kind = 'purchase' then
    v_number := 'P-' || nextval('public.purchase_invoice_seq');
  elsif v_kind = 'return' then
    v_number := 'R-' || nextval('public.return_invoice_seq');
  else
    raise exception 'نوع فاکتور نامعتبر است';
  end if;

  insert into public.invoices (
    number, kind, return_kind, related_invoice_id, customer_id, supplier_id,
    issued_at, payment_status, shipping_cost, note, car_model, plate, created_by
  ) values (
    v_number, v_kind, v_return_kind,
    nullif(payload->>'related_invoice_id','')::uuid,
    nullif(payload->>'customer_id','')::uuid,
    nullif(payload->>'supplier_id','')::uuid,
    coalesce(nullif(payload->>'issued_at','')::timestamptz, now()),
    coalesce(nullif(payload->>'payment_status',''), 'unpaid'),
    v_shipping,
    nullif(payload->>'note',''),
    nullif(payload->>'car_model',''),
    nullif(payload->>'plate',''),
    v_actor
  ) returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb))
  loop
    insert into public.invoice_items (invoice_id, product_id, product_code, product_name, unit_price, quantity)
    values (
      v_invoice.id,
      nullif(v_item->>'product_id','')::uuid,
      nullif(v_item->>'product_code',''),
      coalesce(v_item->>'product_name','—'),
      coalesce((v_item->>'unit_price')::bigint, 0),
      coalesce((v_item->>'quantity')::integer, 1)
    );

    v_items_total := v_items_total + coalesce((v_item->>'unit_price')::bigint,0) * coalesce((v_item->>'quantity')::integer,1);

    if nullif(v_item->>'product_id','') is not null then
      v_stock_delta := case
        when v_kind = 'sale' then -coalesce((v_item->>'quantity')::integer,1)
        when v_kind = 'purchase' then coalesce((v_item->>'quantity')::integer,1)
        when v_kind = 'return' and v_return_kind = 'sale' then coalesce((v_item->>'quantity')::integer,1)
        when v_kind = 'return' and v_return_kind = 'purchase' then -coalesce((v_item->>'quantity')::integer,1)
        else 0 end;

      update public.products
        set stock = stock + v_stock_delta,
            last_sold_at = case when v_kind = 'sale' then now() else last_sold_at end
        where id = (v_item->>'product_id')::uuid
        returning stock, purchase_price into v_new_stock, v_old_purchase;

      insert into public.product_stock_history (product_id, change, stock_after, reason, invoice_id, invoice_number, created_by)
      values ((v_item->>'product_id')::uuid, v_stock_delta, coalesce(v_new_stock,0),
              case when v_kind='return' then 'return_' || coalesce(v_return_kind,'') else v_kind end,
              v_invoice.id, v_invoice.number, v_actor);

      if v_kind = 'purchase' and coalesce((v_item->>'unit_price')::bigint,0) > 0
         and coalesce(v_old_purchase,0) <> (v_item->>'unit_price')::bigint then
        insert into public.product_price_history (product_id, price_type, old_price, new_price, changed_by)
        values ((v_item->>'product_id')::uuid, 'purchase', v_old_purchase, (v_item->>'unit_price')::bigint, v_actor);
        update public.products set purchase_price = (v_item->>'unit_price')::bigint
          where id = (v_item->>'product_id')::uuid;
      end if;
    end if;
  end loop;

  update public.invoices
     set items_total = v_items_total,
         total = v_items_total + v_shipping,
         paid_amount = least(v_paid, v_items_total + v_shipping)
   where id = v_invoice.id
   returning * into v_invoice;

  if v_paid > 0 then
    insert into public.payments (invoice_id, amount, created_by, note)
    values (v_invoice.id, least(v_paid, v_invoice.total), v_actor, 'پرداخت هنگام ثبت فاکتور');
  end if;

  insert into public.audit_logs (actor_id, actor_name, action, entity, entity_id, summary, meta)
  values (v_actor, v_actor_name, 'invoice.create', 'invoice', v_invoice.id::text,
          'ثبت فاکتور ' || v_invoice.number, jsonb_build_object('kind', v_kind, 'total', v_invoice.total));

  return v_invoice;
end; $$;
grant execute on function public.create_invoice(jsonb) to authenticated;

-- ===== 12. Permission Refinements =====
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.set_product_code() from public, anon, authenticated;
revoke all on function public.create_invoice(jsonb) from public, anon;
grant execute on function public.create_invoice(jsonb) to authenticated;

-- ===== 13. Auto product codes =====
ALTER TABLE public.products
  ALTER COLUMN code SET DEFAULT ('PRD-' || nextval('public.product_code_seq')::text);
