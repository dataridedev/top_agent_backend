'use strict';

const success = (res, data, statusCode = 200, meta = null) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

const paginated = (res, data, total, { page, limit }) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });
};

const created = (res, data) => success(res, data, 201);
const noContent = (res) => res.status(204).send();

module.exports = { success, paginated, created, noContent };
