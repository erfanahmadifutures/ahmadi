import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowRight, Ban, Copy, Download, Link2, Printer, Save, Wallet } from "lucide-react";
import { addPayment, getInvoice, getSettings, updateInvoice, voidInvoice } from "@/lib/api";
import { fmtJalali, fmtMoney, fmtNum, parseNum } from "@/lib/format";
import {
  INVOICE_KIND_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  balanceOf,
  type InvoiceKind,
  type PaymentStatus,
} from "@/lib/domain";
import { downloadCsv } from "@/lib/exports";
import { Empty, GhostButton, Panel, Pill, PrimaryButton, Stat } from "@/components/panel";
import { Field } from "./products.index";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({
    meta: [
      { title: "فاکتور — احمدی" },
      { name: "description", content: "مشاهده، چاپ، پرداخت و ویرایش یک فاکتور." },
      { property: "og:title", content: "فاکتور — احمدی" },
      { property: "og:description", content: "جزئیات فاکتور، پرداخت‌ها و خروجی چاپی." },
    ],
  }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["invoice", id], queryFn: () => getInvoice(id) });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [qr, setQr] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [note, setNote] = useState("");
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/invoices/${id}`;

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 160 }).then(setQr).catch(() => {});
  }, [shareUrl]);

  useEffect(() => {
    if (data?.invoice) setNote(data.invoice.note ?? "");
  }, [data?.invoice]);

  const pay = useMutation({
    mutationFn: () => addPayment(id, parseNum(payAmount)),
    onSuccess: () => {
      toast.success("پرداخت ثبت شد");
      setPayAmount("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: () => updateInvoice(id, { note: note || null }),
    onSuccess: () => {
      toast.success("یادداشت ذخیره شد (موجودی تغییر نکرد)");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => voidInvoice(id),
    onSuccess: () => {
      toast.success("فاکتور باطل شد");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data)
    return (
      <Panel bodyClassName="p-6">
        <Empty>در حال بارگذاری…</Empty>
      </Panel>
    );

  const { invoice, items, payments } = data;
  const party = invoice.customers ?? invoice.suppliers;
  const balance = balanceOf(Number(invoice.total), Number(invoice.paid_amount));

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link to="/invoices" className="text-ice-dim hover:text-foreground">
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="num text-xl font-bold tracking-tight">{invoice.number}</h1>
          <p className="mt-1 text-xs text-ice-faint">
            {INVOICE_KIND_LABEL[invoice.kind as InvoiceKind]}
            {invoice.return_kind ? ` (${INVOICE_KIND_LABEL[invoice.return_kind as InvoiceKind]})` : ""}
            {invoice.is_void ? " — باطل‌شده" : ""}
          </p>
        </div>
        <Pill className={`ms-2 ${PAYMENT_STATUS_TONE[invoice.payment_status as PaymentStatus]}`}>
          {PAYMENT_STATUS_LABEL[invoice.payment_status as PaymentStatus]}
        </Pill>

        <div className="ms-auto flex flex-wrap gap-2">
          <GhostButton onClick={() => window.print()}>
            <Printer className="size-3.5" /> چاپ / PDF
          </GhostButton>
          <GhostButton
            onClick={() =>
              downloadCsv(
                invoice.number,
                ["قطعه", "کد", "تعداد", "قیمت واحد", "جمع"],
                items.map((it) => [it.product_name, it.product_code ?? "", it.quantity, it.unit_price, it.line_total]),
              )
            }
          >
            <Download className="size-3.5" /> Excel
          </GhostButton>
          <GhostButton
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success("لینک فاکتور کپی شد");
            }}
          >
            <Link2 className="size-3.5" /> لینک ارسال
          </GhostButton>
          <GhostButton
            onClick={() =>
              navigate({ to: "/invoices/new", search: { copy: invoice.id } })
            }
          >
            <Copy className="size-3.5" /> تکرار فاکتور
          </GhostButton>
          {!invoice.is_void && (
            <GhostButton onClick={() => cancel.mutate()} className="text-destructive">
              <Ban className="size-3.5" /> باطل‌کردن
            </GhostButton>
          )}
        </div>
      </div>

      <div className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="مبلغ کل (تومان)" value={fmtMoney(invoice.total)} tone="primary" />
        <Stat label="پرداخت‌شده (تومان)" value={fmtMoney(invoice.paid_amount)} />
        <Stat label="مانده (تومان)" value={fmtMoney(balance)} tone={balance > 0 ? "warning" : "default"} />
        <Stat label="تاریخ صدور" value={fmtJalali(invoice.issued_at)} />
      </div>

      {/* Printable invoice sheet — brand header ready for a logo */}
      <section className="print-sheet glass rounded-xl p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-lg font-extrabold tracking-tight">{settings?.brand_name ?? "احمدی"}</p>
            <p className="mt-1 text-[11px] text-ice-dim">قطعات یدکی میتسوبیشی</p>
            {settings?.brand_phone && <p className="num text-[11px] text-ice-dim">{settings.brand_phone}</p>}
            {settings?.brand_address && <p className="text-[11px] text-ice-dim">{settings.brand_address}</p>}
          </div>
          <div className="text-end">
            <p className="num text-sm font-bold">{invoice.number}</p>
            <p className="num mt-1 text-[11px] text-ice-dim">{fmtJalali(invoice.issued_at)}</p>
            {qr && <img src={qr} alt="QR فاکتور" width={96} height={96} className="mt-2 rounded-md" />}
          </div>
        </header>

        <div className="grid gap-2 py-4 text-xs sm:grid-cols-2">
          <p>
            <span className="text-ice-faint">طرف حساب: </span>
            {party?.name ?? "—"}
          </p>
          <p className="num">
            <span className="text-ice-faint">تماس: </span>
            {party?.phone ?? "—"}
          </p>
          {invoice.car_model && (
            <p>
              <span className="text-ice-faint">مدل خودرو: </span>
              {invoice.car_model}
            </p>
          )}
          {invoice.plate && (
            <p className="num">
              <span className="text-ice-faint">پلاک: </span>
              {invoice.plate}
            </p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-[11px] text-ice-faint">
            <tr>
              <th className="px-3 py-2 text-start font-medium">قطعه</th>
              <th className="px-3 py-2 text-start font-medium">کد</th>
              <th className="px-3 py-2 text-start font-medium">تعداد</th>
              <th className="px-3 py-2 text-start font-medium">قیمت واحد</th>
              <th className="px-3 py-2 text-start font-medium">جمع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="px-3 py-2">{it.product_name}</td>
                <td className="num px-3 py-2 text-[11px] text-ice-faint">{it.product_code ?? "—"}</td>
                <td className="num px-3 py-2">{fmtNum(it.quantity)}</td>
                <td className="num px-3 py-2">{fmtMoney(it.unit_price)}</td>
                <td className="num px-3 py-2 font-semibold">{fmtMoney(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <Row label="جمع ردیف‌ها" value={fmtMoney(invoice.items_total)} />
          {Number(invoice.shipping_cost) > 0 && (
            <Row label="هزینه حمل" value={fmtMoney(invoice.shipping_cost)} />
          )}
          <Row label="مبلغ نهایی" value={fmtMoney(invoice.total)} strong />
          <Row label="پرداخت‌شده" value={fmtMoney(invoice.paid_amount)} />
          <Row label="مانده" value={fmtMoney(balance)} />
        </div>

        {invoice.note && <p className="mt-4 text-xs text-ice-dim">یادداشت: {invoice.note}</p>}
        <p className="mt-6 text-center text-[10px] text-ice-faint">
          همه مبالغ به تومان است — {settings?.brand_name ?? "احمدی"}
        </p>
      </section>

      <div className="no-print grid gap-4 lg:grid-cols-2">
        <Panel title="ثبت پرداخت" bodyClassName="space-y-3 p-4">
          <Field label="مبلغ پرداخت (تومان)">
            <input
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="field num h-10 w-full px-3 text-sm"
            />
          </Field>
          <PrimaryButton
            className="w-full"
            disabled={parseNum(payAmount) <= 0 || pay.isPending}
            onClick={() => pay.mutate()}
          >
            <Wallet className="size-4" /> ثبت پرداخت
          </PrimaryButton>

          <div className="pt-2">
            <p className="mb-2 text-[11px] text-ice-faint">تاریخچه پرداخت‌ها</p>
            {payments.length === 0 ? (
              <p className="text-xs text-ice-faint">پرداختی ثبت نشده است</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
                  <span className="num font-semibold">{fmtMoney(p.amount)} تومان</span>
                  <span className="num text-ice-faint">{fmtJalali(p.paid_at)}</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="یادداشت فاکتور" subtitle="ویرایش فاکتور موجودی را تغییر نمی‌دهد" bodyClassName="space-y-3 p-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            className="field w-full px-3 py-2 text-sm"
          />
          <PrimaryButton className="w-full" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>
            <Save className="size-4" /> ذخیره یادداشت
          </PrimaryButton>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ice-dim">{label}</span>
      <span className={`num ${strong ? "text-base font-bold text-primary" : "text-sm"}`}>{value} تومان</span>
    </div>
  );
}
