/**
 * Data access layer. Every module talks to the backend through these functions —
 * UI never builds queries inline, so new consumers (services, integrations) can
 * reuse the same contracts.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type Settings = Database["public"]["Tables"]["settings"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type StockMove = Database["public"]["Tables"]["product_stock_history"]["Row"];
export type PriceChange = Database["public"]["Tables"]["product_price_history"]["Row"];

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

/* ---------------------------------- audit --------------------------------- */

export async function logAction(input: {
  action: string;
  entity?: string;
  entityId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", auth.user.id)
    .maybeSingle();
  await supabase.from("audit_logs").insert({
    actor_id: auth.user.id,
    actor_name: profile?.full_name || profile?.username || auth.user.email || null,
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    summary: input.summary ?? null,
    meta: (input.meta ?? null) as never,
  });
}

/* --------------------------------- settings -------------------------------- */

export async function getSettings() {
  return unwrap(await supabase.from("settings").select("*").eq("id", true).single());
}

export async function updateSettings(patch: Partial<Settings>) {
  const row = unwrap(
    await supabase.from("settings").update(patch).eq("id", true).select("*").single(),
  );
  await logAction({ action: "settings.update", entity: "settings", summary: "به‌روزرسانی تنظیمات" });
  return row;
}

/* --------------------------------- products -------------------------------- */

export type ProductFilters = {
  search?: string;
  category?: string;
  carModel?: string;
  stock?: "all" | "critical" | "low" | "ok";
  active?: "all" | "active" | "inactive";
};

export async function listProducts(filters: ProductFilters = {}) {
  let q = supabase.from("products").select("*").order("created_at", { ascending: false });
  if (filters.search) q = q.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  if (filters.category && filters.category !== "all") q = q.eq("category", filters.category);
  if (filters.carModel && filters.carModel !== "all") q = q.contains("car_models", [filters.carModel]);
  if (filters.active === "active") q = q.eq("is_active", true);
  if (filters.active === "inactive") q = q.eq("is_active", false);
  const rows = unwrap(await q);
  if (filters.stock && filters.stock !== "all") {
    return rows.filter((p) => {
      if (filters.stock === "critical") return p.stock <= p.critical_level;
      if (filters.stock === "low") return p.stock > p.critical_level && p.stock <= p.critical_level * 2;
      return p.stock > p.critical_level * 2;
    });
  }
  return rows;
}

export async function getProduct(id: string) {
  return unwrap(await supabase.from("products").select("*").eq("id", id).single());
}

export async function createProduct(input: Database["public"]["Tables"]["products"]["Insert"]) {
  const row = unwrap(await supabase.from("products").insert(input).select("*").single());
  await logAction({
    action: "product.create",
    entity: "product",
    entityId: row.id,
    summary: `ثبت قطعه ${row.name} (${row.code})`,
  });
  if (row.sale_price)
    await supabase.from("product_price_history").insert({
      product_id: row.id,
      price_type: "sale",
      new_price: row.sale_price,
    });
  if (row.purchase_price)
    await supabase.from("product_price_history").insert({
      product_id: row.id,
      price_type: "purchase",
      new_price: row.purchase_price,
    });
  return row;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const before = await getProduct(id);
  const row = unwrap(await supabase.from("products").update(patch).eq("id", id).select("*").single());

  for (const type of ["purchase", "sale"] as const) {
    const key = `${type}_price` as const;
    if (patch[key] !== undefined && patch[key] !== before[key]) {
      await supabase.from("product_price_history").insert({
        product_id: id,
        price_type: type,
        old_price: before[key],
        new_price: row[key],
      });
      await logAction({
        action: "product.price",
        entity: "product",
        entityId: id,
        summary: `تغییر قیمت ${type === "sale" ? "فروش" : "خرید"} ${row.name}`,
        meta: { from: before[key], to: row[key] },
      });
    }
  }

  if (patch.stock !== undefined && patch.stock !== before.stock) {
    await supabase.from("product_stock_history").insert({
      product_id: id,
      change: row.stock - before.stock,
      stock_after: row.stock,
      reason: "manual",
    });
    await logAction({
      action: "product.stock",
      entity: "product",
      entityId: id,
      summary: `اصلاح دستی موجودی ${row.name}`,
      meta: { from: before.stock, to: row.stock },
    });
  }

  await logAction({
    action: "product.update",
    entity: "product",
    entityId: id,
    summary: `ویرایش قطعه ${row.name}`,
  });
  return row;
}

export async function productHistory(id: string) {
  const [prices, stock, items] = await Promise.all([
    supabase
      .from("product_price_history")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_stock_history")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_items")
      .select("*, invoices(number, kind, issued_at, payment_status)")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
  ]);
  return { prices: unwrap(prices), stock: unwrap(stock), items: unwrap(items) };
}

