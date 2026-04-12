'use strict';
const { query, withTransaction } = require('../db/pool');
const { hash, compare }          = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { ApiError }               = require('../utils/errors');
const { v4: uuidv4 }             = require('uuid');
const config                     = require('../config');

// ─── Signup ───────────────────────────────────────────────────────────────────
const signup = async ({ email, password, first_name, last_name, role = 'consumer' }) => {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) throw new ApiError(409, 'Email already registered');

  const password_hash = await hash(password);

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, email, first_name, last_name, role`,
    [email, password_hash, first_name, last_name, role]
  );
  const user = rows[0];

  // Create verification token
  const token = uuidv4();
  await query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '24 hours')`,
    [user.id, token]
  );

  return { user, verificationToken: token };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const { rows } = await query(
    'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
    [email]
  );
  if (!rows.length) throw new ApiError(401, 'Invalid email or password');

  const user = rows[0];
  if (!user.is_active) throw new ApiError(401, 'Account is deactivated');
  if (!user.password_hash) throw new ApiError(401, 'Please sign in with Google');

  const valid = await compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  // Update last login
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const accessToken  = signAccess(user.id);
  const refreshToken = signRefresh(user.id);

  // Persist refresh token
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '30 days')`,
    [user.id, refreshToken]
  );

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
};

// ─── Refresh token ────────────────────────────────────────────────────────────
const refreshTokens = async (refreshToken) => {
  let payload;
  try { payload = verifyRefresh(refreshToken); }
  catch { throw new ApiError(401, 'Invalid or expired refresh token'); }

  const { rows } = await query(
    `SELECT id FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()`,
    [refreshToken]
  );
  if (!rows.length) throw new ApiError(401, 'Refresh token revoked or expired');

  // Rotate — revoke old, issue new
  await query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);

  const newAccess  = signAccess(payload.sub);
  const newRefresh = signRefresh(payload.sub);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '30 days')`,
    [payload.sub, newRefresh]
  );

  return { accessToken: newAccess, refreshToken: newRefresh };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (refreshToken) => {
  await query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);
};

// ─── Verify email ─────────────────────────────────────────────────────────────
const verifyEmail = async (token) => {
  const { rows } = await query(
    `SELECT user_id FROM email_verification_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [token]
  );
  if (!rows.length) throw new ApiError(400, 'Invalid or expired verification token');

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET is_verified = true WHERE id = $1', [rows[0].user_id]);
    await client.query('UPDATE email_verification_tokens SET used = true WHERE token = $1', [token]);
  });
};

// ─── Forgot password ──────────────────────────────────────────────────────────
const forgotPassword = async (email) => {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows.length) return null; // silently succeed (don't reveal email existence)

  const token = uuidv4();
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '1 hour')`,
    [rows[0].id, token]
  );
  return token;
};

// ─── Reset password ───────────────────────────────────────────────────────────
const resetPassword = async (token, newPassword) => {
  const { rows } = await query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [token]
  );
  if (!rows.length) throw new ApiError(400, 'Invalid or expired reset token');

  const password_hash = await hash(newPassword);
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);
    // Revoke all refresh tokens (security: force re-login everywhere)
    await client.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [rows[0].user_id]);
  });
};

// ─── Change password ──────────────────────────────────────────────────────────
const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await compare(currentPassword, rows[0].password_hash);
  if (!valid) throw new ApiError(401, 'Current password is incorrect');

  const password_hash = await hash(newPassword);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [password_hash, userId]);
};

module.exports = { signup, login, refreshTokens, logout, verifyEmail, forgotPassword, resetPassword, changePassword };
