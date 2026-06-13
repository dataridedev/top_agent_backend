'use strict';
const router      = require('express').Router();
const cityService = require('../services/city.service');
const { success, paginated } = require('../utils/response');
const { pagination } = require('../middleware/pagination');
const { query }   = require('express-validator');
const { validate } = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Cities
 *   description: BC city directory and SEO landing page data
 */

/**
 * @swagger
 * /cities:
 *   get:
 *     summary: List all BC cities
 *     tags: [Cities]
 *     parameters:
 *       - in: query
 *         name: province
 *         schema: { type: string, default: BC }
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated city list with agent counts
 */
router.get(
  '/',
  [
    query('q').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { cities, total } = await cityService.listCities(req.query);

      return res.status(200).json({
        success: true,
        total,
        cities
      });
    } catch (err) {
      next(err);
    }
  }
);
// router.get('/',
//   [
//     query('province').optional().trim(),
//     query('region').optional().trim(),
//   ], validate,
//   // pagination(50, 200),
//   async (req, res, next) => {
//     try {
//       // const { cities, total } = await cityService.listCities(req.query, req.pagination);
//       const { cities, total } = await cityService.listCities(req.query, req.pagination);
//       paginated(res, cities, total, req.pagination);
//     } catch (err) { next(err); }
//   }
// );



/**
 * @swagger
 * /cities/getcity:
 *   get:
 *     summary: Get city list with search
 *     tags:
 *       - Cities
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         required: false
 *         description: Search cities by name (e.g. V, Vi, Van)
 *         example: V
 *     responses:
 *       200:
 *         description: List of cities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 cities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       city:
 *                         type: string
 *                         example: Victoria
 *       500:
 *         description: Internal server error
 */
router.get('/getcity', async (req, res, next) => {
  try {
    const data = await cityService.city(req.query);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /cities:
 *   get:
 *     summary: List all BC cities
 *     tags: [Cities]
 *     parameters:
 *       - in: query
 *         name: province
 *         schema: { type: string, default: BC }
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated city list with agent counts
 */
router.get('/getcityAgents', async (req, res, next) => {
  try {
    const { city, page, limit,search,sortOrder } = req.query;

    const data = await cityService.getcityAgents(city, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search || null
    });

    success(res, data);
  } catch (err) {
    next(err);
  }
});


/**
 * @swagger
 * /cities:
 *   get:
 *     summary: List all cities
 *     tags: [Cities]
 *     responses:
 *       200:
 *         description: List of cities
 */
router.get('/getcity', async (req, res, next) => {
  try {
    const data = await cityService.city();
    success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /cities/{slug}:
 *   get:
 *     summary: Get city landing page data by slug
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: burnaby
 *     responses:
 *       200:
 *         description: City info, SEO fields, and top 6 agents
 *       404:
 *         description: City not found
 */
router.get('/:slug',
  async (req, res, next) => {
    try {
      const city = await cityService.getCityBySlug(req.params.slug);
      success(res, city);
    } catch (err) { next(err); }
  }
);

module.exports = router;
