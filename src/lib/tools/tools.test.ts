import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { IssueSeverity } from "@/generated/prisma/enums";
import {
  pipAuditAdapter,
  quoteShellArgument,
  renderShellCommand,
  semgrepAdapter,
  toolRegistry,
  trivyAdapter,
  type ToolAdapter,
} from "@/lib/tools";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8");

const cloneFixture = (name: string) =>
  JSON.parse(fixture(name)) as Record<string, unknown>;

function detects(adapter: ToolAdapter, root: string) {
  const { argv } = adapter.detect(root);
  return spawnSync(argv[0], argv.slice(1), { stdio: "ignore" }).status === 0;
}

test("detects only applicable project fixtures without interpolating paths", () => {
  const root = mkdtempSync(join(tmpdir(), "security-center-' ; "));
  try {
    assert.equal(pipAuditAdapter.detect(root).argv.at(-1), root);
    assert.equal(detects(pipAuditAdapter, root), false);
    assert.equal(detects(semgrepAdapter, root), false);
    assert.equal(detects(trivyAdapter, root), false);

    writeFileSync(join(root, "requirements.txt"), "requests==2.19.0\n");
    assert.equal(detects(pipAuditAdapter, root), true);
    assert.equal(detects(trivyAdapter, root), true);
    assert.equal(detects(semgrepAdapter, root), false);

    writeFileSync(join(root, "index.ts"), "export {};\n");
    assert.equal(detects(semgrepAdapter, root), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renders every command argument as one shell-safe word", () => {
  const unsafe = "report'; touch /tmp/not-created; #.json";
  assert.equal(
    quoteShellArgument(unsafe),
    `'report'"'"'; touch /tmp/not-created; #.json'`,
  );
  assert.match(
    renderShellCommand(
      pipAuditAdapter.run({ outputFile: unsafe, root: "repo with spaces" }),
    ),
    /'report'"'"'; touch \/tmp\/not-created; #\.json'/,
  );
  assert.throws(() => quoteShellArgument("bad\0argument"), /NUL/);
});

test("normalizes pip-audit dependencies and keeps identity version-independent", () => {
  const findings = pipAuditAdapter.normalize(fixture("pip-audit"));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].title, "PYSEC-2018-28 in requests");
  assert.equal(findings[0].severity, IssueSeverity.medium);

  const changed = cloneFixture("pip-audit");
  const dependency = (
    changed.dependencies as Array<Record<string, unknown>>
  )[0];
  dependency.version = "2.19.1";
  assert.equal(
    pipAuditAdapter.normalize(changed)[0].fingerprint,
    findings[0].fingerprint,
  );
});

test("normalizes all Trivy fs finding kinds with stable, redacted identities", () => {
  const findings = trivyAdapter.normalize(fixture("trivy"));
  assert.deepEqual(
    findings.map(({ severity: value }) => value),
    [IssueSeverity.high, IssueSeverity.medium, IssueSeverity.critical],
  );
  assert.deepEqual(
    findings.map(({ title }) => title),
    [
      "Example dependency vulnerability",
      "Container runs as root",
      "AWS access key",
    ],
  );
  assert.equal(JSON.stringify(findings[2].raw).includes("AKIAEXAMPLE"), false);

  const changed = cloneFixture("trivy");
  const result = (
    changed.Results as Array<Record<string, unknown>>
  )[0];
  const vulnerability = (
    result.Vulnerabilities as Array<Record<string, unknown>>
  )[0];
  vulnerability.InstalledVersion = "1.0.0-post1";
  vulnerability.Title = "Updated advisory title";
  assert.equal(
    trivyAdapter.normalize(changed)[0].fingerprint,
    findings[0].fingerprint,
  );
});

test("prefers Semgrep's engine fingerprint over mutable location text", () => {
  const findings = semgrepAdapter.normalize(fixture("semgrep"));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, IssueSeverity.high);

  const changed = cloneFixture("semgrep");
  const result = (
    changed.results as Array<Record<string, unknown>>
  )[0];
  (result.start as Record<string, unknown>).line = 40;
  (result.extra as Record<string, unknown>).message = "Updated message";
  assert.equal(
    semgrepAdapter.normalize(changed)[0].fingerprint,
    findings[0].fingerprint,
  );
});

test("exposes the three V1 adapters and runner exit-code expectations", () => {
  assert.deepEqual(
    toolRegistry.values().map(({ key }) => key),
    ["pip-audit", "trivy", "semgrep"],
  );
  assert.equal(toolRegistry.get("unknown"), undefined);
  assert.deepEqual(
    pipAuditAdapter.run({ outputFile: "pip.json" }).acceptedExitCodes,
    [0, 1],
  );
  assert.deepEqual(
    trivyAdapter.run({ outputFile: "trivy.json" }).acceptedExitCodes,
    [0],
  );
  assert.throws(
    () => semgrepAdapter.normalize("{not-json"),
    /not valid JSON/,
  );
});
