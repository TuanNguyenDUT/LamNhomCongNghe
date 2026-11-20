/**
 * Typed domain and infrastructure error classes for HTTP & PostgreSQL propagation.
 */

class AppError extends Error {
  constructor(message, { httpStatus = 500, code = 'INTERNAL_ERROR', cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.httpStatus = httpStatus;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, { httpStatus: 400, code });
  }
}

class AuthenticationError extends AppError {
  constructor(message, code = 'AUTHENTICATION_ERROR') {
    super(message, { httpStatus: 401, code });
  }
}

class NotFoundError extends AppError {
  constructor(message, code = 'NOT_FOUND') {
    super(message, { httpStatus: 404, code });
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, { httpStatus: 409, code });
  }
}

class DatabaseConfigurationError extends AppError {
  constructor(message = 'PostgreSQL configuration missing: set DATABASE_URL, TEST_DATABASE_URL, or PGHOST') {
    super(message, { httpStatus: 500, code: 'DB_CONFIG_MISSING' });
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  DatabaseConfigurationError,
};
