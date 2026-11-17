export type CoverageInput = {
  line: number;
  branch?: number | null;
  function?: number | null;
  source?: string | null;
};

type ParseResult =
  | { ok: true; value: CoverageInput }
  | { ok: false; error: string };

function percentage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error("percentages must be between 0 and 100");
  }
  return number;
}

export function parseCoverageInput(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "expected a JSON object" };
  }

  const record = body as Record<string, unknown>;

  let line: number;
  try {
    const parsed = percentage(record.line);
    if (parsed === null) return { ok: false, error: "line is required" };
    line = parsed;
  } catch {
    return { ok: false, error: "line must be a percentage" };
  }

  let branch: number | null;
  let fn: number | null;
  try {
    branch = percentage(record.branch);
    fn = percentage(record.function ?? record.functions);
  } catch {
    return { ok: false, error: "branch and function must be percentages" };
  }

  const source =
    typeof record.source === "string" && record.source.trim()
      ? record.source.trim().slice(0, 80)
      : null;

  return { ok: true, value: { line, branch, function: fn, source } };
}
