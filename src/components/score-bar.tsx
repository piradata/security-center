import { scoreLabel, scoreTone } from "@/lib/score-display";
import { cn } from "@/lib/utils";

const TONES = {
  unknown: {
    bar: "bg-zinc-300 dark:bg-zinc-700",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  good: {
    bar: "bg-emerald-500",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  warn: {
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  bad: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
} as const;

export function ScoreBar({
  value,
  label,
  threshold,
  compact = false,
  className,
}: {
  value: number | null | undefined;
  label?: string;
  threshold?: number | null;
  compact?: boolean;
  className?: string;
}) {
  const tone = TONES[scoreTone(value)];
  const width =
    value === null || value === undefined || !Number.isFinite(value)
      ? 0
      : Math.max(0, Math.min(100, value));

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </span>
        ) : null}
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            tone.badge,
          )}
        >
          {value ?? "—"}
        </span>
      </div>
      <div
        className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label={label ? `${label} score` : "Score"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={scoreLabel(value)}
      >
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${width}%` }}
        />
        {threshold !== null && threshold !== undefined ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-zinc-900 dark:bg-zinc-100"
            style={{ left: `${Math.max(0, Math.min(100, threshold))}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      {!compact ? (
        <p className="mt-1 text-xs text-zinc-500">{scoreLabel(value)}</p>
      ) : null}
    </div>
  );
}
