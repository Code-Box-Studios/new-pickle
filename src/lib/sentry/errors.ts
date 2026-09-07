import { AppError } from "@/lib/booking/errors";

// All Sentry integration failures normalize to AppError subclasses so the API
// layer returns a safe status/message. Messages NEVER include credentials,
// base URLs, or raw upstream payloads.

export class SentryAuthError extends AppError {
  constructor(message = "Sentry authentication failed") {
    super(message, 502, "sentry_auth");
  }
}
export class SentryUnavailableError extends AppError {
  constructor(message = "Sentry is temporarily unavailable") {
    super(message, 503, "sentry_unavailable");
  }
}
export class SentryRateLimitError extends AppError {
  constructor(message = "Sentry rate limit reached, please retry shortly") {
    super(message, 503, "sentry_rate_limit");
  }
}
export class SentryInvalidResourceError extends AppError {
  constructor(message = "The requested resource is not available on Sentry") {
    super(message, 404, "sentry_invalid_resource");
  }
}
export class SentryTimeoutError extends AppError {
  constructor(message = "Sentry request timed out") {
    super(message, 504, "sentry_timeout");
  }
}
export class SentryUnexpectedResponseError extends AppError {
  constructor(message = "Sentry returned an unexpected response") {
    super(message, 502, "sentry_unexpected");
  }
}
export class SentryContractUnavailableError extends AppError {
  constructor(message = "Sentry HTTP contract is not available in this environment") {
    super(message, 501, "sentry_contract_unavailable");
  }
}
export class SentryUnsupportedOperationError extends AppError {
  constructor(message = "This action isn't supported for Sentry-connected venues in this phase") {
    super(message, 409, "sentry_unsupported");
  }
}