/* ------------------------------ parties (CRM) ------------------------------ */

type PartyTable = "customers" | "suppliers";

export async function listParties(table: PartyTable, search = "", active: "all" | "active" = "all") {
  let q = supabase.from(table).select("*").order("name");
  if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  if (active === "active") q = q.eq("is_active", true);
  return unwrap(await q);
}

export async function getParty(table: PartyTable, id: string) {
  return unwrap(await supabase.from(table).select("*").eq("id", id).single());
}

export async function saveParty(
  table: PartyTable,
  input: { id?: string; name: string; phone?: string | null; address?: string | null; note?: string | null; is_active?: boolean },
) {
  const entity = table === "customers" ? "customer" : "supplier";
  if (input.id) {
    const { id, ...patch } = input;
    const row = unwrap(await supabase.from(table).update(patch).eq("id", id).select("*").single());
    await logAction({ action: `${entity}.update`, entity, entityId: id, summary: `ویرایش ${row.name}` });
    return row;
  }
  const row = unwrap(await supabase.from(table).insert(input).select("*").single());
  await logAction({ action: `${entity}.create`, entity, entityId: row.id, summary: `ثبت ${row.name}` });
  return row;
}

/** Ledger: total invoiced, total paid and outstanding balance for one party. */
export async function partyLedger(table: PartyTable, id: string) {
  const column = table === "customers" ? "customer_id" : "supplier_id";
  const invoices = unwrap(
    await supabase
      .from("invoices")
      .select("*")
      .eq(column, id)
      .eq("is_void", false)
      .order("issued_at", { ascending: false }),
  );
  const totals = invoices.reduce(
    (acc, inv) => {
      const sign = inv.kind === "return" ? -1 : 1;
      acc.total += sign * Number(inv.total);
      acc.paid += sign * Number(inv.paid_amount);
      return acc;
    },
    { total: 0, paid: 0 },
  );
  return { invoices, ...totals, balance: totals.total - totals.paid };
}

/* --------------------------------- invoices -------------------------------- */

export type InvoiceFilters = {
  kind?: "sale" | "purchase";
  includeReturns?: boolean;
  onlyReturns?: boolean;
  search?: string;
  status?: PaymentFilter;
  from?: Date | null;
  to?: Date | null;
};
type PaymentFilter = "all" | "paid" | "unpaid" | "partial" | "returned";

export async function listInvoices(filters: InvoiceFilters = {}) {
  let q = supabase
    .from("invoices")
    .select("*, customers(name), suppliers(name)")
    .order("issued_at", { ascending: false });

  if (filters.onlyReturns) q = q.eq("kind", "return");
  else if (filters.kind)
    q = filters.includeReturns === false
      ? q.eq("kind", filters.kind)
      : q.or(`kind.eq.${filters.kind},and(kind.eq.return,return_kind.eq.${filters.kind})`);

  if (filters.status && filters.status !== "all") q = q.eq("payment_status", filters.status);
  if (filters.from) q = q.gte("issued_at", filters.from.toISOString());
  if (filters.to) q = q.lte("issued_at", filters.to.toISOString());
  if (filters.search) q = q.ilike("number", `%${filters.search}%`);

  const rows = unwrap(q ? await q : q);
  if (!filters.search) return rows;
  const s = filters.search.toLowerCase();
  return rows.filter(
    (r) =>
      r.number.toLowerCase().includes(s) ||
      (r.customers?.name ?? "").toLowerCase().includes(s) ||
      (r.suppliers?.name ?? "").toLowerCase().includes(s),
  );
}

export async function getInvoice(id: string) {
  const invoice = unwrap(
    await supabase
      .from("invoices")
      .select("*, customers(*), suppliers(*)")
      .eq("id", id)
      .single(),
  );
  const [items, payments] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at"),
    supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
  ]);
  return { invoice, items: unwrap(items), payments: unwrap(payments) };
}

export type NewInvoiceInput = {
  kind: "sale" | "purchase" | "return";
  return_kind?: "sale" | "purchase" | null;
  related_invoice_id?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  issued_at?: string;
  payment_status: PaymentStatusValue;
  shipping_cost?: number;
  paid_amount?: number;
  note?: string | null;
  car_model?: string | null;
  plate?: string | null;
  items: {
    product_id?: string | null;
    product_code?: string | null;
    product_name: string;
    unit_price: number;
    quantity: number;
  }[];
};
type PaymentStatusValue = "paid" | "unpaid" | "partial" | "returned";

