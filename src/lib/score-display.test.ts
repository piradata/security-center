import assert from "node:assert/strict";
import test from "node:test";
import { scoreLabel, scoreTone } from "./score-display";

test("score tones follow the configured thresholds", () => {
  assert.equal(scoreTone(100), "good");
  assert.equal(scoreTone(90), "good");
  assert.equal(scoreTone(89), "warn");
  assert.equal(scoreTone(70), "warn");
  assert.equal(scoreTone(69), "bad");
  assert.equal(scoreTone(0), "bad");
  assert.equal(scoreTone(null), "unknown");
  assert.equal(scoreTone(undefined), "unknown");
  assert.equal(scoreTone(Number.NaN), "unknown");
});

test("score labels are human readable", () => {
  assert.equal(scoreLabel(100), "Good");
  assert.equal(scoreLabel(75), "Needs attention");
  assert.equal(scoreLabel(20), "Critical");
  assert.equal(scoreLabel(null), "Not scanned");
});
