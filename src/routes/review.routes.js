'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/review.controller');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  createReviewRules, importReviewRules, replyRules, reportRules,addReviewRules
} = require('../validators/review.validators');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Review creation, replies, moderation, and import
 */





router.get('/getscrapreview',
  authenticate, validate,
  ctrl.scrapreview
);


/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Submit a new review for an agent
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewCreate'
 *     responses:
 *       201:
 *         description: Review created (pending verification for native reviews)
 *       404:
 *         description: Agent not found
 *       409:
 *         description: Duplicate review
 *       422:
 *         description: Validation error
 */
router.post('/',
  authLimiter, optionalAuth,
  createReviewRules, validate,
  ctrl.createReview
);


/**
 * @swagger
 * /reviews/add:
 *   post:
 *     summary: Add review (custom API)
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewCreate'
 *     responses:
 *       201:
 *         description: Review added successfully
 *       404:
 *         description: Agent not found
 *       422:
 *         description: Validation error
 */
router.post(
  '/add', authenticate,
  authLimiter,
  optionalAuth,
  addReviewRules,
  validate,
  ctrl.addReview
);

/**
 * @swagger
 * /reviews/import:
 *   post:
 *     summary: Bulk import reviews from an external platform
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platform, reviews]
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [google, rew, ratemyagent, ratemyagentcom, facebook, zillow]
 *               reviews:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ReviewCreate'
 *     responses:
 *       200:
 *         description: Import summary (imported, skipped, total)
 */
router.post('/import',
  authenticate, authorize('agent', 'admin'),
  importReviewRules, validate,
  ctrl.importReviews
);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   get:
 *     summary: Get a single review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review object
 *       404:
 *         description: Not found
 */
router.get('/:reviewId',
  ctrl.getReview
);

/**
 * @swagger
 * /reviews/{reviewId}/reply:
 *   post:
 *     summary: Agent replies to a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [response]
 *             properties:
 *               response:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Reply saved and points awarded
 *       403:
 *         description: You do not own this agent profile
 *       404:
 *         description: Review not found
 */
router.post('/:reviewId/reply',
  authenticate, authorize('agent'),
  replyRules, validate,
  ctrl.replyToReview
);

/**
 * @swagger
 * /reviews/{reviewId}/report:
 *   post:
 *     summary: Report a review for moderation
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [fake, inappropriate, wrong_person, spam, other]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review reported
 */
router.post('/:reviewId/report',
  optionalAuth,
  reportRules, validate,
  ctrl.reportReview
);

/**
 * @swagger
 * /reviews/{reviewId}/verify:
 *   patch:
 *     summary: Admin verifies a native review (triggers point award)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review verified and points awarded
 *       403:
 *         description: Admin only
 */
router.put('/:reviewId/verify',
  authenticate, authorize('agent'),
  ctrl.verifyReview
);





module.exports = router;
