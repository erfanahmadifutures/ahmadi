import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Download, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { createProduct, getSettings, listProducts, type ProductFilters } from "@/lib/api";
import { fmtMoney, fmtNum, parseNum } from "@/lib/format";
import {
  CAR_MODELS,
  CATEGORIES,
  STOCK_LEVEL_LABEL,
  STOCK_LEVEL_TONE,
  UNITS,
  stockLevel,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/exports";
import { Empty, GhostButton, Panel, Pill, PrimaryButton } from "@/components/panel";

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({
    meta: [
      { title: "قطعات و انبار — احمدی" },
      { name: "description", content: "فهرست قطعات میتسوبیشی با کد داخلی، قیمت، موجودی و مدل خودرو." },
      { property: "og:title", content: "قطعات و انبار — احمدی" },
      { property: "og:description", content: "مدیریت قطعات، قیمت‌ها و موجودی انبار احمدی." },
    ],
  }),
  component: ProductsPage,
});

type Filters = Required<ProductFilters>;

function ProductsPage() {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    category: "all",
    carModel: "all",
    stock: "all",
    active: "all",
  });
  const [open, setOpen] = useState(false);
  const { data: products } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => listProducts(filters),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">قطعات</h1>
          <p className="mt-1 text-xs text-ice-dim">
            {fmtNum(products?.length ?? 0)} قطعه بر اساس فیلترهای فعلی
          </p>
        </div>
        <div className="ms-auto flex gap-2">
          <GhostButton
            onClick={() =>
              downloadCsv(
                "products",
                ["کد", "نام", "دسته", "قیمت خرید", "قیمت فروش", "موجودی", "واحد", "حد بحرانی", "وضعیت"],
                (products ?? []).map((p) => [
                  p.code,
                  p.name,
                  p.category ?? "",
                  p.purchase_price,
                  p.sale_price,
                  p.stock,
                  p.unit,
                  p.critical_level,
                  p.is_active ? "فعال" : "غیرفعال",
                ]),
              )
            }
          >
            <Download className="size-3.5" /> خروجی Excel
          </GhostButton>
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="size-4" /> قطعه جدید
          </PrimaryButton>
        </div>
      </div>

      <Panel bodyClassName="flex flex-wrap gap-2 p-3">
        <div className="field flex h-9 min-w-48 flex-1 items-center gap-2 px-3">
          <Search className="size-3.5 text-ice-faint" />
          <input
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="نام یا کد قطعه"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ice-faint"
          />
        </div>
        <Select
          value={filters.category!}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          options={[["all", "همه دسته‌ها"], ...CATEGORIES.map((c) => [c, c] as [string, string])]}
        />
        <Select
          value={filters.carModel!}
          onChange={(v) => setFilters((f) => ({ ...f, carModel: v }))}
          options={[["all", "همه مدل‌ها"], ...CAR_MODELS.map((c) => [c, c] as [string, string])]}
        />
        <Select
          value={filters.stock!}
          onChange={(v) => setFilters((f) => ({ ...f, stock: v as Filters["stock"] }))}
          options={[
            ["all", "همه موجودی‌ها"],
            ["critical", "بحرانی"],
            ["low", "کم"],
            ["ok", "کافی"],
          ]}
        />
        <Select
          value={filters.active!}
          onChange={(v) => setFilters((f) => ({ ...f, active: v as Filters["active"] }))}
          options={[
            ["all", "فعال و غیرفعال"],
            ["active", "فقط فعال"],
            ["inactive", "فقط غیرفعال"],
          ]}
        />
      </Panel>

      <Panel bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-[11px] text-ice-faint">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">کد</th>
              <th className="px-4 py-2.5 text-start font-medium">نام قطعه</th>
              <th className="px-4 py-2.5 text-start font-medium">دسته</th>
              <th className="px-4 py-2.5 text-start font-medium">مدل خودرو</th>
              <th className="px-4 py-2.5 text-start font-medium">خرید</th>
              <th className="px-4 py-2.5 text-start font-medium">فروش</th>
              <th className="px-4 py-2.5 text-start font-medium">موجودی</th>
              <th className="px-4 py-2.5 text-start font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const level = stockLevel(p.stock, p.critical_level);
              return (
                <tr key={p.id} className="border-t border-border hover:bg-accent/60">
                  <td className="num px-4 py-2.5 text-[11px] text-ice-faint">{p.code}</td>
                  <td className="px-4 py-2.5 font-medium">
                    <Link to="/products/$id" params={{ id: p.id }} className="hover:text-primary">
                      {p.name}
                    </Link>
                    {!p.is_active && <span className="ms-2 text-[10px] text-ice-faint">غیرفعال</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ice-dim">{p.category ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(p.car_models ?? []).map((m) => (
                        <Pill key={m} className="bg-foreground/[0.05] text-ice-dim ring-border">
                          {m}
                        </Pill>
                      ))}
                    </div>
                  </td>
                  <td className="num px-4 py-2.5 text-xs text-ice-dim">{fmtMoney(p.purchase_price)}</td>
                  <td className="num px-4 py-2.5 font-semibold">{fmtMoney(p.sale_price)}</td>
                  <td className="num px-4 py-2.5">
                    {fmtNum(p.stock)} {p.unit}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill className={STOCK_LEVEL_TONE[level]}>{STOCK_LEVEL_LABEL[level]}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products && products.length === 0 && <Empty>قطعه‌ای با این فیلترها پیدا نشد</Empty>}
      </Panel>

      {open && <NewProductPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const label = options.find(([v]) => v === value)?.[1] ?? "";

  return (
    <div className={cn("relative", className ?? "")}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="field h-9 w-full px-3 text-xs text-ice-dim flex items-center justify-between text-right"
      >
        <span className="truncate text-right">{label}</span>
        <ChevronDown className="ms-auto size-3.5 shrink-0 text-ice-faint" />
      </button>
      {open && <SelectDropdown btnRef={btnRef} value={value} options={options} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SelectDropdown({
  btnRef,
  value,
  options,
  onChange,
  onClose,
}: {
  btnRef: React.RefObject<HTMLButtonElement>;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!btnRef.current) return;

    // Create portal container at body level
    const container = document.createElement("div");
    container.className = "select-portal";
    document.body.appendChild(container);
    containerRef.current = container;

    const r = btnRef.current.getBoundingClientRect();
    const maxHeight = 260;
    const spaceBelow = window.innerHeight - r.bottom;
    const topStyle = spaceBelow < maxHeight + 16 ? r.top - maxHeight - 8 : r.bottom + 6;

    container.style.position = "fixed";
    container.style.zIndex = "100";
    container.style.top = topStyle + "px";
    container.style.left = r.left + "px";
    container.style.width = r.width + "px";
    container.style.pointerEvents = "auto";

    const optionsHTML = options
      .map(
        ([v, l]) => `
      <div class="select-option" data-val="${v}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;font-size:12px;text-align:left;cursor:pointer;transition:background 0.15s;${
        v === value
          ? "background:color-mix(in oklab,var(--color-primary) 15%,transparent);color:var(--color-primary);font-weight:600;"
          : "color:var(--color-ice-dim);"
      }">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${l}</span>
        ${
          v === value
            ? '<svg style="flex-shrink:0;width:14px;height:14px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>'
            : ""
        }
      </div>
    `
      )
      .join("");

    container.innerHTML = `<div style="background-color:color-mix(in oklab,var(--color-surface) 94%,transparent);box-shadow:inset 0 0 0 1px var(--color-border);backdrop-filter:blur(24px);border-radius:var(--radius-xl);overflow:auto;max-height:260px;padding:4px 0;">${optionsHTML}</div>`;

    // Click handlers
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const option = target.closest("[data-val]");
      if (option) {
        const val = (option as HTMLElement).dataset.val ?? "";
        onChange(val);
        onClose();
      }
    });

    // Close on outside click (capture)
    const onDocClick = (e: MouseEvent) => {
      if (container.contains(e.target as Node) || (btnRef.current && btnRef.current.contains(e.target as Node))) {
        return;
      }
      onClose();
    };
    document.addEventListener("click", onDocClick, true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey);
      container.remove();
      containerRef.current = null;
    };
  }, [btnRef, value, options, onChange, onClose]);

  return null;
}

function NewProductPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
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
  });

  const save = useMutation({
    mutationFn: () =>
      createProduct({
        name: form.name.trim(),
        category: form.category || null,
        purchase_price: parseNum(form.purchase_price),
        sale_price: parseNum(form.sale_price),
        stock: parseNum(form.stock),
        unit: form.unit,
        critical_level: form.critical_level
          ? parseNum(form.critical_level)
          : (settings?.default_critical_level ?? 5),
        note: form.note || null,
        car_models: form.car_models,
      }),
    onSuccess: () => {
      toast.success("قطعه ثبت شد");
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-background/70" onClick={onClose} aria-label="بستن" />
      <aside className="glass-strong slide-panel relative h-full w-full max-w-md overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">ثبت قطعه جدید</p>
          <button onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
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
            <Field label="موجودی اولیه">
              <input
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
            <Field label={`حد بحرانی (پیش‌فرض ${fmtNum(settings?.default_critical_level ?? 5)})`}>
              <input
                value={form.critical_level}
                onChange={(e) => setForm({ ...form, critical_level: e.target.value })}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
          </div>

          <Field label="مدل خودرو (چندانتخابی)">
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

          <PrimaryButton
            className="w-full"
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            ثبت قطعه
          </PrimaryButton>
        </div>
      </aside>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-ice-dim">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
