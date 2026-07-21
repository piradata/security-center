import {
  IssueSeverity,
  type IssueSeverity as Severity,
} from "@/generated/prisma/enums";
import {
  quoteShellArgument,
  type ToolCommand,
  toolRegistry,
} from "@/lib/tools";

const SCAN_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TOOL_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function parseProbe(value: unknown) {
  const payload = object(value, "probe");
  if (
    !Array.isArray(payload.availableTools) ||
    payload.availableTools.length > 50 ||
    payload.availableTools.some(
      (key) => typeof key !== "string" || !TOOL_KEY.test(key),
    )
  ) {
    throw new TypeError("availableTools must be an array of tool keys");
  }
  return { availableTools: [...new Set(payload.availableTools as string[])] };
}

export function filterPlannedToolKeys(
  registeredKeys: readonly string[],
  effective: readonly { key: string; enabled: boolean }[],
  availableKeys: readonly string[],
) {
  const available = new Set(availableKeys);
  const enabled = new Map(effective.map((tool) => [tool.key, tool.enabled]));
  return registeredKeys.filter(
    (key) => available.has(key) && enabled.get(key) === true,
  );
}

export function parseIngestPayload(value: unknown) {
  const payload = object(value, "ingest payload");
  const scanId = payload.scanId;
  const tool = payload.tool;
  if (
    scanId !== undefined &&
    (typeof scanId !== "string" || !SCAN_ID.test(scanId))
  ) {
    throw new TypeError("scanId is invalid");
  }
  if (typeof tool !== "string" || !TOOL_KEY.test(tool)) {
    throw new TypeError("tool is invalid");
  }
  if (!Object.hasOwn(payload, "result")) {
    throw new TypeError("result is required");
  }
  return { scanId: scanId as string | undefined, tool, result: payload.result };
}

export async function readBoundedJson(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new TypeError("Request body is too large");
  }
  if (!request.body) throw new TypeError("Request body is required");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new TypeError("Request body is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new TypeError("Request body must be valid UTF-8 JSON");
  }
}

export function evaluateGate(
  gate: { scoreThreshold: number | null; failOnNewHighCritical: boolean },
  score: number,
  findings: readonly {
    severity: Severity;
    isNewOrReopened: boolean;
  }[],
) {
  const reasons: string[] = [];
  if (gate.scoreThreshold !== null && score < gate.scoreThreshold) {
    reasons.push(`Score ${score} is below ${gate.scoreThreshold}`);
  }
  const newHighCritical = findings.filter(
    ({ severity, isNewOrReopened }) =>
      isNewOrReopened &&
      (severity === IssueSeverity.high || severity === IssueSeverity.critical),
  ).length;
  if (gate.failOnNewHighCritical && newHighCritical) {
    reasons.push(
      `${newHighCritical} new or reopened High/Critical issue${
        newHighCritical === 1 ? "" : "s"
      }`,
    );
  }
  return { passed: reasons.length === 0, newHighCritical, reasons };
}

const OUTPUT = "__SC_OUTPUT__";
const ROOT = "__SC_ROOT__";
const TOOLS = "__SC_TOOLS__";

function renderRunnerCommand(command: ToolCommand) {
  const variables: Record<string, string> = {
    [OUTPUT]: '"$output_file"',
    [ROOT]: '"$root"',
    [TOOLS]: '"$tools_dir"',
  };
  return command.argv
    .map((argument) => variables[argument] ?? quoteShellArgument(argument))
    .join(" ");
}

function runnerCase(key: string) {
  const adapter = toolRegistry.get(key)!;
  const install = adapter
    .install(TOOLS)
    .map((command) => `      ${renderRunnerCommand(command)}`)
    .join("\n");
  const run = renderRunnerCommand(
    adapter.run({ outputFile: OUTPUT, root: ROOT, toolsDir: TOOLS }),
  );
  const accepted = adapter
    .run({ outputFile: OUTPUT, root: ROOT, toolsDir: TOOLS })
    .acceptedExitCodes.join("|");

  return `    ${quoteShellArgument(key)})
      output_file="$tmp/${key}.json"
${install ? `${install}\n` : ""}      set +e
      ${run}
      scanner_status=$?
      set -e
      case "$scanner_status" in ${accepted}) ;; *) echo "${key} failed with exit $scanner_status" >&2; exit 1 ;; esac
      [ -s "$output_file" ] || { echo "${key} produced no JSON output" >&2; exit 1; }
      ;;`;
}

export function renderScanScript() {
  const adapters = toolRegistry.values();
  const probes = adapters
    .map(
      (adapter) =>
        `if ${adapter.detect(".").argv.map(quoteShellArgument).join(" ")} >/dev/null 2>&1; then add_available ${quoteShellArgument(adapter.key)}; fi`,
    )
    .join("\n");
  const cases = adapters.map(({ key }) => runnerCase(key)).join("\n");

  return `#!/usr/bin/env bash
set -euo pipefail
: "\${SC_URL:?SC_URL is required}"
: "\${SC_TOKEN:?SC_TOKEN is required}"

tmp=$(mktemp -d 2>/dev/null || mktemp -d -t security-center)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
api="\${SC_URL%/}/api/v1/ci"
root=.
tools_dir="$tmp/tools"
available=
add_available() {
  [ -z "$available" ] || available="$available,"
  available="$available\\"$1\\""
}

${probes}
printf '{"availableTools":[%s]}\\n' "$available" > "$tmp/probe.json"
curl -fsS -o "$tmp/plan" \\
  -H "Authorization: Bearer \${SC_TOKEN}" \\
  -H 'Content-Type: application/json' -H 'Accept: text/plain' \\
  --data-binary @"$tmp/probe.json" "$api/plan"

exec 3< "$tmp/plan"
IFS= read -r scan_id <&3
case "$scan_id" in ''|*[!A-Za-z0-9_-]*) echo "Invalid scan plan" >&2; exit 1 ;; esac

while IFS= read -r tool <&3; do
  [ -n "$tool" ] || continue
  case "$tool" in
${cases}
    *) echo "Plan returned an unknown tool" >&2; exit 1 ;;
  esac

  request_file="$tmp/$tool-request.json"
  {
    printf '{"scanId":"%s","tool":"%s","result":' "$scan_id" "$tool"
    cat "$output_file"
    printf '}\\n'
  } > "$request_file"
  curl -fsS -o /dev/null \\
    -H "Authorization: Bearer \${SC_TOKEN}" \\
    -H 'Content-Type: application/json' \\
    --data-binary @"$request_file" "$api/ingest"
done
exec 3<&-

set +e
gate_status=$(curl -sS -o "$tmp/gate.json" -w '%{http_code}' \\
  -H "Authorization: Bearer \${SC_TOKEN}" \\
  "$api/gate?scanId=$scan_id")
curl_status=$?
set -e
cat "$tmp/gate.json"
[ "$curl_status" -eq 0 ] && [ "$gate_status" = 200 ]
`;
}
