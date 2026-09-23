import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Download, Plus, Search, X } from "lucide-react";
import { getParty, listParties, partyLedger, saveParty } from "@/lib/api";
import { fmtJalali, fmtMoney, fmtNum } from "@/lib/format";
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

type Table = "customers" | "suppliers";

/** Shared list screen for customers and suppliers (identical structure). */
export function PartyList({ table }: { table: Table }) {
  const isCustomer = table === "customers";
  const title = isCustomer ? "مشتریان" : "تأمین‌کنندگان";
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: rows } = useQuery({
    queryKey: [table, search],
    queryFn: () => listParties(table, search),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-xs text-ice-dim">{fmtNum(rows?.length ?? 0)} پرونده ثبت‌شده</p>
        </div>
        <div className="ms-auto flex gap-2">
          <GhostButton
            onClick={() =>
              downloadCsv(
                table,
                ["نام", "تلفن", "آدرس", "وضعیت"],
                (rows ?? []).map((r) => [r.name, r.phone ?? "", r.address ?? "", r.is_active ? "فعال" : "غیرفعال"]),
              )
            }
          >
            <Download className="size-3.5" /> خروجی Excel
          </GhostButton>
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="size-4" /> {isCustomer ? "مشتری جدید" : "تأمین‌کننده جدید"}
          </PrimaryButton>
        </div>
      </div>

      <Panel bodyClassName="p-3">
        <div className="field flex h-9 items-center gap-2 px-3">
          <Search className="size-3.5 text-ice-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا شماره تماس"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ice-faint"
          />
        </div>
      </Panel>

      <Panel bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-[11px] text-ice-faint">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">نام</th>
              <th className="px-4 py-2.5 text-start font-medium">شماره تماس</th>
              <th className="px-4 py-2.5 text-start font-medium">آدرس</th>
              <th className="px-4 py-2.5 text-start font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-accent/60">
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    to={isCustomer ? "/customers/$id" : "/suppliers/$id"}
                    params={{ id: r.id }}
                    className="hover:text-primary"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="num px-4 py-2.5 text-xs text-ice-dim">{r.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-ice-dim">{r.address ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <Pill
                    className={
                      r.is_active
                        ? "bg-primary/10 text-primary ring-primary/25"
                        : "bg-foreground/[0.05] text-ice-faint ring-border"
                    }
                  >
                    {r.is_active ? "فعال" : "غیرفعال"}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <Empty>موردی پیدا نشد</Empty>}
      </Panel>

      {open && <PartyForm table={table} onClose={() => setOpen(false)} />}
    </>
  );
}

