/** Domain vocabulary shared by every module — labels, options and business rules. */

export const CATEGORIES = ["موتوری", "بدنه", "ترمز", "برقی", "جلوبندی", "سایر"] as const;
export const CAR_MODELS = ["گالانت", "سوسماری", "VR4", "عینکی", "لنسر"] as const;
export const UNITS = ["عدد", "جفت"] as const;

export type PaymentStatus = "paid" | "unpaid" | "partial" | "returned";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "پرداخت‌شده",
  unpaid: "پرداخت‌نشده",
  partial: "بخشی پرداخت‌شده",
  returned: "مرجوعی",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, string> = {
  paid: "bg-primary/15 text-primary ring-primary/30",
  unpaid: "bg-destructive/15 text-destructive ring-destructive/30",
  partial: "bg-warning/15 text-warning ring-warning/30",
  returned: "bg-ice-dim/10 text-ice-dim ring-border",
};

export type InvoiceKind = "sale" | "purchase" | "return";

export const INVOICE_KIND_LABEL: Record<InvoiceKind, string> = {
  sale: "فروش",
  purchase: "تأمین",
  return: "مرجوعی",
};

export const STOCK_REASON_LABEL: Record<string, string> = {
  sale: "فروش",
  purchase: "تأمین",
  return_sale: "مرجوعی فروش",
  return_purchase: "مرجوعی تأمین",
  manual: "اصلاح دستی",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "auth.login": "ورود به پنل",
  "auth.logout": "خروج از پنل",
  "product.create": "ثبت قطعه",
  "product.update": "ویرایش قطعه",
  "product.price": "تغییر قیمت",
  "product.stock": "اصلاح موجودی",
  "customer.create": "ثبت مشتری",
  "customer.update": "ویرایش مشتری",
  "supplier.create": "ثبت تأمین‌کننده",
  "supplier.update": "ویرایش تأمین‌کننده",
  "invoice.create": "ثبت فاکتور",
  "invoice.update": "ویرایش فاکتور",
  "invoice.void": "باطل‌کردن فاکتور",
  "payment.create": "ثبت پرداخت",
  "settings.update": "تغییر تنظیمات",
};

export function stockLevel(stock: number, critical: number): "critical" | "low" | "ok" {
  if (stock <= critical) return "critical";
  if (stock <= critical * 2) return "low";
  return "ok";
}

export const STOCK_LEVEL_LABEL = { critical: "بحرانی", low: "کم", ok: "کافی" } as const;

export const STOCK_LEVEL_TONE = {
  critical: "bg-destructive/15 text-destructive ring-destructive/30",
  low: "bg-warning/15 text-warning ring-warning/30",
  ok: "bg-primary/10 text-primary ring-primary/25",
} as const;

/** Remaining balance of an invoice. */
export function balanceOf(total: number, paid: number): number {
  return Math.max(0, Number(total ?? 0) - Number(paid ?? 0));
}

export function statusFromAmounts(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}
