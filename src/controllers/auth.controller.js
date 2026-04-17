'use strict';
const authService = require('../services/auth.service');
const { success, created } = require('../utils/response');

const signup = async (req, res, next) => {
  try {
    console.log('Signup request body:', req.body); // Debug log
    const { user, verificationToken } = await authService.signup(req.body);
    // In production, send email with verificationToken
    created(res, { user, message: 'Account created. Please verify your email.' });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    success(res, result);
  } catch (err) { next(err); }
};

const socialLogin = async (req, res) => {
    try {
        console.log("authController socialLogin ::::");
        const userDoc = req.body;
        const response = await authService.socialAuth(userDoc);
     success(res, response);
    } catch (error) {next(err); }
};


const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(require('../utils/errors').badRequest('refreshToken is required'));
    const tokens = await authService.refreshTokens(refreshToken);
    success(res, tokens);
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    success(res, { message: 'Logged out successfully' });
  } catch (err) { next(err); }
};


const scrapezillowController = async (req, res) => {
  try {
    console.log("scrapezillowController :::");
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "url is required",
      });
    }

    const response = await  authService.scrapeZillowAgentProvider({
      url
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Scrape Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


const verifyEmail = async (req, res, next) => {
  try {
    await authService.verifyEmail(req.params.token);
    success(res, { message: 'Email verified successfully' });
  } catch (err) { next(err); }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    // Always return 200 to avoid email enumeration
    success(res, { message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    success(res, { message: 'Password reset successfully' });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
    success(res, { message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const { query } = require('../db/pool');
    const { rows } = await query(
      `SELECT id, email, first_name, last_name, role, avatar_url,
              is_verified, agent_id, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    success(res, rows[0]);
  } catch (err) { next(err); }
};

module.exports = { signup, login, refresh, logout, verifyEmail, forgotPassword, resetPassword, changePassword, getMe,socialLogin,scrapezillowController}
