/**
 * Parse and validate pagination params from query string.
 * @param {object} query - req.query
 * @returns {{ page, limit, offset }}
 */
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
};

/**
 * Build ORDER BY clause safely from query params.
 * @param {object} query         - req.query
 * @param {string[]} allowedCols - Columns allowed for sorting
 * @param {string} defaultCol    - Default sort column
 * @param {string} defaultDir    - Default sort direction
 */
const getOrderBy = (query, allowedCols, defaultCol = 'created_at', defaultDir = 'DESC') => {
  const col = allowedCols.includes(query.sort_by) ? query.sort_by : defaultCol;
  const dir = ['ASC', 'DESC'].includes((query.order || '').toUpperCase())
    ? query.order.toUpperCase()
    : defaultDir;
  return `ORDER BY ${col} ${dir}`;
};

module.exports = { getPagination, getOrderBy };
