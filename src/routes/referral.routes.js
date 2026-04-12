'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/referral.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');
const { pagination } = require('../middleware/pagination');
const {
  createReferralRules, respondReferralRules,
  completeReferralRules, listReferralsQuery,
} = require('../validators/referral.validators');

/**
 * @swagger
 * tags:
 *   name: Referrals
 *   description: Peer-to-peer agent referral marketplace
 */

/**
 * @swagger
 * /referrals:
 *   get:
 *     summary: List referrals for the authenticated agent
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: direction
 *         schema: { type: string, enum: [sent, received, all], default: all }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, DECLINED, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated referrals
 */
router.get('/',
  authenticate, authorize('agent', 'admin'),
  listReferralsQuery, validate,
  pagination(),
  ctrl.listReferrals
);

/**
 * @swagger
 * /referrals:
 *   post:
 *     summary: Send a new referral to another agent
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReferralCreate'
 *     responses:
 *       201:
 *         description: Referral created with PENDING status
 *       400:
 *         description: Cannot refer to yourself
 *       404:
 *         description: One or both agents not found
 */
router.post('/',
  authenticate, authorize('agent'),
  createReferralRules, validate,
  ctrl.createReferral
);

/**
 * @swagger
 * /referrals/{referralId}:
 *   get:
 *     summary: Get referral details
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referralId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Referral object with sender/receiver info
 *       404:
 *         description: Not found
 */
router.get('/:referralId',
  authenticate, authorize('agent', 'admin'),
  ctrl.getReferral
);

/**
 * @swagger
 * /referrals/{referralId}/respond:
 *   patch:
 *     summary: Accept, decline, or counter-offer a referral
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referralId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, decline, counter]
 *               response_message:
 *                 type: string
 *               counter_fee_percent:
 *                 type: number
 *                 description: Required when action is counter
 *     responses:
 *       200:
 *         description: Referral status updated
 *       400:
 *         description: Already responded or invalid action
 */
router.patch('/:referralId/respond',
  authenticate, authorize('agent'),
  respondReferralRules, validate,
  ctrl.respondToReferral
);

/**
 * @swagger
 * /referrals/{referralId}/complete:
 *   patch:
 *     summary: Mark referral as completed and record transaction details
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referralId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sale_price, commission_amount, referral_fee_paid]
 *             properties:
 *               sale_price:        { type: integer, description: "Final sale price in cents" }
 *               commission_amount: { type: integer, description: "Total commission in cents" }
 *               referral_fee_paid: { type: integer, description: "Referral fee paid in cents" }
 *     responses:
 *       200:
 *         description: Referral completed, 80 points awarded to both agents
 */
router.patch('/:referralId/complete',
  authenticate, authorize('agent'),
  completeReferralRules, validate,
  ctrl.completeReferral
);

module.exports = router;
