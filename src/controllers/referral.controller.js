'use strict';
const referralService = require('../services/referral.service');
const { success, created, paginated } = require('../utils/response');

const createReferral = async (req, res, next) => {
  try {
    const referral = await referralService.createReferral(req.user.agentId, req.body);
    created(res, referral);
  } catch (err) { next(err); }
};

const listReferrals = async (req, res, next) => {
  try {
    const { referrals, total } = await referralService.listReferrals(
      req.user.agentId, req.query, req.pagination
    );
    paginated(res, referrals, total, req.pagination);
  } catch (err) { next(err); }
};

const getReferral = async (req, res, next) => {
  try {
    const referral = await referralService.getReferralById(
      parseInt(req.params.referralId, 10), req.user.agentId
    );
    success(res, referral);
  } catch (err) { next(err); }
};

const respondToReferral = async (req, res, next) => {
  try {
    const referral = await referralService.respondToReferral(
      parseInt(req.params.referralId, 10), req.user.agentId, req.body
    );
    success(res, referral);
  } catch (err) { next(err); }
};

const completeReferral = async (req, res, next) => {
  try {
    const referral = await referralService.completeReferral(
      parseInt(req.params.referralId, 10), req.user.agentId, req.body
    );
    success(res, referral);
  } catch (err) { next(err); }
};

module.exports = { createReferral, listReferrals, getReferral, respondToReferral, completeReferral };
