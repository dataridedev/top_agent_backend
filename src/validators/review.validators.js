'use strict';
const { body, param, query } = require('express-validator');

const PLATFORMS = ['native','google','rew','ratemyagent','ratemyagentcom','facebook','zillow','yelp'];

const createReviewRules = [
  body('agent_id').isInt({ min: 1 }).withMessage('Valid agent_id is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('reviewer_name').notEmpty().trim().isLength({ max: 100 }).withMessage('Reviewer name is required'),
  body('reviewer_email').isEmail().normalizeEmail().withMessage('Valid email is required for verification'),
  body('text').optional().isLength({ max: 5000 }),
  body('title').optional().trim().isLength({ max: 200 }),
  body('platform').optional().isIn(PLATFORMS).withMessage('Invalid platform'),
  body('platform_review_id').optional().trim().isLength({ max: 100 }),
  body('platform_url').optional().isURL().withMessage('Invalid platform URL'),
  body('property_address').optional().trim().isLength({ max: 500 }),
  body('transaction_type').optional().isIn(['buy','sell','rent']),
  body('review_date').optional().isISO8601().withMessage('Invalid review date'),
  // 8-dimension sub-ratings
  body('rating_communication').optional().isInt({ min: 1, max: 5 }),
  body('rating_negotiation').optional().isInt({ min: 1, max: 5 }),
  body('rating_market_knowledge').optional().isInt({ min: 1, max: 5 }),
  body('rating_responsiveness').optional().isInt({ min: 1, max: 5 }),
  body('rating_pricing').optional().isInt({ min: 1, max: 5 }),
  body('rating_paperwork').optional().isInt({ min: 1, max: 5 }),
  body('rating_availability').optional().isInt({ min: 1, max: 5 }),
  body('rating_recommendation').optional().isInt({ min: 1, max: 5 }),
];

const addReviewRules = [
  body('agent_id').isInt({ min: 1 }).withMessage('Valid agent_id is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('reviewer_name').notEmpty().trim().isLength({ max: 100 }).withMessage('Reviewer name is required'),
  body('review_description').optional().isLength({ max: 5000 }),
  body('review_title').optional().trim().isLength({ max: 200 }),
  body('platform').optional().isIn(PLATFORMS).withMessage('Invalid platform'),
  body('review_date').optional().isISO8601().withMessage('Invalid review date')
];




const importReviewRules = [
  body('platform').isIn(PLATFORMS).withMessage('Invalid platform'),
  body('reviews').isArray({ min: 1, max: 500 }).withMessage('reviews must be an array of 1-500 items'),
  body('reviews.*.rating').isInt({ min: 1, max: 5 }),
  body('reviews.*.reviewer_name').notEmpty().trim(),
  body('reviews.*.review_date').isISO8601(),
  body('reviews.*.platform_review_id').optional().trim(),
];

const replyRules = [
  body('response').notEmpty().trim().isLength({ min: 1, max: 500 })
    .withMessage('Response is required and must be under 500 characters'),
];

const reportRules = [
  body('reason').isIn(['fake','inappropriate','wrong_person','spam','other'])
    .withMessage('Invalid report reason'),
  body('description').optional().trim().isLength({ max: 1000 }),
];

const listReviewsQuery = [
  query('rating').optional().isInt({ min: 1, max: 5 }),
  query('platform').optional().isIn(PLATFORMS),
  query('verified').optional().isBoolean(),
  query('sort').optional().isIn(['recent','highest','lowest','helpful']),
];

module.exports = { createReviewRules, importReviewRules, replyRules, reportRules, listReviewsQuery,addReviewRules };
