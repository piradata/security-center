import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  href,
  tone = "neutral",
  className,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "unknown";
  className?: string;
}) {
  const TONE_BORDERS = {
    neutral: "border-zinc-200 dark:border-zinc-800",
    unknown: "border-zinc-200 dark:border-zinc-800",
    good: "border-emerald-200 dark:border-emerald-900/50",
    warn: "border-amber-200 dark:border-amber-900/50",
    bad: "border-red-200 dark:border-red-900/50",
    info: "border-sky-200 dark:border-sky-900/50",
  };

  const TONE_ICONS = {
    neutral: "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
    unknown: "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
    good: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60",
    warn: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60",
    bad: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60",
    info: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60",
  };

  const content = (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all sm:p-5 shadow-xs",
        TONE_BORDERS[tone],
        href &&
          "hover:border-zinc-300 hover:shadow-sm dark:hover:border-zinc-700 cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </p>
          <div className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl tabular-nums">
            {value}
          </div>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg p-2",
              TONE_ICONS[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {subtext && (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {subtext}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        {content}
      </Link>
    );
  }

  return content;
}
