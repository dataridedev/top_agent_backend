'use strict';
const router = require('express').Router();

router.use('/auth',     require('./auth.routes'));
router.use('/agents',   require('./agent.routes'));
router.use('/agents',   require('./points.routes'));   // /agents/:agentId/points|tier|connections
router.use('/reviews',  require('./review.routes'));
router.use('/referrals',require('./referral.routes'));
router.use('/leads',    require('./lead.routes'));
router.use('/cities',   require('./city.routes'));
router.use('/admin',    require('./admin.routes'));
router.use('/scraping', require('./scraping.routes'));

module.exports = router;
