import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { listInvoices } from "@/lib/api";
import { fmtJalali, fmtMoney, fmtNum, jalaliInputValue, parseJalali } from "@/lib/format";
import {
  INVOICE_KIND_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  balanceOf,
  type InvoiceKind,
  type PaymentStatus,
} from "@/lib/domain";
import { downloadCsv } from "@/lib/exports";
import { Empty, GhostButton, Panel, Pill, PrimaryButton } from "@/components/panel";
import { Select } from "./products.index";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [
      { title: "فاکتورها — احمدی" },
      { name: "description", content: "فاکتورهای فروش، تأمین و مرجوعی با جستجو و فیلتر پیشرفته." },
      { property: "og:title", content: "فاکتورها — احمدی" },
      { property: "og:description", content: "بایگانی و جستجوی فاکتورهای فروش و تأمین احمدی." },
    ],
  }),
  component: InvoicesPage,
});

type Tab = "sale" | "purchase";
type Show = "all" | "invoices" | "returns";

function InvoicesPage() {
  const [tab, setTab] = useState<Tab>("sale");
  const [show, setShow] = useState<Show>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["invoices", tab, show, search, status, from, to],
    queryFn: () =>
      listInvoices({
        kind: tab,
        includeReturns: show !== "invoices",
        onlyReturns: show === "returns",
        ...(search ? { search } : {}),
        status,
        from: from ? parseJalali(from) : null,
        to: to ? parseJalali(to, true) : null,
      }),
  });

  const visible = (rows ?? []).filter((r) => (show === "returns" ? r.return_kind === tab : true));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">فاکتورها</h1>
          <p className="mt-1 text-xs text-ice-dim">{fmtNum(visible.length)} فاکتور در این نما</p>
        </div>
        <div className="ms-auto flex gap-2">
          <GhostButton
            onClick={() =>
              downloadCsv(
                `invoices-${tab}`,
                ["شماره", "نوع", "طرف حساب", "تاریخ", "مبلغ", "پرداختی", "مانده", "وضعیت"],
                visible.map((inv) => [
                  inv.number,
                  INVOICE_KIND_LABEL[inv.kind as InvoiceKind],
                  inv.customers?.name ?? inv.suppliers?.name ?? "",
                  fmtJalali(inv.issued_at, false),
                  inv.total,
                  inv.paid_amount,
                  balanceOf(Number(inv.total), Number(inv.paid_amount)),
                  PAYMENT_STATUS_LABEL[inv.payment_status as PaymentStatus],
                ]),
              )
            }
          >
            <Download className="size-3.5" /> خروجی Excel
          </GhostButton>
          <Link to="/invoices/new">
            <PrimaryButton>
              <Plus className="size-4" /> فاکتور جدید
            </PrimaryButton>
          </Link>
        </div>
      </div>

      <div className="flex rounded-lg bg-surface-2/60 p-1 ring-1 ring-border">
        {(["sale", "purchase"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium ${
              tab === t ? "bg-primary/15 text-primary ring-1 ring-ring" : "text-ice-dim"
            }`}
          >
            فاکتورهای {t === "sale" ? "فروش" : "تأمین"}
          </button>
        ))}
      </div>

      <Panel bodyClassName="flex flex-wrap gap-2 p-3">
        <div className="field flex h-9 min-w-48 flex-1 items-center gap-2 px-3">
          <Search className="size-3.5 text-ice-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="شماره فاکتور یا نام طرف حساب"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ice-faint"
          />
        </div>
        <Select
          value={show}
          onChange={(v) => setShow(v as Show)}
          options={[
            ["all", "فاکتور و مرجوعی"],
            ["invoices", "فقط فاکتورها"],
            ["returns", "فقط مرجوعی‌ها"],
          ]}
        />
        <Select
          value={status}
          onChange={(v) => setStatus(v as "all" | PaymentStatus)}
          options={[
            ["all", "همه وضعیت‌ها"],
            ["paid", "پرداخت‌شده"],
            ["unpaid", "پرداخت‌نشده"],
            ["partial", "بخشی پرداخت‌شده"],
            ["returned", "مرجوعی"],
          ]}
        />
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder={`از ${jalaliInputValue()}`}
          className="field num h-9 w-32 px-3 text-xs"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={`تا ${jalaliInputValue()}`}
          className="field num h-9 w-32 px-3 text-xs"
        />
      </Panel>

      <Panel bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-[11px] text-ice-faint">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">شماره</th>
              <th className="px-4 py-2.5 text-start font-medium">نوع</th>
              <th className="px-4 py-2.5 text-start font-medium">طرف حساب</th>
              <th className="px-4 py-2.5 text-start font-medium">تاریخ</th>
              <th className="px-4 py-2.5 text-start font-medium">مبلغ</th>
              <th className="px-4 py-2.5 text-start font-medium">مانده</th>
              <th className="px-4 py-2.5 text-start font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((inv) => (
              <tr key={inv.id} className="border-t border-border hover:bg-accent/60">
                <td className="num px-4 py-2.5">
                  <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:text-primary">
                    {inv.number}
                  </Link>
                  {inv.is_void && <span className="ms-2 text-[10px] text-destructive">باطل</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-ice-dim">
                  {INVOICE_KIND_LABEL[inv.kind as InvoiceKind]}
                </td>
                <td className="px-4 py-2.5">{inv.customers?.name ?? inv.suppliers?.name ?? "—"}</td>
                <td className="num px-4 py-2.5 text-xs text-ice-dim">{fmtJalali(inv.issued_at)}</td>
                <td className="num px-4 py-2.5 font-semibold">{fmtMoney(inv.total)}</td>
                <td className="num px-4 py-2.5 text-xs text-warning">
                  {fmtMoney(balanceOf(Number(inv.total), Number(inv.paid_amount)))}
                </td>
                <td className="px-4 py-2.5">
                  <Pill className={PAYMENT_STATUS_TONE[inv.payment_status as PaymentStatus]}>
                    {PAYMENT_STATUS_LABEL[inv.payment_status as PaymentStatus]}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <Empty>فاکتوری با این فیلترها پیدا نشد</Empty>}
      </Panel>
    </>
  );
}
