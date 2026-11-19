import type * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "open"
  | "in_progress"
  | "resolved"
  | "absent"
  | "suppressed"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  // Severities
  critical:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900/60",
  high: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900/60",
  medium:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60",
  low: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900/60",
  info: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",

  // Issue statuses
  open: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60",
  in_progress:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900/60",
  resolved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60",
  absent:
    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700",
  suppressed:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900/60",

  // Generic status
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900/60",
  neutral:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  info: "bg-zinc-400",
  open: "bg-blue-500",
  in_progress: "bg-purple-500",
  resolved: "bg-emerald-500",
  absent: "bg-zinc-400",
  suppressed: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-zinc-400",
};

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            DOT_COLORS[variant],
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
