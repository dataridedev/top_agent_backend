'use strict';
const { query, withTransaction } = require('../db/pool');
const { ApiError }               = require('../utils/errors');
const { awardPoints }            = require('../utils/points');

// ─── Search agents ────────────────────────────────────────────────────────────
const searchAgents = async ({ q, city, province, specialties, languages, min_rating,
  tier, sort = 'rating', lat, lng, radius, claimed_only = true }, { page, limit, offset }) => {

  const conditions = [];
  const params     = [];
  let   p          = 1;

  if (claimed_only) { conditions.push(`a.claimed_at IS NOT NULL`); }

  if (q) {
    conditions.push(`(a.first_name ILIKE $${p} OR a.last_name ILIKE $${p} OR a.brokerage ILIKE $${p})`);
    params.push(`%${q}%`); p++;
  }
  if (city) {
    conditions.push(`$${p} = ANY(a.areas_served)`);
    params.push(city); p++;
  }
  if (min_rating) {
    conditions.push(`a.avg_rating >= $${p}`);
    params.push(parseFloat(min_rating)); p++;
  }
  if (tier) {
    conditions.push(`a.current_tier = $${p}`);
    params.push(tier); p++;
  }
  if (specialties) {
    const specs = Array.isArray(specialties) ? specialties : specialties.split(',');
    conditions.push(`a.specialties && $${p}::text[]`);
    params.push(specs); p++;
  }
  if (languages) {
    const langs = Array.isArray(languages) ? languages : languages.split(',');
    conditions.push(`a.languages && $${p}::text[]`);
    params.push(langs); p++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    rating:  'a.avg_rating DESC, a.total_reviews DESC',
    reviews: 'a.total_reviews DESC, a.avg_rating DESC',
    recent:  'a.last_active DESC',
    points:  'a.total_points DESC',
  };
  const orderBy = sortMap[sort] || sortMap.rating;

  const countSql = `SELECT COUNT(*) FROM agents a ${where}`;
  const dataSql  = `
    SELECT a.id, a.first_name, a.last_name, a.brokerage, a.photo_url,
           a.avg_rating, a.total_reviews, a.current_tier, a.total_points,
           a.specialties, a.areas_served, a.languages, a.claimed_at, a.verified_at,
           a.lead_notifications
    FROM agents a
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${p} OFFSET $${p+1}
  `;

  const [countRes, dataRes] = await Promise.all([
    query(countSql, params),
    query(dataSql, [...params, limit, offset]),
  ]);

  return { agents: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

// ─── Get single agent ─────────────────────────────────────────────────────────
const getAgentById = async (agentId) => {
  const { rows } = await query(
    `SELECT a.*,
       (SELECT COUNT(*) FROM platform_connections pc WHERE pc.agent_id = a.id AND pc.sync_status = 'ACTIVE') AS connected_platforms,
       (SELECT COUNT(*) FROM referrals r WHERE (r.sender_id = a.id OR r.receiver_id = a.id) AND r.status = 'COMPLETED') AS completed_referrals
     FROM agents a
     WHERE a.id = $1`,
    [agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Agent not found');
  return rows[0];
};

// ─── Create agent (admin / auto-seed) ────────────────────────────────────────
const createAgent = async (data) => {
  const { license_number, first_name, last_name, email, phone, brokerage,
          bio, website, languages, specialties, areas_served } = data;

  const { rows } = await query(
    `INSERT INTO agents
       (license_number, first_name, last_name, email, phone, brokerage, bio, website, languages, specialties, areas_served)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [license_number, first_name, last_name, email, phone, brokerage, bio,
     website, languages || [], specialties || [], areas_served || []]
  );
  return rows[0];
};

// ─── Update agent ─────────────────────────────────────────────────────────────
const updateAgent = async (agentId, data) => {
  const allowed = ['first_name','last_name','email','phone','brokerage','bio','photo_url',
                   'website','languages','specialties','areas_served',
                   'lead_notifications','referral_notifications','marketing_emails'];

  const fields = [];
  const values = [];
  let p = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${p++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) throw new ApiError(400, 'No valid fields to update');

  fields.push(`updated_at = NOW()`);
  values.push(agentId);

  const { rows } = await query(
    `UPDATE agents SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
    values
  );
  if (!rows.length) throw new ApiError(404, 'Agent not found');
  return rows[0];
};

// ─── Claim agent profile ──────────────────────────────────────────────────────
const claimAgent = async (agentId, userId, licenseNumber) => {
  // Verify license matches
  const { rows: agentRows } = await query(
    'SELECT id, claimed_at, license_number FROM agents WHERE id = $1',
    [agentId]
  );
  if (!agentRows.length) throw new ApiError(404, 'Agent not found');
  if (agentRows[0].claimed_at) throw new ApiError(409, 'Profile already claimed');
  if (agentRows[0].license_number.toLowerCase() !== licenseNumber.toLowerCase()) {
    throw new ApiError(400, 'License number does not match');
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE agents SET claimed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [agentId]
    );
    await client.query(
      `UPDATE users SET agent_id = $1, updated_at = NOW() WHERE id = $2`,
      [agentId, userId]
    );
  });

  // Award founding agent points for profile completion
  await awardPoints(agentId, 'PROFILE_COMPLETE', 'profile', agentId, 'Profile claimed and completed');

  return getAgentById(agentId);
};

// ─── Agent stats ──────────────────────────────────────────────────────────────
const getAgentStats = async (agentId) => {
  const [reviewStats, referralStats, pointStats] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total_reviews,
         ROUND(AVG(rating)::numeric, 2) AS avg_rating,
         COUNT(*) FILTER (WHERE rating = 5) AS five_star,
         COUNT(*) FILTER (WHERE rating = 4) AS four_star,
         COUNT(*) FILTER (WHERE rating = 3) AS three_star,
         COUNT(*) FILTER (WHERE rating = 2) AS two_star,
         COUNT(*) FILTER (WHERE rating = 1) AS one_star,
         COUNT(*) FILTER (WHERE agent_responded = true) AS responded_count,
         ROUND(AVG(rating_communication)::numeric,2) AS avg_communication,
         ROUND(AVG(rating_negotiation)::numeric,2)   AS avg_negotiation,
         ROUND(AVG(rating_market_knowledge)::numeric,2) AS avg_market_knowledge,
         ROUND(AVG(rating_responsiveness)::numeric,2) AS avg_responsiveness
       FROM reviews WHERE agent_id = $1 AND verified = true`,
      [agentId]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
         COUNT(*) FILTER (WHERE sender_id = $1 AND status = 'COMPLETED') AS sent_completed,
         COUNT(*) FILTER (WHERE receiver_id = $1 AND status = 'COMPLETED') AS received_completed
       FROM referrals WHERE sender_id = $1 OR receiver_id = $1`,
      [agentId]
    ),
    query(
      `SELECT total_points, year_points, current_tier
       FROM agents WHERE id = $1`,
      [agentId]
    ),
  ]);

  return {
    reviews:  reviewStats.rows[0],
    referrals: referralStats.rows[0],
    points:   pointStats.rows[0],
  };
};

