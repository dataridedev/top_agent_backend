'use strict';
const rateLimit = require('express-rate-limit');
const config    = require('../config');

const defaultLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: { code: 429, message: 'Too many requests, please try again later.' } },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: { code: 429, message: 'Too many authentication attempts.' } },
});

const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 429, message: 'Search rate limit exceeded.' } },
});

module.exports = { defaultLimiter, authLimiter, searchLimiter };
