'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/lead.controller');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');
const { pagination }  = require('../middleware/pagination');
const { authLimiter } = require('../middleware/rateLimiter');
const { createLeadRules, updateLeadStatusRules, leadIdParam } = require('../validators/lead.validators');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Consumer lead capture and agent lead management
 */

/**
 * @swagger
 * /leads:
 *   post:
 *     summary: Submit a lead (contact an agent)
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadCreate'
 *     responses:
 *       201:
 *         description: Lead created and agent notified
 *       404:
 *         description: Agent not found
 */
router.post('/',
  authLimiter, optionalAuth,
  createLeadRules, validate,
  ctrl.createLead
);

/**
 * @swagger
 * /leads:
 *   get:
 *     summary: List leads for the authenticated agent
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NEW, CONTACTED, QUALIFIED, CONVERTED, CLOSED]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated leads
 */
router.get('/',
  authenticate, authorize('agent', 'admin'),
  pagination(),
  ctrl.listLeads
);

/**
 * @swagger
 * /leads/{leadId}/status:
 *   patch:
 *     summary: Update lead status (agent updates pipeline stage)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NEW, CONTACTED, QUALIFIED, CONVERTED, CLOSED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated. Points awarded for fast response.
 *       404:
 *         description: Lead not found
 */
router.patch('/:leadId/status',
  authenticate, authorize('agent'),
  leadIdParam, updateLeadStatusRules, validate,
  ctrl.updateLeadStatus
);

module.exports = router;
