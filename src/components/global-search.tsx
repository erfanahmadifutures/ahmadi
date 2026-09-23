import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { globalSearch } from "@/lib/api";
import { fmtMoney, fmtNum, fmtJalali } from "@/lib/format";
import { INVOICE_KIND_LABEL, type InvoiceKind } from "@/lib/domain";

/** Panel-wide search across parts, customers, suppliers and invoices. */
export function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["global-search", term],
    queryFn: () => globalSearch(term),
    enabled: term.trim().length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    setTerm("");
    navigate({ to, params } as never);
  };

  const groups = [
    {
      label: "قطعات",
      rows: (data?.products ?? []).map((p) => ({
        key: p.id,
        title: `${p.name} — ${p.code}`,
        meta: `موجودی ${fmtNum(p.stock)} · ${fmtMoney(p.sale_price)} تومان`,
        onSelect: () => go("/products/$id", { id: p.id }),
      })),
    },
    {
      label: "مشتریان",
      rows: (data?.customers ?? []).map((c) => ({
        key: c.id,
        title: c.name,
        meta: c.phone ?? "—",
        onSelect: () => go("/customers/$id", { id: c.id }),
      })),
    },
    {
      label: "تأمین‌کنندگان",
      rows: (data?.suppliers ?? []).map((s) => ({
        key: s.id,
        title: s.name,
        meta: s.phone ?? "—",
        onSelect: () => go("/suppliers/$id", { id: s.id }),
      })),
    },
    {
      label: "فاکتورها",
      rows: (data?.invoices ?? []).map((i) => ({
        key: i.id,
        title: `${i.number} · ${INVOICE_KIND_LABEL[i.kind as InvoiceKind]}`,
        meta: `${fmtMoney(i.total)} تومان · ${fmtJalali(i.issued_at, false)}`,
        onSelect: () => go("/invoices/$id", { id: i.id }),
      })),
    },
  ].filter((g) => g.rows.length);

  return (
    <div className="relative flex-1 md:max-w-md">
      <div className="flex h-9 items-center gap-2 rounded-lg bg-foreground/[0.04] px-3 ring-1 ring-border">
        <Search className="size-3.5 text-ice-faint" />
        <input
          id="global-search-input"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="جستجوی سراسری…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ice-faint"
        />
        <span className="hidden rounded-md px-1.5 py-0.5 text-[10px] text-ice-faint ring-1 ring-border sm:block">
          Ctrl K
        </span>
      </div>

      {open && term.trim().length >= 2 && (
        <div className="glass-strong absolute inset-x-0 top-11 z-50 max-h-[70vh] overflow-auto rounded-xl p-2 shadow-2xl">
          {groups.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-ice-faint">نتیجه‌ای پیدا نشد</p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold text-ice-faint">{group.label}</p>
              {group.rows.map((row) => (
                <button
                  key={row.key}
                  onClick={row.onSelect}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-accent"
                >
                  <span className="font-medium">{row.title}</span>
                  <span className="ms-auto text-[11px] text-ice-faint">{row.meta}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
