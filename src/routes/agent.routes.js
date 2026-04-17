'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/agent.controller');
const { authenticate, authorize, ownsAgent, optionalAuth } = require('../middleware/auth');
const { validate }      = require('../middleware/validate');
const { pagination }    = require('../middleware/pagination');
const { searchLimiter } = require('../middleware/rateLimiter');
const {
  createAgentRules, updateAgentRules, searchAgentRules,
  agentIdParam, claimAgentRules,AllAgentRules
} = require('../validators/agent.validators');
const { listReviewsQuery } = require('../validators/review.validators');

/**
 * @swagger
 * tags:
 *   name: Agents
 *   description: Agent profiles, search, and management
 */



/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Search and filter agents
 *     tags: [Agents]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Full-text search (name, brokerage)
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: province
 *         schema: { type: string }
 *       - in: query
 *         name: min_rating
 *         schema: { type: number, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: tier
 *         schema: { type: string, enum: [BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, LUMINARY] }
 *       - in: query
 *         name: specialties
 *         schema: { type: string }
 *         description: Comma-separated list
 *       - in: query
 *         name: languages
 *         schema: { type: string }
 *         description: Comma-separated list
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [rating, reviews, recent, points] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of agents
 */
router.get('/',
  searchLimiter, optionalAuth,
  searchAgentRules, validate,
  pagination(20, 100),
  ctrl.searchAgents
);

/**
 * @swagger
 * /agents/getclaimAgent:
 *   get:
 *     summary: Get claimed agent profile (from token)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent profile
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/agents/getclaimAgent',
  authenticate,
  authorize('agent', 'consumer', 'admin'),
  ctrl.getclaim
);

/**
 * @swagger
 * /agents/getAllAgent:
 *   get:
 *     summary: Get all agent profiles
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: List of all agent profiles
 */
router.get(
  '/getAllAgent',searchLimiter,AllAgentRules,validate,
  ctrl.getAllAgent
);




/**
 * @swagger
 * /agents:
 *   post:
 *     summary: Create agent profile (admin / bulk seed)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AgentCreate'
 *     responses:
 *       201:
 *         description: Agent created
 *       409:
 *         description: License number already exists
 */
router.post('/',
  authenticate, authorize('admin'),
  createAgentRules, validate,
  ctrl.createAgent
);

/**
 * @swagger
 * /agents/{agentId}:
 *   get:
 *     summary: Get full agent profile by ID
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Agent profile
 *       404:
 *         description: Agent not found
 */
router.get('/:agentId',
  agentIdParam, validate,
  ctrl.getAgent
);

/**
 * @swagger
  * /agents/details/:{agentId}:
 *   get:
 *     summary: Get full agent profile by ID
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Agent profile
 *       404:
 *         description: Agent not found
 */
router.get(
  '/details/:agentId',
  searchLimiter,
  agentIdParam,
  validate,
  ctrl.getAgentDetails
);





/**
 * @swagger
 * /agents/{agentId}:
 *   patch:
 *     summary: Update agent profile (owner or admin)
 *     tags: [Agents]
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
 *             $ref: '#/components/schemas/AgentUpdate'
 *     responses:
 *       200:
 *         description: Updated agent
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Agent not found
 */
router.patch('/:agentId',
  authenticate, agentIdParam, validate, ownsAgent,
  updateAgentRules, validate,
  ctrl.updateAgent
);

/**
 * @swagger
 * /agents/{agentId}/claim:
 *   post:
 *     summary: Claim an unclaimed agent profile
 *     tags: [Agents]
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
 *             required: [license_number]
 *             properties:
 *               license_number: { type: string }
 *     responses:
 *       200:
 *         description: Profile claimed
 *       400:
 *         description: License number mismatch
 *       409:
 *         description: Profile already claimed
 */
router.post('/:agentId/claim',
  authenticate, authorize('agent', 'consumer', 'admin'),
  agentIdParam, claimAgentRules, validate,
  ctrl.claimAgent
);





/**
 * @swagger
 * /agents/{agentId}/stats:
 *   get:
 *     summary: Get agent performance statistics
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Review stats, referral counts, points summary
 *       404:
 *         description: Agent not found
 */
router.get('/:agentId/stats',
  agentIdParam, validate,
  ctrl.getAgentStats
);

/**
 * @swagger
 * /agents/{agentId}/reviews:
 *   get:
 *     summary: Get paginated reviews for an agent
 *     tags: [Agents]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: platform
 *         schema: { type: string }
 *       - in: query
 *         name: verified
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [recent, highest, lowest] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated reviews
 */
router.get('/:agentId/reviews',
  agentIdParam, listReviewsQuery, validate,
  pagination(20, 50),
  ctrl.getAgentReviews
);






module.exports = router;
