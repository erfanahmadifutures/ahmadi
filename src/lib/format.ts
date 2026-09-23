import { toJalaali, toGregorian } from "jalaali-js";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert every ASCII digit in a string to a Persian digit. */
export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]!);
}

/** Convert Persian/Arabic digits back to ASCII (for parsing user input). */
export function toEn(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** 1234567 -> «۱٬۲۳۴٬۵۶۷» */
export function fmtMoney(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  const sign = n < 0 ? "−" : "";
  const grouped = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return sign + toFa(grouped);
}

export function fmtNum(value: number | null | undefined): string {
  return toFa(Math.round(Number(value ?? 0)));
}

/** Parse a money/number field that may contain Persian digits and separators. */
export function parseNum(input: string): number {
  const cleaned = toEn(String(input)).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO/UTC -> «۱۴۰۵/۰۱/۰۱ - ۱۴:۳۰» */
export function fmtJalali(iso: string | Date | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const { jy, jm, jd } = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const date = `${jy}/${pad(jm)}/${pad(jd)}`;
  return toFa(withTime ? `${date} - ${pad(d.getHours())}:${pad(d.getMinutes())}` : date);
}

/** Jalali date only, ASCII digits — used as <input> value. */
export function jalaliInputValue(date: Date = new Date()): string {
  const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/**
 * Parse a Jalali date string (accepts Persian digits, «/» or «-» separators)
 * into a Gregorian Date. `endOfDay` pushes it to 23:59:59 for range filters.
 */
export function parseJalali(input: string, endOfDay = false): Date | null {
  const parts = toEn(input.trim())
    .split(/[/\-.]/)
    .map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  const [jy, jm, jd] = parts as [number, number, number];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const g = toGregorian(jy, jm, jd);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function fmtJalaliLong(date: Date = new Date()): string {
  return `${WEEKDAYS_FA[date.getDay()]} ${fmtJalali(date)}`;
}
