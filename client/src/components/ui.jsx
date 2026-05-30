import { forwardRef } from "react";
import { Loader2, Sparkles } from "lucide-react";

const buttonVariants = {
  primary: "bg-ember text-white shadow-lift hover:-translate-y-0.5 hover:shadow-soft",
  dark: "bg-ink text-white shadow-soft hover:-translate-y-0.5",
  ghost: "bg-white/72 text-black/62 shadow-sm ring-1 ring-white/70 hover:-translate-y-0.5 hover:bg-white",
  soft: "bg-blush text-ember shadow-sm hover:-translate-y-0.5",
  moss: "bg-moss text-white shadow-soft hover:-translate-y-0.5",
};

export function Button({ children, className = "", variant = "primary", icon: Icon, loading = false, type = "button", ...props }) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:pointer-events-none disabled:opacity-50 ${buttonVariants[variant] || buttonVariants.primary} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export const IconButton = forwardRef(function IconButton({ children, className = "", label, type = "button", ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-2xl bg-white/76 text-black/60 shadow-sm ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
});

export function Badge({ children, className = "", tone = "neutral" }) {
  const tones = {
    neutral: "bg-white/70 text-black/52 ring-white/70",
    dark: "bg-ink text-white ring-ink/10",
    ember: "bg-blush text-ember ring-ember/10",
    moss: "bg-moss/10 text-moss ring-moss/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ring-1 ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "", as: Component = "section" }) {
  return <Component className={`glass-panel ${className}`}>{children}</Component>;
}

export function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-black/15 bg-white/72 p-8 text-center shadow-sm ring-1 ring-white/70">
      <Icon className="mx-auto h-7 w-7 text-ember" />
      <p className="mt-3 text-lg font-black">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-black/50">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-[1.5rem] ${className}`} />;
}

export function FieldShell({ children, className = "" }) {
  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-white/70 bg-white/74 px-4 py-3 shadow-sm ring-1 ring-white/60 focus-within:ring-2 focus-within:ring-ember/25 ${className}`}>
      {children}
    </div>
  );
}
