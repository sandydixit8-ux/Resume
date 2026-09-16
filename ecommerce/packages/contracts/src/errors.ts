export const ErrorCode = {
  AUTH_INVALID: "AUTH_INVALID",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  AUTH_LOCKED: "AUTH_LOCKED",
  AUTH_OTP_INVALID: "AUTH_OTP_INVALID",
  AUTH_OTP_EXPIRED: "AUTH_OTP_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVENTORY_UNAVAILABLE: "INVENTORY_UNAVAILABLE",
  COUPON_INVALID: "COUPON_INVALID",
  COUPON_EXPIRED: "COUPON_EXPIRED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  UNPROCESSABLE: "UNPROCESSABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailureBody = {
  success: false;
  error: ApiErrorBody;
};

export type ApiResponse<T> = ApiSuccessBody<T> | ApiFailureBody;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PageQuery = {
  page?: number;
  pageSize?: number;
};

export type Direction = "asc" | "desc";

export type SortQuery = {
  sortBy?: string;
  direction?: Direction;
}