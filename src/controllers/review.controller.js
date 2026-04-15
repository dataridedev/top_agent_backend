'use strict';
const reviewService = require('../services/review.service');
const { success, created, paginated } = require('../utils/response');

const createReview = async (req, res, next) => {
  try {
    const review = await reviewService.createReview(req.body);
    created(res, review);
  } catch (err) { next(err); }
};

const addReview = async (req, res, next) => {
  try {
    const review = await reviewService.addAgentReview(req.body);
    created(res, review);
  } catch (err) { next(err); }
};

const getReview = async (req, res, next) => {
  try {
    const review = await reviewService.getReviewById(parseInt(req.params.reviewId, 10));
    success(res, review);
  } catch (err) { next(err); }
};

const replyToReview = async (req, res, next) => {
  try {
    const review = await reviewService.replyToReview(
      parseInt(req.params.reviewId, 10),
      req.user.agentId,
      req.body.response
    );
    success(res, review);
  } catch (err) { next(err); }
};

const reportReview = async (req, res, next) => {
  try {
    const result = await reviewService.reportReview(
      parseInt(req.params.reviewId, 10),
      req.user.id,
      req.body.reason,
      req.body.description
    );
    success(res, result);
  } catch (err) { next(err); }
};

const importReviews = async (req, res, next) => {
  try {
    const result = await reviewService.bulkImportReviews(
      req.user.agentId,
      req.body.platform,
      req.body.reviews
    );
    success(res, result);
  } catch (err) { next(err); }
};

// Admin only
const verifyReview = async (req, res, next) => {
  try {
    const review = await reviewService.verifyReview(parseInt(req.params.reviewId, 10), req.user.id);
    success(res, review);
  } catch (err) { next(err); }
};

module.exports = { createReview, getReview, replyToReview, reportReview, importReviews, verifyReview, addReview };
