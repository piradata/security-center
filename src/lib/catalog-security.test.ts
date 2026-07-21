import assert from "node:assert/strict";
import test from "node:test";
import { effectiveToolConfig } from "./catalog";
import {
  bearerToken,
  generateServiceToken,
  hashServiceToken,
} from "./service-token";

test("service overrides win while unconfigured tools default on", () => {
  const tools = [
    { id: "gitleaks", key: "gitleaks", name: "Gitleaks" },
    { id: "npm", key: "npm-audit", name: "npm audit" },
    { id: "trivy", key: "trivy", name: "Trivy" },
  ];

  assert.deepEqual(
    effectiveToolConfig(
      tools,
      [
        { toolId: "gitleaks", enabled: true },
        { toolId: "npm", enabled: false },
      ],
      [
        { toolId: "gitleaks", enabled: false },
        { toolId: "npm", enabled: true },
      ],
    ).map(({ key, enabled, source }) => ({ key, enabled, source })),
    [
      { key: "gitleaks", enabled: false, source: "service" },
      { key: "npm-audit", enabled: true, source: "service" },
      { key: "trivy", enabled: true, source: "application" },
    ],
  );
});

test("tokens are random, hashable, and accepted only as strict bearer credentials", () => {
  const first = generateServiceToken();
  const second = generateServiceToken();

  assert.match(first, /^sc_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashServiceToken(first), /^[a-f0-9]{64}$/);
  assert.equal(bearerToken(`Bearer ${first}`), first);
  assert.equal(bearerToken(first), null);
  assert.equal(bearerToken(`Bearer ${first} trailing`), null);
});
