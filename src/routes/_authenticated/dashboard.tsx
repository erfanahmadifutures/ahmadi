import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { dashboardData, salesItemsSince } from "@/lib/api";
import { fmtJalali, fmtMoney, fmtNum, toFa } from "@/lib/format";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  STOCK_LEVEL_LABEL,
  STOCK_LEVEL_TONE,
  balanceOf,
  stockLevel,
  type PaymentStatus,
} from "@/lib/domain";
import { downloadCsv } from "@/lib/exports";
import { Empty, GhostButton, Panel, Pill, Stat } from "@/components/panel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "داشبورد مدیریتی — احمدی" },
      { name: "description", content: "نمای کلی فروش، سود، ارزش انبار و هشدارهای موجودی." },
      { property: "og:title", content: "داشبورد مدیریتی — احمدی" },
      { property: "og:description", content: "نمای کلی فروش، سود و هشدارهای انبار قطعات احمدی." },
    ],
  }),
  component: Dashboard,
});

type Range = "day" | "week" | "month";
const RANGE_LABEL: Record<Range, string> = { day: "روزانه", week: "هفتگی", month: "ماهانه" };
const RANGE_DAYS: Record<Range, number> = { day: 14, week: 84, month: 365 };

function Dashboard() {
  const [range, setRange] = useState<Range>("day");
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardData });
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - RANGE_DAYS[range]);
    return d;
  }, [range]);
  const { data: soldItems } = useQuery({
    queryKey: ["sales-items", range],
    queryFn: () => salesItemsSince(since),
  });

  const products = data?.products ?? [];
  const invoices = data?.invoices ?? [];

  const sales = invoices.filter((i) => i.kind === "sale");
  const inventoryValue = products.reduce((s, p) => s + Number(p.purchase_price) * p.stock, 0);
  const grossProfit = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, Number(p.purchase_price)]));
    return (soldItems ?? []).reduce(
      (s, it) => s + (Number(it.line_total) - (map.get(it.product_id ?? "") ?? 0) * it.quantity),
      0,
    );
  }, [soldItems, products]);
  const unpaid = invoices.filter(
    (i) => i.payment_status === "unpaid" || i.payment_status === "partial",
  );
  const critical = products.filter((p) => p.stock <= p.critical_level);

  const salesSeries = useMemo(() => {
    const buckets = new Map<string, { label: string; total: number; sort: number }>();
    for (const inv of sales) {
      const d = new Date(inv.issued_at);
      if (d < since) continue;
      let key: string;
      if (range === "day") key = d.toISOString().slice(0, 10);
      else if (range === "month") key = d.toISOString().slice(0, 7);
      else {
        const week = new Date(d);
        week.setDate(week.getDate() - week.getDay());
        key = week.toISOString().slice(0, 10);
      }
      const existing = buckets.get(key);
      const total = (existing?.total ?? 0) + Number(inv.total);
      buckets.set(key, {
        label: fmtJalali(key.length === 7 ? `${key}-01` : key, false),
        total,
        sort: new Date(key.length === 7 ? `${key}-01` : key).getTime(),
      });
    }
    return [...buckets.values()].sort((a, b) => a.sort - b.sort).slice(-16);
  }, [sales, range, since]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of soldItems ?? []) {
      const prev = map.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 };
      prev.qty += it.quantity;
      prev.revenue += Number(it.line_total);
      map.set(it.product_name, prev);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 7);
  }, [soldItems]);

  const stale = useMemo(() => {
    const soldIds = new Set((soldItems ?? []).map((i) => i.product_id));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return products.filter((p) => !soldIds.has(p.id) && new Date(p.created_at) < cutoff).slice(0, 10);
  }, [products, soldItems]);

  const levels = products.reduce(
    (acc, p) => {
      acc[stockLevel(p.stock, p.critical_level)] += 1;
      return acc;
    },
    { critical: 0, low: 0, ok: 0 },
  );

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">داشبورد مدیریتی</h1>
          <p className="mt-1 text-xs text-ice-dim">
            گزارش {RANGE_LABEL[range]} فروش، سود و وضعیت انبار
          </p>
        </div>
        <div className="ms-auto flex rounded-lg bg-surface-2/60 p-1 ring-1 ring-border">
          {(["day", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                range === r ? "bg-primary/15 text-primary ring-1 ring-ring" : "text-ice-dim"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`فروش ${RANGE_LABEL[range]} (تومان)`}
          value={fmtMoney(salesSeries.reduce((s, b) => s + b.total, 0))}
          tone="primary"
          hint={`${fmtNum(sales.length)} فاکتور فروش ثبت‌شده`}
        />
        <Stat label="سود ناخالص (تومان)" value={fmtMoney(grossProfit)} hint="فروش منهای قیمت خرید" />
        <Stat
          label="ارزش انبار (تومان)"
          value={fmtMoney(inventoryValue)}
          hint={`${fmtNum(products.length)} قطعه فعال`}
        />
        <Stat
          label="مانده پرداخت‌نشده (تومان)"
          value={fmtMoney(unpaid.reduce((s, i) => s + balanceOf(Number(i.total), Number(i.paid_amount)), 0))}
          tone="warning"
          hint={`${fmtNum(unpaid.length)} فاکتور معوق`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="روند فروش" subtitle={`نمایش ${RANGE_LABEL[range]}`} bodyClassName="p-3">
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesSeries}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-ice-faint)" }} />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-ice-faint)" }}
                  tickFormatter={(v: number) => toFa(Math.round(v / 1_000_000)) + "م"}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    direction: "rtl",
                  }}
                  formatter={(v: number) => [fmtMoney(v) + " تومان", "فروش"]}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="پرفروش‌ترین قطعات" bodyClassName="p-3">
          <div className="h-64" dir="ltr">
            {topProducts.length === 0 ? (
              <Empty>در این بازه فروشی ثبت نشده است</Empty>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-ice-faint)" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 10, fill: "var(--color-ice-dim)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      direction: "rtl",
                    }}
                    formatter={(v: number) => [fmtNum(v), "تعداد فروش"]}
                  />
                  <Bar dataKey="qty" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="وضعیت موجودی" bodyClassName="space-y-2 p-4">
          {(["critical", "low", "ok"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-3 py-2.5">
              <Pill className={STOCK_LEVEL_TONE[k]}>{STOCK_LEVEL_LABEL[k]}</Pill>
              <span className="num text-sm font-bold">{fmtNum(levels[k])} قطعه</span>
            </div>
          ))}
        </Panel>

        <Panel
          title="موجودی کمتر از حد بحرانی"
          action={
            <GhostButton
              onClick={() =>
                downloadCsv(
                  "critical-stock",
                  ["کد", "نام", "موجودی", "حد بحرانی"],
                  critical.map((p) => [p.code, p.name, p.stock, p.critical_level]),
                )
              }
            >
              <Download className="size-3.5" /> Excel
            </GhostButton>
          }
          bodyClassName="max-h-64 overflow-auto"
        >
          {critical.length === 0 ? (
            <Empty>همه قطعات بالای حد بحرانی هستند</Empty>
          ) : (
            critical.map((p) => (
              <Link
                key={p.id}
                to="/products/$id"
                params={{ id: p.id }}
                className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-accent"
              >
                <span className="num text-[11px] text-ice-faint">{p.code}</span>
                <span className="font-medium">{p.name}</span>
                <span className="num ms-auto text-destructive">
                  {fmtNum(p.stock)} / {fmtNum(p.critical_level)}
                </span>
              </Link>
            ))
          )}
        </Panel>

        <Panel title="فاکتورهای پرداخت‌نشده" bodyClassName="max-h-64 overflow-auto">
          {unpaid.length === 0 ? (
            <Empty>همه فاکتورها تسویه شده‌اند</Empty>
          ) : (
            unpaid.slice(0, 25).map((inv) => (
              <Link
                key={inv.id}
                to="/invoices/$id"
                params={{ id: inv.id }}
                className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-accent"
              >
                <span className="num text-[11px] text-ice-faint">{inv.number}</span>
                <span className="truncate">{inv.customers?.name ?? inv.suppliers?.name ?? "—"}</span>
                <Pill className={`ms-auto ${PAYMENT_STATUS_TONE[inv.payment_status as PaymentStatus]}`}>
                  {PAYMENT_STATUS_LABEL[inv.payment_status as PaymentStatus]}
                </Pill>
                <span className="num text-xs text-warning">
                  {fmtMoney(balanceOf(Number(inv.total), Number(inv.paid_amount)))}
                </span>
              </Link>
            ))
          )}
        </Panel>
      </div>

      <Panel
        title="کالاهای راکد"
        subtitle="بیش از ۳۰ روز بدون فروش"
        action={
          <GhostButton
            onClick={() =>
              downloadCsv(
                "stale-products",
                ["کد", "نام", "موجودی", "قیمت خرید"],
                stale.map((p) => [p.code, p.name, p.stock, p.purchase_price]),
              )
            }
          >
            <Download className="size-3.5" /> Excel
          </GhostButton>
        }
        bodyClassName="max-h-72 overflow-auto"
      >
        {stale.length === 0 ? (
          <Empty>کالای راکدی وجود ندارد</Empty>
        ) : (
          stale.map((p) => (
            <Link
              key={p.id}
              to="/products/$id"
              params={{ id: p.id }}
              className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-accent"
            >
              <span className="num text-[11px] text-ice-faint">{p.code}</span>
              <span className="font-medium">{p.name}</span>
              <span className="num ms-auto text-xs text-ice-dim">
                موجودی {fmtNum(p.stock)} {p.unit}
              </span>
            </Link>
          ))
        )}
      </Panel>
    </>
  );
}
