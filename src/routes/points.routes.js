'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/points.controller');
const { authenticate, authorize, ownsAgent } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');
const { pagination } = require('../middleware/pagination');
const { body, param } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Points & Tiers
 *   description: Agent points, tier progress, and platform connections
 */

/**
 * @swagger
 * /agents/{agentId}/points:
 *   get:
 *     summary: Get point transaction history for an agent
 *     tags: [Points & Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated point transactions with action breakdown
 */
router.get('/:agentId/points',
  authenticate, ownsAgent,
  [param('agentId').isInt({ min: 1 })], validate,
  pagination(),
  ctrl.getPointHistory
);

/**
 * @swagger
 * /agents/{agentId}/tier:
 *   get:
 *     summary: Get agent tier progress and all tier thresholds
 *     tags: [Points & Tiers]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Current tier, year_points, next tier info, all tiers
 */
router.get('/:agentId/tier',
  [param('agentId').isInt({ min: 1 })], validate,
  ctrl.getTierProgress
);

/**
 * @swagger
 * /agents/{agentId}/connections:
 *   get:
 *     summary: List connected review platforms for an agent
 *     tags: [Points & Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array of platform connections with sync status
 */
router.get('/:agentId/connections',
  authenticate, ownsAgent,
  ctrl.listConnections
);

/**
 * @swagger
 * /agents/{agentId}/connections:
 *   post:
 *     summary: Connect a review platform (awards platform connection points)
 *     tags: [Points & Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [platform]
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [google, rew, ratemyagent, ratemyagentcom, facebook, zillow, yelp]
 *               platform_account_id:
 *                 type: string
 *               credentials:
 *                 type: object
 *                 description: OAuth tokens (encrypted at rest)
 *     responses:
 *       200:
 *         description: Platform connected and points awarded
 */
router.post('/:agentId/connections',
  authenticate, ownsAgent,
  [
    param('agentId').isInt({ min: 1 }),
    body('platform').isIn(['google','rew','ratemyagent','ratemyagentcom','facebook','zillow','yelp'])
      .withMessage('Invalid platform'),
  ], validate,
  ctrl.connectPlatform
);

/**
 * @swagger
 * /agents/{agentId}/connections/{platform}:
 *   delete:
 *     summary: Disconnect a review platform
 *     tags: [Points & Tiers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: platform
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Platform disconnected
 */
router.delete('/:agentId/connections/:platform',
  authenticate, ownsAgent,
  ctrl.disconnectPlatform
);

module.exports = router;
