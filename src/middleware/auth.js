'use strict';
const jwt    = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/pool');
const { ApiError } = require('../utils/errors');

/**
 * Verify JWT and attach req.user = { id, email, role, agentId }
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }
    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const { rows } = await query(
      'SELECT id, email, role, agent_id, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length || !rows[0].is_active) {
      throw new ApiError(401, 'User not found or deactivated');
    }
    req.user = {
      id:      rows[0].id,
      email:   rows[0].email,
      role:    rows[0].role,
      agentId: rows[0].agent_id,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional auth — populates req.user if token present, never throws.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret);
    const { rows } = await query(
      'SELECT id, email, role, agent_id FROM users WHERE id = $1 AND is_active = true',
      [payload.sub]
    );
    if (rows.length) {
      req.user = { id: rows[0].id, email: rows[0].email, role: rows[0].role, agentId: rows[0].agent_id };
    }
  } catch (_) { /* swallow */ }
  next();
};

/**
 * Role-based access guard factory.
 * Usage: authorize('admin') or authorize('admin', 'agent')
 */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Insufficient permissions'));
  }
  next();
};

/**
 * Verify the requesting agent owns the agentId in the route param.
 * Works for /agents/:agentId/* routes.
 */
const ownsAgent = (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.role === 'admin') return next();
  const paramId = parseInt(req.params.agentId, 10);
  if (req.user.agentId !== paramId) {
    return next(new ApiError(403, 'You do not own this agent profile'));
  }
  next();
};

module.exports = { authenticate, optionalAuth, authorize, ownsAgent };
