'use strict';
const config = require('../config');
const { ApiError } = require('../utils/errors');

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  // Known application error
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.statusCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 409, message: 'Resource already exists', detail: err.detail },
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: { code: 400, message: 'Referenced resource does not exist' },
    });
  }

  // Generic server error
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code:    500,
      message: 'Internal server error',
      ...(config.env === 'development' ? { stack: err.stack } : {}),
    },
  });
};

module.exports = { errorHandler };
