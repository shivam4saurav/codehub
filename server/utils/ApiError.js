/**
 * Operational (expected) error carrying an HTTP status code.
 * The central error handler trusts `isOperational` to decide how much detail
 * is safe to return to the client.
 */
export class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = options.code ?? undefined;
    this.details = options.details ?? undefined;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Invalid request', options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Authentication required', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'Not allowed', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Resource already exists', options) {
    return new ApiError(409, message, options);
  }

  static tooManyRequests(message = 'Too many requests', options) {
    return new ApiError(429, message, options);
  }

  static badGateway(message = 'Upstream source failed', options) {
    return new ApiError(502, message, options);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', options) {
    return new ApiError(503, message, options);
  }
}

export default ApiError;
