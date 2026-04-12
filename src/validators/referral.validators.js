'use strict';
const { body, query } = require('express-validator');

const createReferralRules = [
  body('receiver_id').isInt({ min: 1 }).withMessage('Valid receiver_id is required'),
  body('client_name').notEmpty().trim().isLength({ max: 200 }).withMessage('Client name is required'),
  body('client_email').optional().isEmail().normalizeEmail(),
  body('client_phone').optional().trim().isLength({ max: 20 }),
  body('property_type').optional().isIn(['residential','commercial','investment','land']),
  body('transaction_type').isIn(['buy','sell','rent']).withMessage('Valid transaction_type is required'),
  body('budget_min').optional().isInt({ min: 0 }),
  body('budget_max').optional().isInt({ min: 0 }),
  body('location').notEmpty().trim().isLength({ max: 200 }).withMessage('Location is required'),
  body('timeline').optional().trim().isLength({ max: 100 }),
  body('notes').optional().isLength({ max: 2000 }),
  body('referral_fee_percent').optional().isFloat({ min: 0, max: 50 })
    .withMessage('Fee percent must be 0-50'),
  body('message').optional().isLength({ max: 2000 }),
];

const respondReferralRules = [
  body('action').isIn(['accept','decline','counter']).withMessage('Action must be accept, decline, or counter'),
  body('response_message').optional().trim().isLength({ max: 2000 }),
  body('counter_fee_percent').if(body('action').equals('counter'))
    .isFloat({ min: 0, max: 50 }).withMessage('counter_fee_percent required for counter action'),
];

const completeReferralRules = [
  body('sale_price').isInt({ min: 1 }).withMessage('Sale price is required'),
  body('commission_amount').isInt({ min: 0 }).withMessage('Commission amount is required'),
  body('referral_fee_paid').isInt({ min: 0 }).withMessage('Referral fee paid is required'),
];

const listReferralsQuery = [
  query('status').optional().isIn(['PENDING','ACCEPTED','DECLINED','IN_PROGRESS','COMPLETED','CANCELLED']),
  query('direction').optional().isIn(['sent','received','all']),
];

module.exports = { createReferralRules, respondReferralRules, completeReferralRules, listReferralsQuery };
