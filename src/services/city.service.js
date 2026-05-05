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

const getcityAgents = async (slug, { search, page = 1, limit } = {}) => {
  try {

    const conditions = [];
    const params = [];
    let p = 1;


    if (slug) {
      conditions.push(`a.city ILIKE $${p++}`);
      params.push(`%${slug}%`);
    }


    if (search) {
      conditions.push(`a.name ILIKE $${p++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';


    const offset = (page - 1) * limit;

    params.push(limit);
    params.push(offset);

  
    const cityAgents = await query(
      `SELECT  
    a.id,
    a.name,
    a.company_name,
    a.profile_url,
    a.about_heading,
    a.about_description,
    a.city
FROM agent_zillow_master a
WHERE a.city ILIKE $1
LIMIT $2;`,
    [slug, limit]
    );

    const countParams = params.slice(0, params.length - 2);

    const countRes = await query(
      `SELECT COUNT(*) 
       FROM agent_zillow_master a
       ${whereClause}`,
      countParams
    );

    return {
      success: true,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
      agents: cityAgents.rows
    };

  } catch (error) {
    console.error('Error in getcityAgents:', error);
    return {
      success: false,
      error: {
        message: 'Failed to fetch agents'
      }
    };
  }
};

const city = async () => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT city 
      FROM agent_zillow_master
      WHERE city IS NOT NULL
      ORDER BY city;
    `);

    return {
      success: true,
      count: rows.length,
      cities: rows
    };

  } catch (error) {
    console.error('Error in getcity:', error);

    return {
      success: false,
      error: {
        message: 'Failed to fetch city'
      }
    };
  }
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

module.exports = { listCities, getCityBySlug ,getcityAgents, city };
