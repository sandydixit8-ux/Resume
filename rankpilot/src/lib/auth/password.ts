import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384;
const KEYLEN = 64;
/** Bounds on the cost parameter read back from a stored hash. */
const MIN_COST = 1024;
const MAX_COST = 1 << 20;

/**
 * Promisified scrypt. The async form matters: `scryptSync` burns CPU on the
 * event loop for the whole hash, and login is unauthenticated, so a burst of
 * concurrent attempts would stall every other request in the process.
 */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, KEYLEN, { N })).toString("hex");
  return `scrypt$${N}$${salt}$${hash}`;
}

/**
 * A syntactically valid stored hash that no password matches.
 *
 * Login must do the same amount of work whether or not the account exists, or
 * the response time alone enumerates registered emails: skipping the ~100ms
 * scrypt for an unknown address is a far louder signal than a uniform error
 * message. Verifying against this decoy costs the same and always fails.
 */
export const DECOY_HASH = `scrypt$${N}$${"00".repeat(16)}$${"00".repeat(64)}`;

/**
 * Parses a stored `scrypt$N$salt$hash` string, rejecting a cost parameter
 * outside the range this service issues. A tampered row must not be able to
 * turn a login into a cheap (brute-forceable) or unbounded (denial-of-service)
 * computation, so the bound is enforced before any hashing happens.
 */
export function parseScryptHash(stored: string): { n: number; salt: string; hash: Buffer } | null {
  const [algo, nStr, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return null;
  const n = Number(nStr);
  if (!Number.isInteger(n) || n < MIN_COST || n > MAX_COST) return null;
  const hash = Buffer.from(hex, "hex");
  if (hash.length === 0) return null;
  return { n, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseScryptHash(stored);
  if (!parsed) return false;
  const actual = await scryptAsync(password, parsed.salt, parsed.hash.length, { N: parsed.n });
  return timingSafeEqual(parsed.hash, actual);
}
