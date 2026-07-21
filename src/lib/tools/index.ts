import { createHash } from "node:crypto";
import {
  IssueSeverity,
  type IssueSeverity as Severity,
} from "@/generated/prisma/enums";
import type { Finding } from "@/lib/reconcile-state";

export type ToolCommand = {
  argv: readonly string[];
  acceptedExitCodes: readonly number[];
};

export type RunOptions = {
  outputFile: string;
  root?: string;
  toolsDir?: string;
};

export type ToolAdapter = {
  key: string;
  detect(root?: string): ToolCommand;
  install(toolsDir?: string): readonly ToolCommand[];
  run(options: RunOptions): ToolCommand;
  normalize(rawJson: unknown): Finding[];
};

const DEFAULT_TOOLS_DIR = ".security-center/tools";

function command(
  argv: readonly string[],
  acceptedExitCodes: readonly number[] = [0],
): ToolCommand {
  return { argv, acceptedExitCodes };
}

export function quoteShellArgument(value: string) {
  if (value.includes("\0"))
    throw new TypeError("Shell arguments cannot contain NUL");
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function renderShellCommand({ argv }: ToolCommand) {
  if (!argv.length) throw new TypeError("A command requires an executable");
  return argv.map(quoteShellArgument).join(" ");
}

function parseJson(rawJson: unknown) {
  if (typeof rawJson !== "string") return rawJson;
  try {
    return JSON.parse(rawJson) as unknown;
  } catch {
    throw new TypeError("Scanner output is not valid JSON");
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizedPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function fingerprint(tool: string, ...identity: unknown[]) {
  return `${tool}:${createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex")}`;
}

function severity(value: unknown, fallback: Severity = IssueSeverity.info) {
  switch (text(value)?.toLowerCase()) {
    case "critical":
      return IssueSeverity.critical;
    case "error":
    case "high":
      return IssueSeverity.high;
    case "warning":
    case "medium":
    case "moderate":
      return IssueSeverity.medium;
    case "low":
      return IssueSeverity.low;
    case "info":
      return IssueSeverity.info;
    default:
      return fallback;
  }
}

const pythonExecutable = (toolsDir: string) => `${toolsDir}/python/bin/python`;

export const gitleaksAdapter: ToolAdapter = {
  key: "gitleaks",
  detect(root = ".") {
    return command(["git", "-C", root, "rev-parse", "--is-inside-work-tree"]);
  },
  install(toolsDir = DEFAULT_TOOLS_DIR) {
    return [
      command(["mkdir", "-p", `${toolsDir}/bin`]),
      command([
        "sh",
        "-c",
        'set -eu; dir=$1; version=8.24.3; os=$(uname -s | tr "[:upper:]" "[:lower:]"); case $(uname -m) in x86_64|amd64) arch=x64 ;; arm64|aarch64) arch=arm64 ;; *) exit 2 ;; esac; case "$os" in linux|darwin) ;; *) exit 2 ;; esac; archive="$dir/gitleaks.tar.gz"; curl -fsSL -o "$archive" "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_${os}_${arch}.tar.gz"; tar -xzf "$archive" -C "$dir/bin" gitleaks; rm -f "$archive"',
        "security-center-gitleaks-install",
        toolsDir,
      ]),
    ];
  },
  run({ outputFile, root = ".", toolsDir = DEFAULT_TOOLS_DIR }: RunOptions) {
    return command(
      [
        `${toolsDir}/bin/gitleaks`,
        "git",
        "--no-banner",
        "--report-format",
        "json",
        "--report-path",
        outputFile,
        root,
      ],
      [0, 1],
    );
  },
  normalize(rawJson) {
    return array(parseJson(rawJson), "Gitleaks output").map((findingValue) => {
      const finding = record(findingValue, "Gitleaks finding");
      const ruleId = text(finding.RuleID);
      const path = text(finding.File);
      const startLine =
        typeof finding.StartLine === "number" ? finding.StartLine : undefined;
      if (!ruleId || !path || startLine === undefined) {
        throw new TypeError(
          "Gitleaks finding requires rule id, file, and line",
        );
      }
      const engineFingerprint = text(finding.Fingerprint);
      const secret = text(finding.Secret);
      const match = text(finding.Match);
      const sensitive = [secret, match].filter((value): value is string =>
        Boolean(value),
      );
      const redact = (value: string | undefined) =>
        sensitive.reduce(
          (sanitized, secretValue) =>
            sanitized?.replaceAll(secretValue, "[redacted]"),
          value,
        );
      const safePath = redact(normalizedPath(path))!;

      return {
        fingerprint: fingerprint(
          "gitleaks",
          engineFingerprint ?? [ruleId, normalizedPath(path), startLine],
        ),
        title: `${redact(ruleId)} secret in ${safePath}`,
        description: redact(text(finding.Description)),
        severity: IssueSeverity.high,
        raw: Object.fromEntries(
          Object.entries({
            ruleId: redact(ruleId),
            file: safePath,
            startLine,
            endLine:
              typeof finding.EndLine === "number" ? finding.EndLine : undefined,
            startColumn:
              typeof finding.StartColumn === "number"
                ? finding.StartColumn
                : undefined,
            endColumn:
              typeof finding.EndColumn === "number"
                ? finding.EndColumn
                : undefined,
            fingerprint: redact(engineFingerprint),
            tags: Array.isArray(finding.Tags)
              ? finding.Tags.map((tag) =>
                  typeof tag === "string" ? redact(tag) : tag,
                )
              : undefined,
          }).filter(([, value]) => value !== undefined),
        ),
      };
    });
  },
};

export const npmAuditAdapter: ToolAdapter = {
  key: "npm-audit",
  // ponytail: root lockfile only; add workspace discovery if CI needs per-package audits.
  detect(root = ".") {
    return command(["test", "-f", `${root}/package-lock.json`]);
  },
  install() {
    return [];
  },
  run({ outputFile, root = "." }: RunOptions) {
    return command(
      [
        "sh",
        "-c",
        'cd "$1"; exec npm audit --json > "$2"',
        "security-center-npm-audit-run",
        root,
        outputFile,
      ],
      [0, 1],
    );
  },
  normalize(rawJson) {
    const output = record(parseJson(rawJson), "npm audit output");
    const vulnerabilities = record(
      output.vulnerabilities ?? {},
      "npm audit vulnerabilities",
    );

    return Object.entries(vulnerabilities).map(([key, vulnerabilityValue]) => {
      const vulnerability = record(
        vulnerabilityValue,
        "npm audit vulnerability",
      );
      const name = text(vulnerability.name) ?? key;
      const via = array(vulnerability.via ?? [], "npm audit vulnerability via");
      const advisories = via.flatMap((value) =>
        typeof value === "string"
          ? [{ identity: value, title: value }]
          : (() => {
              const advisory = record(value, "npm audit advisory");
              const identity =
                advisory.source ??
                advisory.url ??
                advisory.name ??
                advisory.title;
              return identity === undefined
                ? []
                : [
                    {
                      identity,
                      title: text(advisory.title) ?? text(advisory.name),
                    },
                  ];
            })(),
      );
      const identities = advisories
        .map(({ identity }) => identity)
        .sort((a, b) => String(a).localeCompare(String(b)));
      const title =
        advisories.map((advisory) => advisory.title).find(Boolean) ??
        `${name} vulnerability`;

      return {
        fingerprint: fingerprint("npm-audit", name, identities),
        title,
        description:
          advisories
            .map((advisory) => advisory.title)
            .filter((value): value is string => Boolean(value))
            .join("; ") || undefined,
        severity: severity(vulnerability.severity, IssueSeverity.medium),
        raw: vulnerability,
      };
    });
  },
};

export const pipAuditAdapter: ToolAdapter = {
  key: "pip-audit",
  // ponytail: root metadata only; add manifest discovery if monorepos need it.
  detect(root = ".") {
    return command([
      "sh",
      "-c",
      '[ -f "$1/pyproject.toml" ] || [ -f "$1/requirements.txt" ] || [ -f "$1/setup.py" ] || [ -f "$1/setup.cfg" ]',
      "security-center-pip-audit-detect",
      root,
    ]);
  },
  install(toolsDir = DEFAULT_TOOLS_DIR) {
    const python = pythonExecutable(toolsDir);
    return [
      command(["mkdir", "-p", toolsDir]),
      command(["python3", "-m", "venv", `${toolsDir}/python`]),
      command([
        python,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "pip-audit",
      ]),
    ];
  },
  run({ outputFile, root = ".", toolsDir = DEFAULT_TOOLS_DIR }: RunOptions) {
    return command(
      [
        "sh",
        "-c",
        'root=$1; output=$2; python=$3; if [ -f "$root/requirements.txt" ]; then set -- -r "$root/requirements.txt"; else set -- "$root"; fi; exec "$python" -m pip_audit --progress-spinner off --format json --output "$output" "$@"',
        "security-center-pip-audit-run",
        root,
        outputFile,
        pythonExecutable(toolsDir),
      ],
      [0, 1],
    );
  },
  normalize(rawJson) {
    const parsed = parseJson(rawJson);
    const dependencies = Array.isArray(parsed)
      ? parsed
      : array(record(parsed, "pip-audit output").dependencies, "dependencies");

    return dependencies.flatMap((dependencyValue) => {
      const dependency = record(dependencyValue, "pip-audit dependency");
      const name = text(dependency.name);
      if (!name) throw new TypeError("pip-audit dependency requires a name");

      return array(dependency.vulns ?? [], "dependency vulnerabilities").map(
        (vulnerabilityValue) => {
          const vulnerability = record(
            vulnerabilityValue,
            "pip-audit vulnerability",
          );
          const id = text(vulnerability.id);
          if (!id)
            throw new TypeError("pip-audit vulnerability requires an id");

          return {
            fingerprint: fingerprint("pip-audit", name, id),
            title: `${id} in ${name}`,
            description: text(vulnerability.description),
            // pip-audit JSON has no severity score.
            severity: IssueSeverity.medium,
            raw: { dependency, vulnerability },
          };
        },
      );
    });
  },
};

export const trivyAdapter: ToolAdapter = {
  key: "trivy",
  detect(root = ".") {
    return command([
      "sh",
      "-c",
      'find "$1" -type f -print -quit | grep -q .',
      "security-center-trivy-detect",
      root,
    ]);
  },
  install(toolsDir = DEFAULT_TOOLS_DIR) {
    const installer = `${toolsDir}/trivy-install.sh`;
    return [
      command(["mkdir", "-p", `${toolsDir}/bin`]),
      command([
        "curl",
        "-fsSL",
        "-o",
        installer,
        "https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh",
      ]),
      command(["sh", installer, "-b", `${toolsDir}/bin`]),
      command(["rm", "-f", installer]),
    ];
  },
  run({ outputFile, root = ".", toolsDir = DEFAULT_TOOLS_DIR }: RunOptions) {
    return command([
      `${toolsDir}/bin/trivy`,
      "fs",
      "--scanners",
      "vuln,misconfig,secret",
      "--format",
      "json",
      "--output",
      outputFile,
      root,
    ]);
  },
  normalize(rawJson) {
    const output = record(parseJson(rawJson), "Trivy output");
    const results = array(output.Results ?? [], "Trivy results");
    const findings: Finding[] = [];

    for (const resultValue of results) {
      const result = record(resultValue, "Trivy result");
      const target = normalizedPath(text(result.Target) ?? ".");

      for (const vulnerabilityValue of array(
        result.Vulnerabilities ?? [],
        "Trivy vulnerabilities",
      )) {
        const vulnerability = record(vulnerabilityValue, "Trivy vulnerability");
        const id = text(vulnerability.VulnerabilityID);
        const packageName = text(vulnerability.PkgName);
        if (!id || !packageName) {
          throw new TypeError("Trivy vulnerability requires an id and package");
        }
        findings.push({
          fingerprint: fingerprint(
            "trivy",
            "vulnerability",
            target,
            packageName,
            id,
          ),
          title: text(vulnerability.Title) ?? `${id} in ${packageName}`,
          description: text(vulnerability.Description),
          severity: severity(vulnerability.Severity),
          raw: { target, vulnerability },
        });
      }

      for (const misconfigurationValue of array(
        result.Misconfigurations ?? [],
        "Trivy misconfigurations",
      )) {
        const misconfiguration = record(
          misconfigurationValue,
          "Trivy misconfiguration",
        );
        const id = text(misconfiguration.ID) ?? text(misconfiguration.AVDID);
        if (!id) throw new TypeError("Trivy misconfiguration requires an id");
        const cause = record(
          misconfiguration.CauseMetadata ?? {},
          "Trivy cause metadata",
        );
        const resource = text(cause.Resource) ?? "";
        findings.push({
          fingerprint: fingerprint(
            "trivy",
            "misconfiguration",
            target,
            id,
            resource,
          ),
          title: text(misconfiguration.Title) ?? id,
          description:
            text(misconfiguration.Message) ??
            text(misconfiguration.Description),
          severity: severity(misconfiguration.Severity),
          raw: { target, misconfiguration },
        });
      }

      for (const secretValue of array(result.Secrets ?? [], "Trivy secrets")) {
        const secret = record(secretValue, "Trivy secret");
        const ruleId = text(secret.RuleID);
        if (!ruleId) throw new TypeError("Trivy secret requires a rule id");
        const startLine =
          typeof secret.StartLine === "number" ? secret.StartLine : null;
        const sanitizedSecret = Object.fromEntries(
          Object.entries(secret).map(([key, value]) =>
            key === "Match" || key === "Code"
              ? [key, "[redacted]"]
              : [key, value],
          ),
        );
        findings.push({
          fingerprint: fingerprint(
            "trivy",
            "secret",
            target,
            ruleId,
            startLine,
          ),
          title: text(secret.Title) ?? ruleId,
          severity: severity(secret.Severity, IssueSeverity.high),
          raw: { target, secret: sanitizedSecret },
        });
      }
    }

    return findings;
  },
};

export const semgrepAdapter: ToolAdapter = {
  key: "semgrep",
  detect(root = ".") {
    return command([
      "sh",
      "-c",
      "find \"$1\" -type f \\( -name '*.c' -o -name '*.cc' -o -name '*.cpp' -o -name '*.cs' -o -name '*.go' -o -name '*.java' -o -name '*.js' -o -name '*.jsx' -o -name '*.php' -o -name '*.py' -o -name '*.rb' -o -name '*.rs' -o -name '*.ts' -o -name '*.tsx' \\) -print -quit | grep -q .",
      "security-center-semgrep-detect",
      root,
    ]);
  },
  install(toolsDir = DEFAULT_TOOLS_DIR) {
    const python = pythonExecutable(toolsDir);
    return [
      command(["mkdir", "-p", toolsDir]),
      command(["python3", "-m", "venv", `${toolsDir}/python`]),
      command([
        python,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "semgrep",
      ]),
    ];
  },
  run({ outputFile, root = ".", toolsDir = DEFAULT_TOOLS_DIR }: RunOptions) {
    return command([
      `${toolsDir}/python/bin/semgrep`,
      "scan",
      "--config",
      "auto",
      "--metrics",
      "off",
      "--json",
      "--output",
      outputFile,
      root,
    ]);
  },
  normalize(rawJson) {
    const output = record(parseJson(rawJson), "Semgrep output");
    return array(output.results ?? [], "Semgrep results").map((resultValue) => {
      const result = record(resultValue, "Semgrep result");
      const extra = record(result.extra, "Semgrep result extra");
      const start = record(result.start, "Semgrep result start");
      const checkId = text(result.check_id);
      const path = text(result.path);
      const line = typeof start.line === "number" ? start.line : undefined;
      const column = typeof start.col === "number" ? start.col : undefined;
      if (!checkId || !path || line === undefined) {
        throw new TypeError("Semgrep result requires check id, path, and line");
      }
      const engineFingerprint = text(extra.fingerprint);

      return {
        fingerprint: fingerprint(
          "semgrep",
          checkId,
          normalizedPath(path),
          engineFingerprint ?? [line, column],
        ),
        title: text(extra.message) ?? checkId,
        description: text(extra.message),
        severity: severity(extra.severity, IssueSeverity.medium),
        raw: result,
      };
    });
  },
};

export function createToolRegistry(adapters: readonly ToolAdapter[]) {
  const byKey = new Map<string, ToolAdapter>();
  for (const adapter of adapters) {
    if (byKey.has(adapter.key)) {
      throw new TypeError(`Duplicate tool adapter: ${adapter.key}`);
    }
    byKey.set(adapter.key, adapter);
  }
  return {
    get: (key: string) => byKey.get(key),
    values: () => [...byKey.values()],
  };
}

export const toolRegistry = createToolRegistry([
  gitleaksAdapter,
  npmAuditAdapter,
  pipAuditAdapter,
  trivyAdapter,
  semgrepAdapter,
]);
