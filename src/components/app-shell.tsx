import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Boxes,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dashboardData, getSettings, logAction } from "@/lib/api";
import { fmtJalaliLong, fmtMoney, fmtNum } from "@/lib/format";
import { balanceOf } from "@/lib/domain";
import { GlobalSearch } from "@/components/global-search";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "داشبورد", icon: Gauge },
  { to: "/products", label: "قطعات", icon: Boxes },
  { to: "/invoices", label: "فاکتورها", icon: ClipboardList },
  { to: "/invoices/new", label: "ثبت فاکتور", icon: ShoppingCart },
  { to: "/customers", label: "مشتریان", icon: Users },
  { to: "/suppliers", label: "تأمین‌کنندگان", icon: Truck },
  { to: "/settings", label: "تنظیمات", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: overview } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardData });

  const alerts = useMemo(() => {
    const list: { id: string; tone: "warning" | "destructive"; title: string; body: string }[] = [];
    for (const p of overview?.products ?? []) {
      if (p.stock <= p.critical_level)
        list.push({
          id: `stock-${p.id}`,
          tone: "destructive",
          title: "موجودی بحرانی",
          body: `${p.name} — ${fmtNum(p.stock)} ${p.unit} باقی‌مانده`,
        });
    }
    for (const inv of overview?.invoices ?? []) {
      if (inv.payment_status === "unpaid" || inv.payment_status === "partial")
        list.push({
          id: `pay-${inv.id}`,
          tone: "warning",
          title: "پرداخت معوق",
          body: `${inv.number} — ${fmtMoney(balanceOf(Number(inv.total), Number(inv.paid_amount)))} تومان مانده`,
        });
    }
    return list.slice(0, 12);
  }, [overview]);

  // Optional idle auto-lock, configurable from settings (0 = off)
  useEffect(() => {
    const minutes = settings?.idle_lock_minutes ?? 0;
    if (!minutes) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
      }, minutes * 60_000);
    };
    const events = ["mousemove", "keydown", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [settings?.idle_lock_minutes, navigate]);

  async function signOut() {
    await logAction({ action: "auth.logout", summary: "خروج از پنل" });
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (user?.user_metadata?.["full_name"] as string | undefined)?.[0] ?? "م";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="shard -end-24 -top-32 size-[440px]" style={{ ["--shard-rotate" as string]: "-12deg" }} />
        <div className="shard -start-40 top-1/3 h-[560px] w-[360px]" style={{ ["--shard-rotate" as string]: "8deg", animationDuration: "15s" }} />
        <div className="shard end-1/4 -bottom-32 h-[380px] w-[520px]" style={{ ["--shard-rotate" as string]: "-6deg" }} />
      </div>

      <header className="glass-strong relative z-30 flex h-16 items-center gap-3 border-b border-border px-4">
        <button
          onClick={() => setNavOpen(true)}
          className="grid size-9 place-items-center rounded-lg ring-1 ring-border lg:hidden"
          aria-label="منو"
        >
          <Menu className="size-4" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-lg font-extrabold text-primary ring-1 ring-ring">
            ا
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-bold tracking-tight">{settings?.brand_name ?? "احمدی"}</p>
            <p className="text-[10px] text-ice-dim">پنل مدیریت قطعات</p>
          </div>
        </Link>

        <GlobalSearch />

        <div className="ms-auto flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              className="relative grid size-9 place-items-center rounded-lg bg-foreground/[0.04] text-ice-dim ring-1 ring-border"
              aria-label="اعلان‌ها"
            >
              <Bell className="size-4" />
              {alerts.length > 0 && (
                <span className="absolute start-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-surface" />
              )}
            </button>
            {bellOpen && (
              <div className="glass-strong absolute end-0 top-11 z-50 max-h-[60vh] w-80 overflow-auto rounded-xl p-2 shadow-2xl">
                <p className="px-2 py-1 text-[11px] font-semibold text-ice-faint">
                  اعلان‌ها ({fmtNum(alerts.length)})
                </p>
                {alerts.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-ice-faint">اعلانی نیست</p>
                )}
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "mb-1.5 rounded-lg p-2.5 ring-1",
                      a.tone === "destructive"
                        ? "bg-destructive/10 ring-destructive/25"
                        : "bg-warning/10 ring-warning/25",
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        a.tone === "destructive" ? "text-destructive" : "text-warning",
                      )}
                    >
                      {a.title}
                    </p>
                    <p className="mt-1 text-[11px] text-ice-dim">{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {initial}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-semibold">
                {(user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email}
              </p>
              <p className="text-[10px] text-ice-faint">مدیر کل</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="grid size-9 place-items-center rounded-lg bg-foreground/[0.04] text-ice-dim ring-1 ring-border hover:text-destructive"
            aria-label="خروج"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex">
        <aside className="glass-strong sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 border-e border-border p-3 lg:block">
          <SideNav pathname={pathname} />
          <div className="mt-4 rounded-xl bg-foreground/[0.03] p-3 ring-1 ring-border">
            <p className="text-[11px] text-ice-faint">امروز</p>
            <p className="mt-1 text-xs text-ice-dim">{fmtJalaliLong(new Date())}</p>
          </div>
        </aside>

        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-background/70"
              onClick={() => setNavOpen(false)}
              aria-label="بستن"
            />
            <aside className="glass-strong slide-panel absolute top-16 start-0 h-[calc(100vh-4rem)] w-64 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">منو</p>
                <button onClick={() => setNavOpen(false)} aria-label="بستن">
                  <X className="size-4" />
                </button>
              </div>
              <SideNav pathname={pathname} onNavigate={() => setNavOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 space-y-5 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function SideNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 text-sm">
      {NAV.map((item) => {
        const active =
          item.to === "/invoices"
            ? pathname === "/invoices" || pathname.startsWith("/invoices/")
            : pathname.startsWith(item.to);
        const isNew = item.to === "/invoices/new";
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5",
              (isNew ? pathname === "/invoices/new" : active && !(item.to === "/invoices" && pathname === "/invoices/new"))
                ? "bg-primary/15 font-semibold text-primary ring-1 ring-ring"
                : "text-ice-dim hover:bg-accent",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="flex items-center gap-2 px-3 pt-4 text-[11px] text-ice-faint">
        <Warehouse className="size-3.5" />
        همه مبالغ به تومان
      </div>
    </nav>
  );
}