/** Creates the invoice, moves stock and refreshes purchase prices atomically. */
export async function createInvoice(input: NewInvoiceInput) {
  const { data, error } = await supabase.rpc("create_invoice", {
    payload: input as never,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Invoice;
}

/** Editing an invoice never touches stock — by design. */
export async function updateInvoice(
  id: string,
  patch: Partial<Invoice>,
  items?: { id?: string; product_id?: string | null; product_code?: string | null; product_name: string; unit_price: number; quantity: number }[],
) {
  if (items) {
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (items.length)
      unwrap(
        await supabase
          .from("invoice_items")
          .insert(
            items.map(({ id: _omit, ...rest }) => ({ ...rest, invoice_id: id })),
          )
          .select("id"),
      );
    const itemsTotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    patch = { ...patch, items_total: itemsTotal, total: itemsTotal + Number(patch.shipping_cost ?? 0) };
  }
  const row = unwrap(await supabase.from("invoices").update(patch).eq("id", id).select("*").single());
  await logAction({
    action: "invoice.update",
    entity: "invoice",
    entityId: id,
    summary: `ویرایش فاکتور ${row.number} (بدون اثر روی موجودی)`,
  });
  return row;
}

export async function voidInvoice(id: string) {
  const row = unwrap(
    await supabase.from("invoices").update({ is_void: true }).eq("id", id).select("*").single(),
  );
  await logAction({
    action: "invoice.void",
    entity: "invoice",
    entityId: id,
    summary: `باطل‌کردن فاکتور ${row.number}`,
  });
  return row;
}

export async function addPayment(invoiceId: string, amount: number, note?: string) {
  unwrap(
    await supabase
      .from("payments")
      .insert({ invoice_id: invoiceId, amount, note: note ?? null })
      .select("id")
      .single(),
  );
  const invoice = unwrap(await supabase.from("invoices").select("*").eq("id", invoiceId).single());
  const paid = Number(invoice.paid_amount) + amount;
  const status = paid <= 0 ? "unpaid" : paid >= Number(invoice.total) ? "paid" : "partial";
  const row = unwrap(
    await supabase
      .from("invoices")
      .update({ paid_amount: paid, payment_status: status })
      .eq("id", invoiceId)
      .select("*")
      .single(),
  );
  await logAction({
    action: "payment.create",
    entity: "invoice",
    entityId: invoiceId,
    summary: `ثبت پرداخت برای فاکتور ${row.number}`,
    meta: { amount },
  });
  return row;
}

/* -------------------------------- dashboard -------------------------------- */

export async function dashboardData() {
  const [products, invoices, settings] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true),
    supabase
      .from("invoices")
      .select("*, customers(name), suppliers(name)")
      .eq("is_void", false)
      .order("issued_at", { ascending: false })
      .limit(500),
    getSettings(),
  ]);
  return { products: unwrap(products), invoices: unwrap(invoices), settings };
}

export async function salesItemsSince(since: Date) {
  return unwrap(
    await supabase
      .from("invoice_items")
      .select("product_id, product_name, quantity, line_total, invoices!inner(kind, issued_at, is_void, customer_id, customers(name))")
      .gte("invoices.issued_at", since.toISOString())
      .eq("invoices.kind", "sale")
      .eq("invoices.is_void", false),
  );
}

/* ------------------------------ global search ------------------------------ */

export async function globalSearch(term: string) {
  if (term.trim().length < 2) return { products: [], customers: [], suppliers: [], invoices: [] };
  const like = `%${term}%`;
  const [products, customers, suppliers, invoices] = await Promise.all([
    supabase.from("products").select("id, code, name, stock, sale_price").or(`name.ilike.${like},code.ilike.${like}`).limit(6),
    supabase.from("customers").select("id, name, phone").ilike("name", like).limit(5),
    supabase.from("suppliers").select("id, name, phone").ilike("name", like).limit(5),
    supabase.from("invoices").select("id, number, kind, total, issued_at").ilike("number", like).limit(5),
  ]);
  return {
    products: unwrap(products),
    customers: unwrap(customers),
    suppliers: unwrap(suppliers),
    invoices: unwrap(invoices),
  };
}

/* ---------------------------------- admins --------------------------------- */

export async function listAdmins() {
  return unwrap(await supabase.from("profiles").select("*").order("created_at"));
}

export async function listAuditLogs(filters: {
  actor?: string;
  action?: string;
  from?: Date | null;
  to?: Date | null;
}) {
  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  if (filters.actor && filters.actor !== "all") q = q.eq("actor_id", filters.actor);
  if (filters.action && filters.action !== "all") q = q.eq("action", filters.action);
  if (filters.from) q = q.gte("created_at", filters.from.toISOString());
  if (filters.to) q = q.lte("created_at", filters.to.toISOString());
  return unwrap(await q);
}
