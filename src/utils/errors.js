'use strict';

class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name       = 'ApiError';
    this.statusCode = statusCode;
    this.details    = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const notFound  = (msg = 'Resource not found')    => new ApiError(404, msg);
const forbidden = (msg = 'Access denied')          => new ApiError(403, msg);
const badRequest = (msg = 'Bad request')           => new ApiError(400, msg);
const conflict  = (msg = 'Resource already exists')=> new ApiError(409, msg);
const unauth    = (msg = 'Unauthorized')            => new ApiError(401, msg);

module.exports = { ApiError, notFound, forbidden, badRequest, conflict, unauth };
