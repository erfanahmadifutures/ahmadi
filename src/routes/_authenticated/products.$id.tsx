import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Save } from "lucide-react";
import { getProduct, productHistory, updateProduct } from "@/lib/api";
import { fmtJalali, fmtMoney, fmtNum, parseNum } from "@/lib/format";
import {
  CAR_MODELS,
  CATEGORIES,
  STOCK_LEVEL_LABEL,
  STOCK_LEVEL_TONE,
  STOCK_REASON_LABEL,
  UNITS,
  stockLevel,
} from "@/lib/domain";
import { Empty, GhostButton, Panel, Pill, PrimaryButton, Stat } from "@/components/panel";
import { Field, Select } from "./products.index";

export const Route = createFileRoute("/_authenticated/products/$id")({
  head: () => ({
    meta: [
      { title: "جزئیات قطعه — احمدی" },
      { name: "description", content: "قیمت، موجودی، تاریخچه قیمت و گردش موجودی یک قطعه." },
      { property: "og:title", content: "جزئیات قطعه — احمدی" },
      { property: "og:description", content: "تاریخچه قیمت و گردش موجودی قطعه در انبار احمدی." },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => getProduct(id) });
  const { data: history } = useQuery({
    queryKey: ["product-history", id],
    queryFn: () => productHistory(id),
  });

  const [form, setForm] = useState({
    name: "",
    category: "",
    purchase_price: "",
    sale_price: "",
    stock: "",
    unit: UNITS[0] as string,
    critical_level: "",
    note: "",
    car_models: [] as string[],
    is_active: true,
  });

  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name,
      category: product.category ?? "",
      purchase_price: String(product.purchase_price),
      sale_price: String(product.sale_price),
      stock: String(product.stock),
      unit: product.unit,
      critical_level: String(product.critical_level),
      note: product.note ?? "",
      car_models: product.car_models ?? [],
      is_active: product.is_active,
    });
  }, [product]);

  const save = useMutation({
    mutationFn: () =>
      updateProduct(id, {
        name: form.name.trim(),
        category: form.category || null,
        purchase_price: parseNum(form.purchase_price),
        sale_price: parseNum(form.sale_price),
        stock: parseNum(form.stock),
        unit: form.unit,
        critical_level: parseNum(form.critical_level),
        note: form.note || null,
        car_models: form.car_models,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      toast.success("تغییرات ذخیره شد");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!product) return <Panel bodyClassName="p-6"><Empty>در حال بارگذاری…</Empty></Panel>;
  const level = stockLevel(product.stock, product.critical_level);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/products" className="text-ice-dim hover:text-foreground">
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{product.name}</h1>
          <p className="num mt-1 text-xs text-ice-faint">کد داخلی {product.code}</p>
        </div>
        <Pill className={`ms-2 ${STOCK_LEVEL_TONE[level]}`}>{STOCK_LEVEL_LABEL[level]}</Pill>
        <PrimaryButton className="ms-auto" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4" /> ذخیره تغییرات
        </PrimaryButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="قیمت فروش (تومان)" value={fmtMoney(product.sale_price)} tone="primary" />
        <Stat label="قیمت خرید (تومان)" value={fmtMoney(product.purchase_price)} />
        <Stat label="موجودی" value={`${fmtNum(product.stock)} ${product.unit}`} />
        <Stat label="حد بحرانی" value={fmtNum(product.critical_level)} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="ویرایش قطعه" bodyClassName="space-y-3 p-4">
          <Field label="نام قطعه">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field h-10 w-full px-3 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="دسته‌بندی">
              <Select
                className="h-10 w-full text-sm"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={[["", "بدون دسته"], ...CATEGORIES.map((c) => [c, c] as [string, string])]}
              />
            </Field>
            <Field label="واحد شمارش">
              <Select
                className="h-10 w-full text-sm"
                value={form.unit}
                onChange={(v) => setForm({ ...form, unit: v })}
                options={UNITS.map((u) => [u, u] as [string, string])}
              />
            </Field>
            <Field label="قیمت خرید (تومان)">
              <input
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
            <Field label="قیمت فروش (تومان)">
              <input
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
            <Field label="موجودی (اصلاح دستی)">
              <input
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
            <Field label="حد بحرانی">
              <input
                value={form.critical_level}
                onChange={(e) => setForm({ ...form, critical_level: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
          </div>

          <Field label="مدل خودرو">
            <div className="flex flex-wrap gap-2">
              {CAR_MODELS.map((m) => {
                const on = form.car_models.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setForm({
                        ...form,
                        car_models: on
                          ? form.car_models.filter((x) => x !== m)
                          : [...form.car_models, m],
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-xs ring-1 ${
                      on ? "bg-primary/15 text-primary ring-ring" : "bg-surface-2/60 text-ice-dim ring-border"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="یادداشت">
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className="field w-full px-3 py-2 text-sm"
            />
          </Field>

          <GhostButton onClick={() => setForm({ ...form, is_active: !form.is_active })}>
            {form.is_active ? "غیرفعال‌کردن قطعه" : "فعال‌کردن قطعه"}
          </GhostButton>
          <p className="text-[11px] text-ice-faint">
            تغییر قیمت فقط روی فاکتورهای بعدی اثر می‌گذارد؛ فاکتورهای قبلی دست‌نخورده می‌مانند.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="تاریخچه قیمت" bodyClassName="max-h-56 overflow-auto">
            {(history?.prices ?? []).length === 0 ? (
              <Empty>تغییر قیمتی ثبت نشده است</Empty>
            ) : (
              (history?.prices ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs last:border-0"
                >
                  <span className="text-ice-dim">
                    {p.price_type === "sale" ? "فروش" : "خرید"}
                  </span>
                  <span className="num">
                    {p.old_price !== null ? `${fmtMoney(p.old_price)} ← ` : ""}
                    {fmtMoney(p.new_price)} تومان
                  </span>
                  <span className="num ms-auto text-ice-faint">{fmtJalali(p.created_at)}</span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="گردش موجودی" bodyClassName="max-h-56 overflow-auto">
            {(history?.stock ?? []).length === 0 ? (
              <Empty>گردشی ثبت نشده است</Empty>
            ) : (
              (history?.stock ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs last:border-0"
                >
                  <span className="text-ice-dim">{STOCK_REASON_LABEL[s.reason] ?? s.reason}</span>
                  <span className={`num ${s.change > 0 ? "text-primary" : "text-destructive"}`}>
                    {s.change > 0 ? "+" : "−"}
                    {fmtNum(Math.abs(s.change))}
                  </span>
                  <span className="num text-ice-dim">مانده {fmtNum(s.stock_after)}</span>
                  <span className="num ms-auto text-ice-faint">{fmtJalali(s.created_at)}</span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="فاکتورهای مرتبط" bodyClassName="max-h-56 overflow-auto">
            {(history?.items ?? []).length === 0 ? (
              <Empty>این قطعه در فاکتوری استفاده نشده است</Empty>
            ) : (
              (history?.items ?? []).map((it) => (
                <Link
                  key={it.id}
                  to="/invoices/$id"
                  params={{ id: it.invoice_id }}
                  className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs last:border-0 hover:bg-accent"
                >
                  <span className="num text-ice-faint">{it.invoices?.number}</span>
                  <span className="num">
                    {fmtNum(it.quantity)} × {fmtMoney(it.unit_price)}
                  </span>
                  <span className="num ms-auto text-ice-faint">
                    {fmtJalali(it.invoices?.issued_at, false)}
                  </span>
                </Link>
              ))
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
