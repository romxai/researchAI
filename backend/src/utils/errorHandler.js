/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  /**
   * Create a new API error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a new Bad Request error (400)
 * @param {string} message - Error message
 * @returns {ApiError} - API error object
 */
const badRequest = (message = "Bad Request") => {
  return new ApiError(message, 400);
};

/**
 * Create a new Not Found error (404)
 * @param {string} message - Error message
 * @returns {ApiError} - API error object
 */
const notFound = (message = "Resource Not Found") => {
  return new ApiError(message, 404);
};

/**
 * Create a new Internal Server Error (500)
 * @param {string} message - Error message
 * @returns {ApiError} - API error object
 */
const serverError = (message = "Internal Server Error") => {
  return new ApiError(message, 500);
};

/**
 * Create a new Unauthorized error (401)
 * @param {string} message - Error message
 * @returns {ApiError} - API error object
 */
const unauthorized = (message = "Unauthorized") => {
  return new ApiError(message, 401);
};

/**
 * Create a new Forbidden error (403)
 * @param {string} message - Error message
 * @returns {ApiError} - API error object
 */
const forbidden = (message = "Forbidden") => {
  return new ApiError(message, 403);
};

/**
 * Handle errors in async routes
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  badRequest,
  notFound,
  serverError,
  unauthorized,
  forbidden,
  asyncHandler,
};
