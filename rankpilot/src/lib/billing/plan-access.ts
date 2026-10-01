/**
 * Access control for self-serve plan changes.
 *
 * Background: this build has no payment provider wired in. A naive
 * implementation would let any authenticated owner PATCH /api/billing to the
 * top tier and receive it for free -- unlimited websites, unlimited keywords,
 * thousands of AI generations. Because registration creates an organisation with
 * the registering user as its owner, an "owner only" permission check does not
 * prevent this at all; every new account is an owner.
 *
 * So a plan *upgrade* requires an explicit allowlist. The default is empty, which
 * means nobody is allowed, which is the correct default for a missing capability.
 * Downgrades remain permitted without the allowlist (see `isDowngrade`), because
 * refusing to let a customer reduce their commitment would be worse than the
 * original problem.
 */

export const SELF_SERVE_ENV = "BILLING_SELF_SERVE_EMAILS";

function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the given account is explicitly allowlisted to change its own plan
 * without a payment provider. Case-insensitive and whitespace tolerant, because
 * it is configured by a human in an env file.
 */
export function selfServeAllowed(
  userEmail: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const allowed = parseAllowlist(env[SELF_SERVE_ENV]);
  if (allowed.length === 0) return false;
  return allowed.includes(userEmail.trim().toLowerCase());
}
