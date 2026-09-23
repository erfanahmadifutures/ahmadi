import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { getSettings, listAdmins, listAuditLogs, updateSettings } from "@/lib/api";
import { fmtJalali, fmtNum, jalaliInputValue, parseJalali, parseNum } from "@/lib/format";
import { AUDIT_ACTION_LABEL } from "@/lib/domain";
import { downloadCsv } from "@/lib/exports";
import { Empty, GhostButton, Panel, Pill, PrimaryButton } from "@/components/panel";
import { Field, Select } from "./products.index";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "تنظیمات — احمدی" },
      { name: "description", content: "اطلاعات برند، حد بحرانی پیش‌فرض، مدیران و لاگ تغییرات." },
      { property: "og:title", content: "تنظیمات — احمدی" },
      { property: "og:description", content: "تنظیمات برند، مدیران و لاگ کامل تغییرات پنل." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: admins } = useQuery({ queryKey: ["admins"], queryFn: listAdmins });

  const [form, setForm] = useState({
    brand_name: "",
    brand_phone: "",
    brand_address: "",
    default_critical_level: "5",
    idle_lock_minutes: "0",
  });

  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: logs } = useQuery({
    queryKey: ["audit", actor, action, from, to],
    queryFn: () =>
      listAuditLogs({
        actor,
        action,
        from: from ? parseJalali(from) : null,
        to: to ? parseJalali(to, true) : null,
      }),
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      brand_name: settings.brand_name,
      brand_phone: settings.brand_phone ?? "",
      brand_address: settings.brand_address ?? "",
      default_critical_level: String(settings.default_critical_level),
      idle_lock_minutes: String(settings.idle_lock_minutes),
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        brand_name: form.brand_name.trim() || "احمدی",
        brand_phone: form.brand_phone || null,
        brand_address: form.brand_address || null,
        default_critical_level: parseNum(form.default_critical_level),
        idle_lock_minutes: parseNum(form.idle_lock_minutes),
      }),
    onSuccess: () => {
      toast.success("تنظیمات ذخیره شد");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div>
        <h1 className="text-xl font-bold tracking-tight">تنظیمات</h1>
        <p className="mt-1 text-xs text-ice-dim">برند، حد بحرانی پیش‌فرض، مدیران و لاگ تغییرات</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="اطلاعات برند و فاکتور" bodyClassName="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="نام برند">
            <input
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              className="field h-10 w-full px-3 text-sm"
            />
          </Field>
          <Field label="شماره تماس">
            <input
              value={form.brand_phone}
              onChange={(e) => setForm({ ...form, brand_phone: e.target.value })}
              className="field num h-10 w-full px-3 text-sm"
            />
          </Field>
          <Field label="آدرس">
            <input
              value={form.brand_address}
              onChange={(e) => setForm({ ...form, brand_address: e.target.value })}
              className="field h-10 w-full px-3 text-sm"
            />
          </Field>
          <Field label="حد بحرانی پیش‌فرض">
            <input
              value={form.default_critical_level}
              onChange={(e) => setForm({ ...form, default_critical_level: e.target.value })}
              className="field num h-10 w-full px-3 text-sm"
            />
          </Field>
          <Field label="قفل خودکار بعد از بی‌کاری (دقیقه، ۰ = خاموش)">
            <input
              value={form.idle_lock_minutes}
              onChange={(e) => setForm({ ...form, idle_lock_minutes: e.target.value })}
              className="field num h-10 w-full px-3 text-sm"
            />
          </Field>
          <div className="sm:col-span-2">
            <PrimaryButton className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4" /> ذخیره تنظیمات
            </PrimaryButton>
          </div>
        </Panel>

        <Panel title="مدیران" subtitle="هر مدیر دسترسی کامل دارد" bodyClassName="divide-y divide-border">
          {(admins ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-2 px-4 py-3 text-sm">
              <span className="font-medium">{a.full_name ?? a.username ?? "مدیر"}</span>
              <span className="num text-[11px] text-ice-faint">{a.username ?? ""}</span>
              <Pill
                className={
                  a.is_active
                    ? "ms-auto bg-primary/10 text-primary ring-primary/25"
                    : "ms-auto bg-foreground/[0.05] text-ice-faint ring-border"
                }
              >
                {a.is_active ? "فعال" : "غیرفعال"}
              </Pill>
            </div>
          ))}
          {admins && admins.length === 0 && <Empty>مدیری ثبت نشده است</Empty>}
          <p className="px-4 py-3 text-[11px] text-ice-faint">
            افزودن مدیر جدید از طریق ثبت‌نام با ایمیل انجام می‌شود؛ هر حساب جدید به‌صورت خودکار نقش مدیر می‌گیرد.
          </p>
        </Panel>
      </div>

      <Panel
        title="لاگ تغییرات"
        action={
          <GhostButton
            onClick={() =>
              downloadCsv(
                "audit-logs",
                ["تاریخ", "مدیر", "عملیات", "توضیح"],
                (logs ?? []).map((l) => [
                  fmtJalali(l.created_at),
                  l.actor_name ?? "",
                  AUDIT_ACTION_LABEL[l.action] ?? l.action,
                  l.summary ?? "",
                ]),
              )
            }
          >
            <Download className="size-3.5" /> خروجی Excel
          </GhostButton>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Select
            value={actor}
            onChange={setActor}
            options={[
              ["all", "همه مدیران"],
              ...(admins ?? []).map((a) => [a.id, a.full_name ?? a.username ?? "مدیر"] as [string, string]),
            ]}
          />
          <Select
            value={action}
            onChange={setAction}
            options={[
              ["all", "همه عملیات"],
              ...Object.entries(AUDIT_ACTION_LABEL).map(([k, v]) => [k, v] as [string, string]),
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
          <span className="ms-auto self-center text-[11px] text-ice-faint">
            {fmtNum(logs?.length ?? 0)} رکورد
          </span>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          {(logs ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs last:border-0">
              <span className="num text-ice-faint">{fmtJalali(l.created_at)}</span>
              <span className="font-medium">{l.actor_name ?? "—"}</span>
              <Pill className="bg-foreground/[0.05] text-ice-dim ring-border">
                {AUDIT_ACTION_LABEL[l.action] ?? l.action}
              </Pill>
              <span className="text-ice-dim">{l.summary ?? ""}</span>
            </div>
          ))}
          {logs && logs.length === 0 && <Empty>لاگی با این فیلترها نیست</Empty>}
        </div>
      </Panel>
    </>
  );
}
