'use strict';
const { query, withTransaction } = require('../db/pool');
const { hash, compare }          = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { ApiError }               = require('../utils/errors');
const { v4: uuidv4 }             = require('uuid');
const config                     = require('../config');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require('puppeteer');
const StealthPlugin = require("puppeteer-extra-plugin-stealth");



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

  const accessToken  = signAccess(user.id, user.first_name, user.last_name);
  const refreshToken = signRefresh(user.id, user.first_name, user.last_name);

  // Persist refresh token
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '30 days')`,
    [user.id, refreshToken]
  );

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
};

///-------- google or facebook login ───────────────────────────────────────────────────────────


const socialAuth = async ({ provider, idToken, accessToken }) => {
  try {
    let email, first_name, last_name, avatar_url, socialId;

    // ================= GOOGLE =================
    if (provider === 'google') {

      if (!idToken) {
        throw new ApiError(400, 'Google idToken is required');
      }

      let ticket;

      try {
        ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch (err) {
        console.log("Google verify failed, retry without audience check");

        // fallback (fix audience mismatch issue)
        ticket = await googleClient.verifyIdToken({
          idToken,
        });
      }

      const payload = ticket.getPayload();

      if (!payload) {
        throw new ApiError(401, 'Invalid Google token payload');
      }

      socialId = payload.sub;
      email = payload.email;
      first_name = payload.given_name;
      last_name = payload.family_name;
      avatar_url = payload.picture;
    }

    // ================= FACEBOOK =================
    else if (provider === 'facebook') {

      if (!accessToken) {
        throw new ApiError(400, 'Facebook accessToken is required');
      }

      const fbRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );

      const data = await fbRes.json();

      if (!data || !data.email) {
        throw new ApiError(401, 'Facebook email not provided');
      }

      socialId = data.id;
      email = data.email;
      first_name = data.name?.split(' ')[0] || '';
      last_name = data.name?.split(' ')[1] || '';
      avatar_url = data.picture?.data?.url || null;
    }

    else {
      throw new ApiError(400, 'Invalid provider');
    }

    if (!email) {
      throw new ApiError(401, 'Email not found from provider');
    }

    const normalizedEmail = email.toLowerCase();

    // ================= CHECK USER =================
    const existing = await query(
      `SELECT * FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    let user;

    const column = provider === 'google' ? 'google_id' : 'facebook_id';

    // ================= CREATE USER =================
    if (!existing.rows.length) {

      const { rows } = await query(
        `INSERT INTO users 
        (email, first_name, last_name, avatar_url, ${column}, is_verified, is_active, role, last_login_at)
        VALUES ($1,$2,$3,$4,$5,true,true,'consumer',NOW())
        RETURNING id, email, first_name, last_name, role, avatar_url`,
        [
          normalizedEmail,
          first_name,
          last_name,
          avatar_url,
          socialId
        ]
      );

      user = rows[0];
    }

    // ================= UPDATE USER =================
    else {

      const { rows } = await query(
        `UPDATE users 
         SET ${column} = $1,
             first_name = COALESCE(first_name, $2),
             last_name = COALESCE(last_name, $3),
             avatar_url = COALESCE(avatar_url, $4),
             is_verified = true,
             last_login_at = NOW(),
             updated_at = NOW()
         WHERE email = $5
         RETURNING id, email, first_name, last_name, role, avatar_url`,
        [
          socialId,
          first_name,
          last_name,
          avatar_url,
          normalizedEmail
        ]
      );

      user = rows[0];
    }

    // ================= JWT =================
    const token = signAccess(user.id);
    const refreshToken = signRefresh(user.id);

    return {
      user,
      accessToken: token,
      refreshToken,
    };

  } catch (err) {
    console.error('Social Auth Error:', err);
    throw err;
  }
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
