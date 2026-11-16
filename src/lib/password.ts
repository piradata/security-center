import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = "scrypt";

function deriveKey(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

/**
 * Hash a password with scrypt. Format:
 * scrypt$N$r$p$saltHex$hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

/** Return false for malformed hashes instead of throwing. */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![n, r, p].every(Number.isSafeInteger)) return false;
  if (n < 2 || r < 1 || p < 1) return false;
  if (!/^[0-9a-f]+$/i.test(parts[4]) || !/^[0-9a-f]+$/i.test(parts[5])) {
    return false;
  }

  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (expected.length !== KEY_LENGTH) return false;

  try {
    const actual = await deriveKey(password, salt, n, r, p);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
