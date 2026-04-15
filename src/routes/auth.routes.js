'use strict';
const router  = require('express').Router();
const ctrl    = require('../controllers/auth.controller');
const { authenticate }  = require('../middleware/auth');
const { validate }      = require('../middleware/validate');
const { authLimiter }   = require('../middleware/rateLimiter');
const {
  signupRules, loginRules, forgotPasswordRules,
  resetPasswordRules, changePasswordRules,
} = require('../validators/auth.validators');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & account management
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, first_name, last_name]
 *             properties:
 *               email:       { type: string, format: email }
 *               password:    { type: string, minLength: 8 }
 *               first_name:  { type: string }
 *               last_name:   { type: string }
 *               role:        { type: string, enum: [consumer, agent, brokerage] }
 *     responses:
 *       201:
 *         description: Account created
 *       409:
 *         description: Email already registered
 *       422:
 *         description: Validation error
 */
router.post('/signup',          authLimiter, signupRules,          validate, ctrl.signup);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive JWT tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Returns accessToken, refreshToken, and user object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login',           authLimiter, loginRules,           validate, ctrl.login);


/**
 * @swagger
 * /auth/social-login:
 *   post:
 *     summary: Login with Google or Facebook
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, token]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook]
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns JWT tokens and user object
 *       401:
 *         description: Invalid token
 */
router.post(
  '/social',authLimiter,ctrl.socialLogin);



/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh token and get new access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New accessToken and refreshToken
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh',                                                        ctrl.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout',                                                         ctrl.logout);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address via token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email/:token',                                             ctrl.verifyEmail);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent (always 200 to prevent enumeration)
 */
router.post('/forgot-password', authLimiter, forgotPasswordRules,  validate, ctrl.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using token from email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password',  authLimiter, resetPasswordRules,   validate, ctrl.resetPassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me',               authenticate,                                  ctrl.getMe);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change password (authenticated users)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password:     { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Incorrect current password
 */
router.put('/change-password',  authenticate, changePasswordRules,  validate, ctrl.changePassword);

module.exports = router;
