import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

// AES-256-GCM field encryption for BVN/NIN. Format: v1.<iv>.<tag>.<ciphertext> (base64url)
function key(): Buffer {
  const k = process.env.FIELD_ENCRYPTION_KEY;
  if (!k) {
    if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") throw new Error("FIELD_ENCRYPTION_KEY is not set");
    return Buffer.alloc(32, 7); // development-only fallback
  }
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes (base64)");
  return b;
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptField(token: string): string {
  const [v, iv, tag, ct] = token.split(".");
  if (v !== "v1") throw new Error("Unknown cipher version");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Deterministic keyed hash so we can detect a BVN used twice without storing it in clear. */
export function identityHash(value: string): string {
  return createHmac("sha256", process.env.IDENTITY_HASH_SECRET ?? "dev-only-secret").update(value.trim()).digest("hex");
}

export const mask = (v: string, keep = 3) => (v.length <= keep ? v : "•".repeat(v.length - keep) + v.slice(-keep));
