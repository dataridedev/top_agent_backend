'use strict';
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query: dbQuery } = require('../db/pool');
const { validate } = require('../middleware/validate');
const {
  createBadgesRules
} = require('../validators/agent.validators');
const { success, paginated } = require('../utils/response');
const { pagination } = require('../middleware/pagination');
const { agentService } = require('../services/agent.service');
const reviewService = require('../services/review.service');
const ctrl = require('../controllers/admin.controller');

const multer = require('multer');

const upload = multer({
  fileFilter: function (req, file, done) {

    console.log("UPLOAD FILE:", file);

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp'   // 🔥 add this (important)
    ];

    if (allowedTypes.includes(file.mimetype)) {
      done(null, true);
    } else {
      done(new Error('Only image files are allowed'), false);
    }
  }
});

module.exports = upload;

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Internal admin panel endpoints (admin role only)
 */

// All admin routes require admin role


router.use(authenticate, authorize('admin'));

/**
 * @swagger
 * /admin/createbadges:
 *   post:
 *     summary: Create a new badge
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - badge_name
 *               - badge_icon
 *             properties:
 *               badge_name:
 *                 type: string
 *               badge_description:
 *                 type: string
 *               requirements:
 *                 type: string
 *               badge_icon:
 *                 type: string
 *                 format: binary
 *               badge_color:
 *                 type: string
 *               is_career_badge:
 *                 type: boolean
 *               verification:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Badge created successfully
 */
router.post('/createbadges',authenticate, validate,authorize('admin'),upload.single('badge_icon'), createBadgesRules, ctrl.createBadges);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Platform KPI overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Counts of agents, reviews, users, leads, referrals
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const [agents, reviews, users, leads, referrals, flagged] = await Promise.all([
      dbQuery('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) AS claimed FROM agents'),
      dbQuery('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE verified = true) AS verified FROM reviews'),
      dbQuery('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE role = $1) AS agents FROM users', ['agent']),
      dbQuery("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'NEW') AS new_leads FROM leads"),
      dbQuery("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed FROM referrals"),
      dbQuery('SELECT COUNT(*) AS total FROM review_reports WHERE resolved = false'),
    ]);
    success(res, {
      agents:    agents.rows[0],
      reviews:   reviews.rows[0],
      users:     users.rows[0],
      leads:     leads.rows[0],
      referrals: referrals.rows[0],
      flagged_reviews: flagged.rows[0],
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/agents:
 *   get:
 *     summary: List all agents (admin view with unclaimed profiles)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [claimed, unclaimed, all] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated agent list
 */
router.get('/agents', pagination(), async (req, res, next) => {
  try {
    const { status = 'all', q } = req.query;
    const { limit, offset } = req.pagination;
    const conditions = [];
    const params = [];
    let p = 1;

    if (status === 'claimed')   { conditions.push('claimed_at IS NOT NULL'); }
    if (status === 'unclaimed') { conditions.push('claimed_at IS NULL'); }
    if (q) {
      conditions.push(`(first_name ILIKE $${p} OR last_name ILIKE $${p} OR license_number ILIKE $${p})`);
      params.push(`%${q}%`); p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [cnt, data] = await Promise.all([
      dbQuery(`SELECT COUNT(*) FROM agents ${where}`, params),
      dbQuery(`SELECT * FROM agents ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p+1}`,
        [...params, limit, offset]),
    ]);
    paginated(res, data.rows, parseInt(cnt.rows[0].count, 10), req.pagination);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/reviews/flagged:
 *   get:
 *     summary: Get flagged reviews pending moderation
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated flagged review reports
 */
router.get('/reviews/flagged', pagination(), async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;
    const [cnt, data] = await Promise.all([
      dbQuery('SELECT COUNT(*) FROM review_reports rr WHERE rr.resolved = false'),
      dbQuery(
        `SELECT rr.*, r.text AS review_text, r.rating, r.agent_id,
                a.first_name, a.last_name
         FROM review_reports rr
         JOIN reviews r ON r.id = rr.review_id
         JOIN agents a  ON a.id = r.agent_id
         WHERE rr.resolved = false
         ORDER BY rr.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);
    paginated(res, data.rows, parseInt(cnt.rows[0].count, 10), req.pagination);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/agents/{agentId}/suspend:
 *   patch:
 *     summary: Suspend or reactivate an agent profile
 *     tags: [Admin]
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
 *             required: [suspended]
 *             properties:
 *               suspended: { type: boolean }
 *               reason:    { type: string }
 *     responses:
 *       200:
 *         description: Agent status updated
 */
router.patch('/agents/:agentId/suspend', async (req, res, next) => {
  try {
    const { suspended, reason } = req.body;
    await dbQuery(
      `UPDATE agents SET last_active = CASE WHEN $1 THEN NULL ELSE NOW() END,
       bio = CASE WHEN $1 THEN COALESCE($2, bio) ELSE bio END
       WHERE id = $3`,
      [suspended, reason, req.params.agentId]
    );
    success(res, { message: suspended ? 'Agent suspended' : 'Agent reactivated' });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/tiers/recalculate:
 *   post:
 *     summary: Manually trigger tier recalculation for all agents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recalculation complete
 */
router.post('/tiers/recalculate', async (req, res, next) => {
  try {
    await dbQuery('SELECT update_agent_scores()');
    success(res, { message: 'Tier recalculation complete' });
  } catch (err) { next(err); }
});

module.exports = router;