// ─── Get agent reviews ────────────────────────────────────────────────────────
const getAgentReviews = async (agentId, { rating, platform, verified, sort = 'recent' }, { limit, offset }) => {
  const conditions = ['r.agent_id = $1'];
  const params     = [agentId];
  let   p          = 2;

  if (rating)   { conditions.push(`r.rating = $${p++}`);    params.push(parseInt(rating,10)); }
  if (platform) { conditions.push(`r.platform = $${p++}`);  params.push(platform); }
  if (verified !== undefined) {
    conditions.push(`r.verified = $${p++}`);
    params.push(verified === 'true' || verified === true);
  }

  const sortMap = {
    recent:  'r.review_date DESC',
    highest: 'r.rating DESC, r.review_date DESC',
    lowest:  'r.rating ASC, r.review_date DESC',
  };
  const orderBy = sortMap[sort] || sortMap.recent;

  const countSql = `SELECT COUNT(*) FROM reviews r WHERE ${conditions.join(' AND ')}`;
  const dataSql  = `
    SELECT r.*, a.first_name, a.last_name
    FROM reviews r
    JOIN agents a ON a.id = r.agent_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${p} OFFSET $${p+1}
  `;

  const [countRes, dataRes] = await Promise.all([
    query(countSql, params),
    query(dataSql, [...params, limit, offset]),
  ]);

  return { reviews: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

// ─── Recalculate tier (called nightly by cron) ────────────────────────────────
const recalculateTiers = async () => {
  await query(`SELECT update_agent_scores()`);
  return { message: 'Tier recalculation complete' };
};

module.exports = {
  searchAgents, getAgentById, createAgent, updateAgent,
  claimAgent, getAgentStats, getAgentReviews, recalculateTiers,
};
