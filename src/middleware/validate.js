'use strict';
const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/errors');

/**
 * Runs after express-validator chains.
 * Collects errors and throws a 422 with structured detail.
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(e => ({
      field:   e.path,
      message: e.msg,
      value:   e.value,
    }));
    return next(new ApiError(422, 'Validation failed', details));
  }
  next();
};

module.exports = { validate };
