import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("password hash verifies the original password", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert.equal(
    await verifyPassword("correct horse battery staple", hash),
    true,
  );
});

test("password hash rejects a wrong password", async () => {
  const hash = await hashPassword("correct horse battery staple");

  assert.equal(
    await verifyPassword("Correct horse battery staple", hash),
    false,
  );
  assert.equal(await verifyPassword("", hash), false);
});

test("password hashes use unique salts", async () => {
  const first = await hashPassword("same password");
  const second = await hashPassword("same password");

  assert.notEqual(first, second);
  assert.equal(await verifyPassword("same password", first), true);
  assert.equal(await verifyPassword("same password", second), true);
});

test("malformed password hashes never verify", async () => {
  assert.equal(await verifyPassword("anything", null), false);
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(
    await verifyPassword("anything", "scrypt$16384$8$1$salt$short"),
    false,
  );
});
