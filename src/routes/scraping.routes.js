'use strict';
const router = require('express').Router();
const scrap  = require('../controllers/scraping.controller');
const { authenticate, authorize, ownsAgent, optionalAuth } = require('../middleware/auth');
const { validate }      = require('../middleware/validate');
const { pagination }    = require('../middleware/pagination');


/** * @swagger
 * tags:
 *   name: Scraping
 *   description: Endpoints for triggering web scraping tasks
 */

/**
 * @swagger
 * /agents/scrape-zillow-agent:
 *   post:
 *     summary: Scrape Zillow agent data
 *     tags: [Agents]
 *     responses:
 *       200:
 *         description: Scraping successful
 */
router.post(
  '/scrape-zillow-agent',
  scrap.scrapezillowController
);


module.exports = router;