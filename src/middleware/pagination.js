'use strict';

/**
 * Parses ?page=1&limit=20 from query string.
 * Attaches req.pagination = { page, limit, offset }
 */
const pagination = (defaultLimit = 20, maxLimit = 100) => (req, _res, next) => {
  let page  = parseInt(req.query.page,  10) || 1;
  let limit = parseInt(req.query.limit, 10) || defaultLimit;
  if (page  < 1) page  = 1;
  if (limit < 1) limit = 1;
  if (limit > maxLimit) limit = maxLimit;
  req.pagination = { page, limit, offset: (page - 1) * limit };
  next();
};

module.exports = { pagination };
