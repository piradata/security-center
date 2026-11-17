import { cn } from "@/lib/utils";

function Metric({ label, value }: { label: string; value: number | null }) {
  const width =
    value === null || !Number.isFinite(value)
      ? 0
      : Math.max(0, Math.min(100, value));

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
        <span className="font-semibold tabular-nums">
          {value === null ? "—" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function CoverageBar({
  line,
  branch,
  fn,
  source,
  compact = false,
  className,
}: {
  line: number | null | undefined;
  branch?: number | null;
  fn?: number | null;
  source?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const lineValue = line ?? null;
  const branchValue = branch ?? null;
  const fnValue = fn ?? null;

  if (compact) {
    return (
      <span
        className={cn(
          "shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium tabular-nums text-sky-800 dark:bg-sky-950 dark:text-sky-300",
          className,
        )}
      >
        Line {lineValue === null ? "—" : `${Math.round(lineValue)}%`}
      </span>
    );
  }

  if (lineValue === null && branchValue === null && fnValue === null) {
    return (
      <p className={cn("text-xs text-zinc-500", className)}>
        No coverage uploaded.
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Metric label="Line" value={lineValue} />
        <Metric label="Branch" value={branchValue} />
        <Metric label="Function" value={fnValue} />
      </div>
      {source ? (
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          Source: {source}
        </p>
      ) : null}
    </div>
  );
}
