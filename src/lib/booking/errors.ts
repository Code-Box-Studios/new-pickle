/** Domain errors. Each carries the HTTP status the API layer should return. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400, "validation");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in required") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

/** Raised when the DB EXCLUDE constraint (or a pre-check) rejects an overlap. */
export class SlotTakenError extends AppError {
  constructor(message = "That slot was just taken. Please pick another time.") {
    super(message, 409, "slot_taken");
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message = "That action isn't allowed for this booking's status") {
    super(message, 409, "invalid_transition");
  }
}

/** Generic 409 for venue-side state conflicts (bad transition, edit-locked). */
export class ConflictError extends AppError {
  constructor(message = "That action conflicts with the current state") {
    super(message, 409, "conflict");
  }
}

export class HoldExpiredError extends AppError {
  constructor(message = "Your hold expired. Please start again.") {
    super(message, 410, "hold_expired");
  }
}
