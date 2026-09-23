import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { PrimaryButton } from "@/components/panel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ورود مدیران — پنل احمدی" },
      {
        name: "description",
        content: "ورود امن مدیران به پنل مدیریت انبار و فاکتورهای قطعات میتسوبیشی احمدی.",
      },
      { property: "og:title", content: "ورود مدیران — پنل احمدی" },
      { property: "og:description", content: "ورود امن مدیران به پنل مدیریت قطعات احمدی." },
    ],
  }),
  component: AuthPage,
});

const MAX_TRIES = 5;
const LOCK_SECONDS = 120;

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("erfan.ahmadi788@gmail.com");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  const locked = Boolean(lockUntil && lockUntil > now);
  const remaining = locked ? Math.ceil((lockUntil! - now) / 1000) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);

    if (error) {
      const next = tries + 1;
      setTries(next);
      if (next >= MAX_TRIES) {
        setLockUntil(Date.now() + LOCK_SECONDS * 1000);
        setTries(0);
        toast.error("ورود موقتاً قفل شد. چند دقیقه بعد تلاش کنید.");
      } else {
        toast.error("نام کاربری یا رمز عبور اشتباه است.");
      }
      return;
    }

    setTries(0);
    await logAction({ action: "auth.login", summary: "ورود به پنل" });
    toast.success("خوش آمدید");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="shard -end-20 -top-24 size-[420px]" />
        <div className="shard -start-32 bottom-0 h-[520px] w-[340px]" style={{ animationDuration: "16s" }} />
      </div>

      <div className="glass-strong relative w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-xl font-extrabold text-primary ring-1 ring-ring">
            ا
          </div>
          <div>
            <p className="text-base font-bold tracking-tight">احمدی</p>
            <p className="text-[11px] text-ice-dim">پنل مدیریت قطعات میتسوبیشی</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="text-xs text-ice-dim">ایمیل مدیر</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field mt-1.5 h-10 w-full px-3 text-sm"
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ice-dim">رمز عبور</span>
            <div className="relative mt-1.5">
              <input
                type={showPass ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field h-10 w-full ps-3 pe-10 text-sm"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "پنهان کردن رمز" : "نمایش رمز"}
                className="absolute inset-y-0 end-2 grid place-items-center text-ice-dim transition-colors hover:text-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          <PrimaryButton type="submit" disabled={busy || locked} className="h-10 w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {locked ? `قفل موقت — ${fmtNum(remaining)} ثانیه` : "ورود به پنل"}
          </PrimaryButton>
        </form>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ice-faint">
          <ShieldCheck className="size-3.5" />
          پس از {fmtNum(MAX_TRIES)} تلاش ناموفق، ورود موقتاً قفل می‌شود.
        </p>
      </div>
    </div>
  );
}
