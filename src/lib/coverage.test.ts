import assert from "node:assert/strict";
import test from "node:test";
import { parseCoverageInput } from "./coverage";

test("parses full coverage input", () => {
  const result = parseCoverageInput({
    line: 85.4,
    branch: 72,
    function: "90.5",
    source: "vitest",
  });
  assert.deepEqual(result, {
    ok: true,
    value: { line: 85.4, branch: 72, function: 90.5, source: "vitest" },
  });
});

test("accepts line-only coverage", () => {
  const result = parseCoverageInput({ line: 100 });
  assert.deepEqual(result, {
    ok: true,
    value: { line: 100, branch: null, function: null, source: null },
  });
});

test("rejects invalid coverage", () => {
  assert.equal(parseCoverageInput(null).ok, false);
  assert.equal(parseCoverageInput({}).ok, false);
  assert.equal(parseCoverageInput({ line: -1 }).ok, false);
  assert.equal(parseCoverageInput({ line: 101 }).ok, false);
  assert.equal(parseCoverageInput({ line: 50, branch: "bad" }).ok, false);
});
