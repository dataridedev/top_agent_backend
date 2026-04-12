'use strict';
const { body, param } = require('express-validator');

const createLeadRules = [
  body('agent_id').isInt({ min: 1 }).withMessage('Valid agent_id is required'),
  body('name').notEmpty().trim().isLength({ max: 200 }).withMessage('Name is required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('message').optional().isLength({ max: 2000 }),
  body('looking_for').isIn(['buy','sell','rent','invest']).withMessage('Valid looking_for is required'),
  body('property_type').optional()
    .isIn(['single_family','condo','townhouse','multi_family','land','commercial']),
  body('budget_min').optional().isInt({ min: 0 }),
  body('budget_max').optional().isInt({ min: 0 }),
  body('location').optional().trim().isLength({ max: 200 }),
  body('timeline').optional().trim().isLength({ max: 100 }),
  body('source').optional().isIn(['topagents_search','agent_profile','city_page','quiz','direct']),
  body('source_url').optional().isURL(),
];

const updateLeadStatusRules = [
  body('status').isIn(['NEW','CONTACTED','QUALIFIED','CONVERTED','CLOSED'])
    .withMessage('Invalid status'),
  body('notes').optional().trim().isLength({ max: 2000 }),
];

const leadIdParam = [
  param('leadId').isInt({ min: 1 }).withMessage('Invalid lead ID'),
];

module.exports = { createLeadRules, updateLeadStatusRules, leadIdParam };
