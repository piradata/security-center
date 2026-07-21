import assert from "node:assert/strict";
import test from "node:test";
import { IssueSeverity } from "@/generated/prisma/enums";
import {
  evaluateGate,
  filterPlannedToolKeys,
  parseIngestPayload,
  parseProbe,
  renderScanScript,
} from "@/lib/ci/pipeline";

test("validates probes and filters plans to available registered enabled tools", () => {
  const probe = parseProbe({
    availableTools: ["gitleaks", "npm-audit", "unknown"],
  });
  assert.deepEqual(
    filterPlannedToolKeys(
      ["gitleaks", "npm-audit"],
      [
        { key: "gitleaks", enabled: true },
        { key: "npm-audit", enabled: false },
        { key: "unknown", enabled: true },
      ],
      probe.availableTools,
    ),
    ["gitleaks"],
  );
  assert.throws(() => parseProbe({ availableTools: "gitleaks" }), /availableTools/);
  assert.throws(
    () => parseProbe({ availableTools: Array(51).fill("gitleaks") }),
    /availableTools/,
  );
});

test("validates bounded ingest identities before scanner normalization", () => {
  assert.deepEqual(
    parseIngestPayload({ scanId: "scan_1", tool: "npm-audit", result: {} }),
    { scanId: "scan_1", tool: "npm-audit", result: {} },
  );
  assert.throws(() => parseIngestPayload({ tool: "../command", result: {} }), /tool/);
  assert.throws(() => parseIngestPayload({ tool: "npm-audit" }), /result/);
});

test("gate fails only threshold breaches and current new or reopened high findings", () => {
  assert.deepEqual(
    evaluateGate(
      { scoreThreshold: 80, failOnNewHighCritical: true },
      79,
      [
        { severity: IssueSeverity.high, isNewOrReopened: false },
        { severity: IssueSeverity.medium, isNewOrReopened: true },
      ],
    ),
    { passed: false, newHighCritical: 0, reasons: ["Score 79 is below 80"] },
  );
  assert.deepEqual(
    evaluateGate(
      { scoreThreshold: 80, failOnNewHighCritical: true },
      100,
      [
        { severity: IssueSeverity.critical, isNewOrReopened: true },
        { severity: IssueSeverity.high, isNewOrReopened: true },
      ],
    ),
    {
      passed: false,
      newHighCritical: 2,
      reasons: ["2 new or reopened High/Critical issues"],
    },
  );
  assert.equal(
    evaluateGate(
      { scoreThreshold: null, failOnNewHighCritical: false },
      0,
      [{ severity: IssueSeverity.critical, isNewOrReopened: true }],
    ).passed,
    true,
  );
});

test("scan script is strict, cleans up, uses authenticated endpoints, and never embeds tokens", () => {
  const script = renderScanScript();
  assert.match(script, /^#!\/usr\/bin\/env bash\nset -euo pipefail/m);
  assert.match(script, /trap .*EXIT HUP INT TERM/);
  assert.match(script, /\/plan/);
  assert.match(script, /\/ingest/);
  assert.match(script, /\/gate/);
  assert.match(script, /\$\{SC_TOKEN/);
  assert.doesNotMatch(script, /sc_[A-Za-z0-9_-]{43}/);
  assert.doesNotMatch(script, /\beval\b/);
});
