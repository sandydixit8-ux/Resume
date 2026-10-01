import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Backup encryption (AES-256-GCM, PBKDF2 key derivation).
 *
 * Backups contain the whole customer database: user emails, password hashes,
 * session hashes, content, and billing records. An unencrypted snapshot on
 * shared or synced storage is a data breach waiting to happen, so encryption
 * is on by default when a passphrase is configured.
 *
 * Uses `node:crypto` only -- no new dependency for a feature that is a few
 * lines of standard practice.
 *
 * scrypt is used to stretch the passphrase (N=2^15), not PBKDF2, because a
 * stolen backup and a GPU make a fast hash pointless. GCM is authenticated, so
 * tampering is detected rather than silently decrypting to garbage.
 *
 * Format: `RPKB1` | salt(16) | iv(12) | authTag(16) | ciphertext
 * The header and version let a future format change be detected rather than
 * silently misread.
 */

const MAGIC = Buffer.from("RPKB1", "ascii");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// scrypt needs 128 * N * r bytes, which is exactly 32 MiB at these
// parameters. Node's default maxmem is 32 MiB, so deriving a key throws
// ERR_CRYPTO_OPERATION_FAILED ("memory limit exceeded") unless maxmem is
// raised. Leaving this at the default means the first real backup fails.
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.BACKUP_PASSPHRASE?.trim());
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

export function encrypt(plaintext: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
}

export class DecryptError extends Error {}

export function decrypt(payload: Buffer, passphrase: string): Buffer {
  const headerLength = MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES;
  // `<` not `<=`: a payload of exactly headerLength is a valid encryption of an
  // empty plaintext, which is what a snapshot of an empty database produces.
  // Rejecting it would mean encrypt could emit something decrypt refuses.
  if (payload.length < headerLength || !payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new DecryptError("not a RankPilot encrypted backup (bad header)");
  }
  let offset = MAGIC.length;
  const salt = payload.subarray(offset, (offset += SALT_BYTES));
  const iv = payload.subarray(offset, (offset += IV_BYTES));
  const tag = payload.subarray(offset, (offset += TAG_BYTES));
  const ciphertext = payload.subarray(offset);

  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // Wrong passphrase or tampered file. Never say which: that would help an
    // attacker who is guessing passphrases against a stolen backup.
    throw new DecryptError("could not decrypt: wrong passphrase or corrupted file");
  }
}

export function isEncryptedPayload(payload: Buffer): boolean {
  return payload.length > MAGIC.length && payload.subarray(0, MAGIC.length).equals(MAGIC);
}
