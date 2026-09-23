import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("glass overflow-hidden rounded-xl", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div>
            {title && <p className="text-sm font-bold">{title}</p>}
            {subtitle && <p className="mt-0.5 text-[11px] text-ice-faint">{subtitle}</p>}
          </div>
          {action && <div className="ms-auto flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "primary" | "warning" | "destructive";
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="glass rounded-xl p-4">
      <p className="text-xs text-ice-dim">{label}</p>
      <p className={cn("num mt-2 text-2xl font-bold tracking-tight", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ice-faint">{hint}</p>}
    </div>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-ice-faint">{children}</p>;
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground ring-1 ring-ring transition-[filter] hover:brightness-110 disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface-2/60 px-3 text-xs font-medium text-ice-dim ring-1 ring-border transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
