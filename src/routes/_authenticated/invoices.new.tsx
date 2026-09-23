import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createInvoice, getInvoice, listInvoices, listParties, listProducts, saveParty } from "@/lib/api";
import { fmtMoney, fmtNum, parseJalali, jalaliInputValue, parseNum } from "@/lib/format";
import { CAR_MODELS, PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/domain";
import { Field, Select } from "./products.index";
import { Panel, PrimaryButton, GhostButton, Stat } from "@/components/panel";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  head: () => ({
    meta: [
      { title: "ثبت فاکتور — احمدی" },
      { name: "description", content: "ثبت فاکتور فروش، تأمین یا مرجوعی با اثر خودکار روی موجودی." },
      { property: "og:title", content: "ثبت فاکتور — احمدی" },
      { property: "og:description", content: "ثبت سریع فاکتور فروش، تأمین و مرجوعی." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { kind?: Kind; copy?: string } => {
    const out: { kind?: Kind; copy?: string } = {};
    const kind = search["kind"];
    if (kind === "sale" || kind === "purchase" || kind === "return") out.kind = kind;
    if (typeof search["copy"] === "string" && search["copy"]) out.copy = search["copy"];
    return out;
  },
  component: NewInvoicePage,
});

type Kind = "sale" | "purchase" | "return";
type Row = { product_id: string; product_name: string; product_code: string; unit_price: string; quantity: string };

const emptyRow: Row = { product_id: "", product_name: "", product_code: "", unit_price: "", quantity: "1" };

function NewInvoicePage() {
  const search = useSearch({ from: "/_authenticated/invoices/new" });
  const copyId = search.copy ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<Kind>(search.kind ?? "sale");
  const [returnKind, setReturnKind] = useState<"sale" | "purchase">("sale");
  const [partyId, setPartyId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [status, setStatus] = useState<PaymentStatus>("paid");
  const [paid, setPaid] = useState("");
  const [shipping, setShipping] = useState("");
  const [note, setNote] = useState("");
  const [carModel, setCarModel] = useState("");
  const [plate, setPlate] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [issuedAt, setIssuedAt] = useState(jalaliInputValue());

  const partyTable = (kind === "purchase" || (kind === "return" && returnKind === "purchase")
    ? "suppliers"
    : "customers") as "customers" | "suppliers";

  const { data: products } = useQuery({ queryKey: ["products", "picker"], queryFn: () => listProducts({ active: "active" }) });
  const { data: parties } = useQuery({
    queryKey: [partyTable, "picker"],
    queryFn: () => listParties(partyTable, "", "active"),
  });
  const { data: relatedOptions } = useQuery({
    queryKey: ["invoices", "related", kind === "return" ? returnKind : kind],
    queryFn: () => listInvoices({ kind: kind === "return" ? returnKind : "sale", includeReturns: false }),
    enabled: kind === "return",
  });

  // Copy / repeat an existing invoice
  useQuery({
    queryKey: ["invoice-copy", copyId],
    enabled: Boolean(copyId),
    queryFn: async () => {
      const { invoice, items } = await getInvoice(copyId);
      setKind(invoice.kind as Kind);
      if (invoice.return_kind) setReturnKind(invoice.return_kind as "sale" | "purchase");
      setPartyId(invoice.customer_id ?? invoice.supplier_id ?? "");
      setRows(
        items.map((it) => ({
          product_id: it.product_id ?? "",
          product_name: it.product_name,
          product_code: it.product_code ?? "",
          unit_price: String(it.unit_price),
          quantity: String(it.quantity),
        })),
      );
      setShipping(String(invoice.shipping_cost ?? 0));
      setNote(invoice.note ?? "");
      setCarModel(invoice.car_model ?? "");
      setPlate(invoice.plate ?? "");
      return invoice;
    },
  });

  const itemsTotal = useMemo(
    () => rows.reduce((s, r) => s + parseNum(r.unit_price) * parseNum(r.quantity), 0),
    [rows],
  );
  const total = itemsTotal + (kind === "purchase" ? parseNum(shipping) : 0);

  function setRow(index: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function pickProduct(index: number, productId: string) {
    const p = products?.find((x) => x.id === productId);
    if (!p) return setRow(index, { product_id: "", product_name: "", product_code: "" });
    setRow(index, {
      product_id: p.id,
      product_name: p.name,
      product_code: p.code,
      unit_price: String(kind === "purchase" ? p.purchase_price : p.sale_price),
    });
  }

  const addRow = () => setRows((rs) => [...rs, { ...emptyRow }]);

  const submit = useMutation({
    mutationFn: async () => {
      let party = partyId;
      if (!party && newPartyName.trim()) {
        const created = await saveParty(partyTable, {
          name: newPartyName.trim(),
          phone: newPartyPhone || null,
        });
        party = created.id;
      }
      const cleaned = rows.filter((r) => r.product_name.trim() && parseNum(r.quantity) > 0);
      if (!cleaned.length) throw new Error("حداقل یک ردیف قطعه لازم است");

      const paidAmount =
        status === "paid" ? total : status === "partial" ? parseNum(paid) : 0;

      return createInvoice({
        kind,
        ...(kind === "return" ? { return_kind: returnKind } : {}),
        ...(kind === "return" && relatedId ? { related_invoice_id: relatedId } : {}),
        ...(partyTable === "customers" ? { customer_id: party || null } : { supplier_id: party || null }),
        issued_at: (parseJalali(issuedAt) ?? new Date()).toISOString(),
        payment_status: status,
        shipping_cost: kind === "purchase" ? parseNum(shipping) : 0,
        paid_amount: paidAmount,
        note: note || null,
        car_model: carModel || null,
        plate: plate || null,
        items: cleaned.map((r) => ({
          product_id: r.product_id || null,
          product_code: r.product_code || null,
          product_name: r.product_name.trim(),
          unit_price: parseNum(r.unit_price),
          quantity: parseNum(r.quantity),
        })),
      });
    },
    onSuccess: (invoice) => {
      toast.success(`فاکتور ${invoice.number} ثبت شد`);
      queryClient.invalidateQueries();
      navigate({ to: "/invoices/$id", params: { id: invoice.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div>
        <h1 className="text-xl font-bold tracking-tight">ثبت فاکتور</h1>
        <p className="mt-1 text-xs text-ice-dim">
          ثبت فاکتور موجودی انبار را در همان لحظه به‌روز می‌کند. کلید Enter یک ردیف جدید اضافه می‌کند.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg bg-surface-2/60 p-1 ring-1 ring-border">
        {(
          [
            ["sale", "فروش"],
            ["purchase", "تأمین"],
            ["return", "مرجوعی"],
          ] as [Kind, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setPartyId("");
            }}
            className={`rounded-md px-4 py-1.5 text-xs font-medium ${
              kind === k ? "bg-primary/15 text-primary ring-1 ring-ring" : "text-ice-dim"
            }`}
          >
            {label}
          </button>
        ))}
        {kind === "return" && (
          <Select
            className="ms-auto"
            value={returnKind}
            onChange={(v) => {
              setReturnKind(v as "sale" | "purchase");
              setPartyId("");
            }}
            options={[
              ["sale", "مرجوعی فروش (افزودن به موجودی)"],
              ["purchase", "مرجوعی تأمین (کسر از موجودی)"],
            ]}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="طرف حساب" bodyClassName="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={partyTable === "customers" ? "انتخاب مشتری" : "انتخاب تأمین‌کننده"}>
              <Select
                className="h-10 w-full text-sm"
                value={partyId}
                onChange={setPartyId}
                options={[["", "— ثبت طرف حساب جدید —"], ...(parties ?? []).map((p) => [p.id, p.name] as [string, string])]}
              />
            </Field>
            <Field label="تاریخ فاکتور (شمسی)">
              <input
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="field num h-10 w-full px-3 text-sm"
              />
            </Field>
            {!partyId && (
              <>
                <Field label="نام جدید">
                  <input
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    className="field h-10 w-full px-3 text-sm"
                  />
                </Field>
                <Field label="شماره تماس">
                  <input
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="field num h-10 w-full px-3 text-sm"
                  />
                </Field>
              </>
            )}
            {kind === "return" && (
              <Field label="فاکتور اصلی (اختیاری)">
                <Select
                  className="h-10 w-full text-sm"
                  value={relatedId}
                  onChange={setRelatedId}
                  options={[
                    ["", "بدون فاکتور اصلی"],
                    ...(relatedOptions ?? []).map((i) => [i.id, i.number] as [string, string]),
                  ]}
                />
              </Field>
            )}
            {kind === "sale" && (
              <>
                <Field label="مدل خودرو (اختیاری)">
                  <Select
                    className="h-10 w-full text-sm"
                    value={carModel}
                    onChange={setCarModel}
                    options={[["", "—"], ...CAR_MODELS.map((c) => [c, c] as [string, string])]}
                  />
                </Field>
                <Field label="شماره پلاک (اختیاری)">
                  <input
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="field num h-10 w-full px-3 text-sm"
                  />
                </Field>
              </>
            )}
          </Panel>

          <Panel
            title="ردیف‌های فاکتور"
            action={
              <GhostButton onClick={addRow}>
                <Plus className="size-3.5" /> ردیف جدید
              </GhostButton>
            }
            bodyClassName="p-3 space-y-2"
          >
            {rows.map((row, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-foreground/[0.03] p-2 sm:grid-cols-[1.6fr_1fr_.7fr_auto]">
                <Select
                  className="h-9 w-full text-xs"
                  value={row.product_id}
                  onChange={(v) => pickProduct(i, v)}
                  options={[
                    ["", "انتخاب قطعه"],
                    ...(products ?? []).map(
                      (p) => [p.id, `${p.name} — موجودی ${p.stock}`] as [string, string],
                    ),
                  ]}
                />
                <input
                  value={row.unit_price}
                  onChange={(e) => setRow(i, { unit_price: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addRow()}
                  placeholder="قیمت واحد"
                  className="field num h-9 px-3 text-xs"
                />
                <input
                  value={row.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addRow()}
                  placeholder="تعداد"
                  className="field num h-9 px-3 text-xs"
                />
                <button
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, x) => x !== i) : rs))}
                  className="grid size-9 place-items-center rounded-lg text-ice-faint hover:text-destructive"
                  aria-label="حذف ردیف"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="جمع ردیف‌ها (تومان)" value={fmtMoney(itemsTotal)} />
            <Stat label="مبلغ نهایی (تومان)" value={fmtMoney(total)} tone="primary" />
          </div>

          <Panel title="پرداخت" bodyClassName="space-y-3 p-4">
            <Field label="وضعیت پرداخت">
              <Select
                className="h-10 w-full text-sm"
                value={status}
                onChange={(v) => setStatus(v as PaymentStatus)}
                options={(["paid", "unpaid", "partial"] as PaymentStatus[]).map(
                  (s) => [s, PAYMENT_STATUS_LABEL[s]] as [string, string],
                )}
              />
            </Field>
            {status === "partial" && (
              <Field label="مبلغ پرداختی (تومان)">
                <input
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  className="field num h-10 w-full px-3 text-sm"
                />
              </Field>
            )}
            {status === "partial" && (
              <p className="num text-[11px] text-warning">
                مانده: {fmtMoney(Math.max(0, total - parseNum(paid)))} تومان
              </p>
            )}
            {kind === "purchase" && (
              <Field label="هزینه حمل / باربری (تومان)">
                <input
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  className="field num h-10 w-full px-3 text-sm"
                />
              </Field>
            )}
            <Field label="یادداشت">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="field w-full px-3 py-2 text-sm"
              />
            </Field>
            <PrimaryButton
              className="w-full"
              disabled={submit.isPending || itemsTotal <= 0}
              onClick={() => submit.mutate()}
            >
              ثبت نهایی فاکتور ({fmtNum(rows.length)} ردیف)
            </PrimaryButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
