import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; glow?: "A" | "B" | "C" | "D" | "F" | null }) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 relative overflow-hidden",
        interactive && "glass-hover cursor-pointer",
        glow && `trade-glow-${glow}`,
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "accent" | "danger" | "success";
  size?: "sm" | "default" | "lg";
}) {
  const variants = {
    default: "glass hover:bg-white/[0.06] text-[var(--fg)]",
    accent: "bg-[var(--up)] hover:bg-[var(--up-2)] text-black font-bold border border-[var(--up-2)] shadow-[0_0_24px_var(--up-glow)]",
    outline: "border border-[var(--border-hi)] hover:border-[var(--up)] hover:text-[var(--up)] text-[var(--fg)]",
    ghost: "hover:bg-white/5 text-[var(--fg)]",
    danger: "bg-[var(--down-bg)] hover:bg-[rgba(239,68,68,0.2)] text-[var(--down)] border border-[rgba(239,68,68,0.3)]",
    success: "bg-[var(--up-bg)] hover:bg-[rgba(16,185,129,0.2)] text-[var(--up)] border border-[rgba(16,185,129,0.3)]",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs h-8",
    default: "px-5 py-2.5 text-sm h-10",
    lg: "px-7 py-3.5 text-base h-12",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]",
        variants[variant], sizes[size], className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-[var(--border-hi)] text-sm outline-none focus:border-[var(--up)]/60 focus:ring-2 focus:ring-[var(--up)]/15 transition-all tabular text-[var(--fg)] placeholder:text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-[var(--border-hi)] text-sm outline-none focus:border-[var(--up)]/60 focus:ring-2 focus:ring-[var(--up)]/15 transition-all text-[var(--fg)] placeholder:text-[var(--muted)]",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-[var(--border-hi)] text-sm outline-none focus:border-[var(--up)]/60 focus:ring-2 focus:ring-[var(--up)]/15 transition-all text-[var(--fg)]",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-2",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
        className
      )}
      {...props}
    />
  );
}

export function Grade({
  value,
  size = "md",
  className,
}: {
  value: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "w-8 h-8 text-sm rounded-xl",
    md: "w-12 h-12 text-xl rounded-2xl",
    lg: "w-16 h-16 text-2xl rounded-2xl",
    xl: "w-24 h-24 text-5xl rounded-3xl",
  };
  const v = value ?? "?";
  const gradeClass = v === "A" ? "grade-A" : v === "B" ? "grade-B" : v === "C" ? "grade-C" : v === "D" ? "grade-D" : v === "F" ? "grade-F" : "";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center border font-black tracking-tight backdrop-blur-md",
        sizes[size], gradeClass, className
      )}
    >
      {v}
    </div>
  );
}

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-6xl mx-auto px-4 md:px-8", className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function Display({
  as: Comp = "h1",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: any }) {
  return <Comp className={cn("hero-title", className)} {...props} />;
}

export function EmptyState({
  eyebrow, title, description, action,
}: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 md:py-24 px-6 text-center max-w-lg mx-auto">
      {eyebrow && <div className="eyebrow mb-6">{eyebrow}</div>}
      <h3 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{title}</h3>
      {description && <p className="text-sm text-[var(--fg-dim)] leading-relaxed mb-8">{description}</p>}
      {action}
    </div>
  );
}

export function LivePulse({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--up)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--up)] pulse-dot" style={{ boxShadow: "0 0 8px var(--up)" }} />
      {label}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("divider-glow my-8", className)} />;
}

export function MetaCell({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "neutral" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">{label}</span>
      <span className={cn(
        "mono text-xl md:text-2xl font-bold mt-1",
        tone === "up" && "text-[var(--up)]",
        tone === "down" && "text-[var(--down)]"
      )}>
        {value}
      </span>
    </div>
  );
}
