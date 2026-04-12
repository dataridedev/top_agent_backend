'use strict';
const { query } = require('../db/pool');
const { ApiError } = require('../utils/errors');

const listCities = async ({ province = 'BC', region }, { limit, offset }) => {
  const conditions = ['c.province = $1'];
  const params     = [province];
  let p = 2;

  if (region) { conditions.push(`c.region = $${p++}`); params.push(region); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, dataRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM cities c ${where}`, params),
    query(
      `SELECT c.*, (SELECT COUNT(*) FROM agents a WHERE $1 = ANY(a.areas_served) AND a.claimed_at IS NOT NULL) AS claimed_agents
       FROM cities c ${where}
       ORDER BY c.population DESC NULLS LAST
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]
    ),
  ]);

  return { cities: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

const getCityBySlug = async (slug) => {
  const { rows } = await query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM agents a WHERE c.city_name = ANY(a.areas_served) AND a.claimed_at IS NOT NULL) AS claimed_agents,
       (SELECT json_agg(row_to_json(t)) FROM (
          SELECT a.id, a.first_name, a.last_name, a.photo_url,
                 a.avg_rating, a.total_reviews, a.current_tier, a.brokerage
          FROM agents a
          WHERE c.city_name = ANY(a.areas_served)
            AND a.claimed_at IS NOT NULL
          ORDER BY a.avg_rating DESC, a.total_reviews DESC
          LIMIT 6
       ) t) AS top_agents
     FROM cities c WHERE c.slug = $1`,
    [slug]
  );
  if (!rows.length) throw new ApiError(404, 'City not found');
  return rows[0];
};

module.exports = { listCities, getCityBySlug };
