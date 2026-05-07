'use strict';
const { body, query, param } = require('express-validator');

const TIERS = ['BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','LUMINARY'];
const SORTS  = ['rating','reviews','recent','points'];


const createAgentRules = [
  body('license_number').notEmpty().trim().isLength({ max: 50 }).withMessage('License number is required'),
  body('first_name').notEmpty().trim().isLength({ max: 100 }).withMessage('First name is required'),
  body('last_name').notEmpty().trim().isLength({ max: 100 }).withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('brokerage').optional().trim().isLength({ max: 255 }),
  body('city').optional().trim().isLength({ max: 255 })
];


const createCustomerRules = [
  body('property').notEmpty().trim().isLength({ max: 50 }).withMessage('License number is required'),
  body('first_name').notEmpty().trim().isLength({ max: 100 }).withMessage('First name is required'),
  body('last_name').notEmpty().trim().isLength({ max: 100 }).withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone_number').optional().trim().isLength({ max: 20 }),
  body('property').optional().trim().isLength({ max: 20 }),
  body('budget_warranty').optional().trim().isLength({ max: 20 }),
  body('address').optional().trim().isLength({ max: 500 }),
  body('city').optional().trim().isLength({ max: 255 })
];


const updateAgentRules = [
  body('first_name').optional().trim().isLength({ max: 100 }),
  body('last_name').optional().trim().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('brokerage').optional().trim().isLength({ max: 255 }),
  body('bio').optional().isLength({ max: 2000 }),
  body('website').optional().isURL().withMessage('Invalid website URL'),
  body('languages').optional().isArray(),
  body('specialties').optional().isArray(),
  body('areas_served').optional().isArray(),
  body('lead_notifications').optional().isBoolean(),
  body('referral_notifications').optional().isBoolean(),
  body('marketing_emails').optional().isBoolean(),
];

const searchAgentRules = [
  query('q').optional().trim(),
  query('city').optional().trim(),
  query('province').optional().trim().isLength({ max: 10 }),
  query('specialties').optional(),
  query('languages').optional(),
  query('min_rating').optional().isFloat({ min: 1, max: 5 }).withMessage('min_rating must be 1-5'),
  query('tier').optional().isIn(TIERS).withMessage('Invalid tier'),
  query('sort').optional().isIn(SORTS).withMessage('Invalid sort field'),
  query('lat').optional().isFloat().withMessage('Invalid latitude'),
  query('lng').optional().isFloat().withMessage('Invalid longitude'),
  query('radius').optional().isFloat({ min: 1, max: 200 }).withMessage('Radius must be 1-200 km'),
  query('claimed_only').optional().isBoolean(),
];

const AllAgentRules = [
  query('q').optional().trim(),
  query('city').optional().trim(),
  query('specialties').optional()
];


const agentIdParam = [
  param('agentId').isInt({ min: 1 }).withMessage('Invalid agent ID'),
];

const claimAgentRules = [
  body('license_number').notEmpty().trim().withMessage('License number is required'),
  body('verification_code').optional().trim(),
];

module.exports = {
  createAgentRules, updateAgentRules, searchAgentRules, agentIdParam, claimAgentRules,AllAgentRules,createCustomerRules
};
