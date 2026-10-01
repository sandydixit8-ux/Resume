import { describe, expect, it } from "vitest";
import { DecryptError, decrypt, encrypt, isEncryptedPayload } from "../../scripts/backup-crypto";

const PASSPHRASE = "correct horse battery staple";
// scrypt at N=2**15 is deliberately slow; give the real thing room and prove
// nothing meaningful depends on it being fast.
const TIMEOUT = 30_000;

describe("backup encryption", () => {
  it("round-trips a payload", () => {
    const original = Buffer.from("customer database bytes", "utf8");
    const restored = decrypt(encrypt(original, PASSPHRASE), PASSPHRASE);
    expect(restored.toString("utf8")).toBe("customer database bytes");
  }, TIMEOUT);

  it("round-trips binary and empty data", () => {
    const binary = Buffer.from([0, 255, 13, 10, 0, 128]);
    expect(decrypt(encrypt(binary, PASSPHRASE), PASSPHRASE)).toEqual(binary);
    const empty = Buffer.alloc(0);
    expect(decrypt(encrypt(empty, PASSPHRASE), PASSPHRASE)).toEqual(empty);
  }, TIMEOUT);

  it("produces different ciphertext each time for the same input", () => {
    // Random salt and IV. Identical ciphertext across runs would mean two
    // backups of the same data are linkable, and a fixed IV with GCM is
    // catastrophic: it leaks whether two plaintexts share a prefix.
    const a = encrypt(Buffer.from("same"), PASSPHRASE);
    const b = encrypt(Buffer.from("same"), PASSPHRASE);
    expect(a.equals(b)).toBe(false);
  }, TIMEOUT);

  it("rejects the wrong passphrase", () => {
    const sealed = encrypt(Buffer.from("secret"), PASSPHRASE);
    expect(() => decrypt(sealed, "wrong passphrase")).toThrow(DecryptError);
  }, TIMEOUT);

  it("rejects a tampered ciphertext", () => {
    // GCM's auth tag is the whole point: a flipped bit anywhere must fail
    // closed rather than silently returning corrupted plaintext.
    const sealed = encrypt(Buffer.from("secret data that matters"), PASSPHRASE);
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decrypt(tampered, PASSPHRASE)).toThrow(DecryptError);
  }, TIMEOUT);

  it("rejects a truncated payload", () => {
    const sealed = encrypt(Buffer.from("secret"), PASSPHRASE);
    expect(() => decrypt(sealed.subarray(0, 20), PASSPHRASE)).toThrow(DecryptError);
  }, TIMEOUT);

  it("rejects an unencrypted file instead of misreading it", () => {
    // Someone hands the restore path a plain .db; it must say so, not crash
    // somewhere inside the cipher with a confusing error.
    expect(() => decrypt(Buffer.from("SQLite format 3\0"), PASSPHRASE)).toThrow(
      /not a RankPilot encrypted backup/
    );
  });

  it("detects an encrypted payload by header", () => {
    expect(isEncryptedPayload(encrypt(Buffer.from("x"), PASSPHRASE))).toBe(true);
    expect(isEncryptedPayload(Buffer.from("SQLite format 3\0"))).toBe(false);
    expect(isEncryptedPayload(Buffer.alloc(0))).toBe(false);
  }, TIMEOUT);
});