function PartyForm({
  table,
  onClose,
  initial,
}: {
  table: Table;
  onClose: () => void;
  initial?: { id: string; name: string; phone: string | null; address: string | null; note: string | null; is_active: boolean };
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    note: initial?.note ?? "",
    is_active: initial?.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: () =>
      saveParty(table, {
        ...(initial ? { id: initial.id } : {}),
        name: form.name.trim(),
        phone: form.phone || null,
        address: form.address || null,
        note: form.note || null,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      toast.success("ذخیره شد");
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-background/70" onClick={onClose} aria-label="بستن" />
      <aside className="glass-strong slide-panel relative h-full w-full max-w-sm overflow-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">
            {initial ? "ویرایش پرونده" : table === "customers" ? "مشتری جدید" : "تأمین‌کننده جدید"}
          </p>
          <button onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          {(
            [
              ["name", "نام"],
              ["phone", "شماره تماس"],
              ["address", "آدرس"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-[11px] text-ice-dim">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="field mt-1.5 h-10 w-full px-3 text-sm"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-[11px] text-ice-dim">یادداشت</span>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className="field mt-1.5 w-full px-3 py-2 text-sm"
            />
          </label>
          <GhostButton onClick={() => setForm({ ...form, is_active: !form.is_active })}>
            {form.is_active ? "غیرفعال‌کردن" : "فعال‌کردن"}
          </GhostButton>
          <PrimaryButton
            className="w-full"
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره
          </PrimaryButton>
        </div>
      </aside>
    </div>
  );
}

/** Shared ledger/detail screen for one customer or supplier. */
export function PartyDetail({ table, id }: { table: Table; id: string }) {
  const isCustomer = table === "customers";
  const [edit, setEdit] = useState(false);
  const { data: party } = useQuery({ queryKey: [table, id], queryFn: () => getParty(table, id) });
  const { data: ledger } = useQuery({
    queryKey: [table, id, "ledger"],
    queryFn: () => partyLedger(table, id),
  });

  useEffect(() => {
    if (!party) setEdit(false);
  }, [party]);

  if (!party)
    return (
      <Panel bodyClassName="p-6">
        <Empty>در حال بارگذاری…</Empty>
      </Panel>
    );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={isCustomer ? "/customers" : "/suppliers"} className="text-ice-dim hover:text-foreground">
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{party.name}</h1>
          <p className="num mt-1 text-xs text-ice-faint">{party.phone ?? "بدون شماره تماس"}</p>
        </div>
        <GhostButton className="ms-auto" onClick={() => setEdit(true)}>
          ویرایش پرونده
        </GhostButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={isCustomer ? "مجموع خرید (تومان)" : "مجموع تأمین (تومان)"} value={fmtMoney(ledger?.total ?? 0)} />
        <Stat label="مجموع پرداختی (تومان)" value={fmtMoney(ledger?.paid ?? 0)} tone="primary" />
        <Stat
          label="مانده بدهی (تومان)"
          value={fmtMoney(ledger?.balance ?? 0)}
          tone={(ledger?.balance ?? 0) > 0 ? "destructive" : "default"}
        />
      </div>

      <Panel
        title="دفتر معین و تاریخچه فاکتورها"
        action={
          <GhostButton
            onClick={() =>
              downloadCsv(
                `ledger-${party.name}`,
                ["شماره فاکتور", "نوع", "تاریخ", "مبلغ", "پرداختی", "وضعیت"],
                (ledger?.invoices ?? []).map((inv) => [
                  inv.number,
                  INVOICE_KIND_LABEL[inv.kind as InvoiceKind],
                  fmtJalali(inv.issued_at, false),
                  inv.total,
                  inv.paid_amount,
                  PAYMENT_STATUS_LABEL[inv.payment_status as PaymentStatus],
                ]),
              )
            }
          >
            <Download className="size-3.5" /> خروجی Excel
          </GhostButton>
        }
        bodyClassName="overflow-x-auto"
      >
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-[11px] text-ice-faint">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">شماره</th>
              <th className="px-4 py-2.5 text-start font-medium">نوع</th>
              <th className="px-4 py-2.5 text-start font-medium">تاریخ</th>
              <th className="px-4 py-2.5 text-start font-medium">مبلغ</th>
              <th className="px-4 py-2.5 text-start font-medium">مانده</th>
              <th className="px-4 py-2.5 text-start font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {(ledger?.invoices ?? []).map((inv) => (
              <tr key={inv.id} className="border-t border-border hover:bg-accent/60">
                <td className="num px-4 py-2.5">
                  <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:text-primary">
                    {inv.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-xs text-ice-dim">
                  {INVOICE_KIND_LABEL[inv.kind as InvoiceKind]}
                </td>
                <td className="num px-4 py-2.5 text-xs text-ice-dim">{fmtJalali(inv.issued_at, false)}</td>
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
        {ledger && ledger.invoices.length === 0 && <Empty>فاکتوری ثبت نشده است</Empty>}
      </Panel>

      {edit && (
        <PartyForm
          table={table}
          onClose={() => setEdit(false)}
          initial={{
            id: party.id,
            name: party.name,
            phone: party.phone,
            address: party.address,
            note: party.note,
            is_active: party.is_active,
          }}
        />
      )}
    </>
  );
}
