import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/i;

function toBase64(value: Buffer) {
  return value.toString("base64");
}

function fromBase64(value: string) {
  return Buffer.from(value, "base64");
}

export function hashSecret(secret: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(secret, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    toBase64(salt),
    toBase64(key),
  ].join("$");
}

export function verifySecret(secret: string, encoded: string) {
  // Backward compatibility for legacy sha256 hashes.
  if (LEGACY_SHA256_RE.test(encoded)) {
    const legacy = createHash("sha256").update(secret).digest("hex");
    return timingSafeEqual(Buffer.from(legacy), Buffer.from(encoded));
  }

  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = fromBase64(parts[4] || "");
  const expectedKey = fromBase64(parts[5] || "");

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || !salt.length || !expectedKey.length) {
    return false;
  }

  const derived = scryptSync(secret, salt, expectedKey.length, { N: n, r, p });
  if (derived.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derived, expectedKey);
}

export function isLegacySecretHash(encoded: string) {
  return LEGACY_SHA256_RE.test(encoded);
}
