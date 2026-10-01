/**
 * Structured error codes.
 *
 * A stable, machine-readable vocabulary. Clients and dashboards can branch on
 * `error.code` without string-matching prose, and a typo becomes a type error
 * rather than a silently unmatched string in production.
 */

export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: "auth_required",
  AUTH_INVALID_CREDENTIALS: "auth_invalid_credentials",
  AUTH_FORBIDDEN: "forbidden",
  AUTH_RESET_TOKEN_INVALID: "invalid_token",
  AUTH_RESET_TOKEN_EXPIRED: "reset_token_expired",
  AUTH_RESET_TOKEN_USED: "reset_token_used",
  AUTH_VERIFY_TOKEN_INVALID: "verify_token_invalid",
  AUTH_VERIFY_TOKEN_EXPIRED: "verify_token_expired",
  AUTH_WEAK_PASSWORD: "weak_password",
  // Input
  VALIDATION_FAILED: "validation",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  // Availability
  RATE_LIMITED: "rate_limited",
  QUOTA_EXCEEDED: "quota_exceeded",
  UNAVAILABLE: "unavailable",
  DEPENDENCY_UNAVAILABLE: "dependency_unavailable",
  // Jobs
  JOB_FAILED: "job_failed",
  JOB_RETRY_EXHAUSTED: "job_retry_exhausted",
  // Fallback
  INTERNAL_ERROR: "server_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** HTTP status for each code, so a handler cannot return 200 with a 4xx code. */
export const CODE_STATUS: Record<ErrorCode, number> = {
  auth_required: 401,
  auth_invalid_credentials: 401,
  forbidden: 403,
  invalid_token: 400,
  reset_token_expired: 400,
  reset_token_used: 400,
  verify_token_invalid: 400,
  verify_token_expired: 400,
  weak_password: 400,
  validation: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  quota_exceeded: 402,
  unavailable: 503,
  dependency_unavailable: 503,
  job_failed: 500,
  job_retry_exhausted: 500,
  server_error: 500,
};
