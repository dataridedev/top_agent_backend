'use strict';
const { query, withTransaction } = require('../db/pool');

/**
 * Point values per action (from the business plan).
 */
const POINTS = {
  REVIEW_NATIVE:        50,
  REVIEW_PLATFORM:      20,
  REVIEW_RESPONSE:      10,
  PLATFORM_CONNECT_FIRST: 75,
  PLATFORM_CONNECT_ADD: 35,
  REFERRAL_COMPLETE:    80,
  LEAD_RESPOND_1HR:     20,
  LEAD_RESPOND_2HR:     10,
  PROFILE_COMPLETE:     100,
  BADGE_EMBED:          40,
  ANNUAL_ACTIVE:        150,
  REVIEW_INVITE:        8,
  TIER_UPGRADE:         25,
};

/**
 * Add points for an action.
 * Automatically inserts a point_transaction row (trigger updates agent totals).
 */
const awardPoints = async (agentId, actionType, sourceType = null, sourceId = null, description = null) => {
  const basePoints = POINTS[actionType] || 0;
  if (basePoints === 0) return;

  // Fetch agent's avg_rating for potential multiplier
  const { rows } = await query('SELECT avg_rating FROM agents WHERE id = $1', [agentId]);
  const avgRating = parseFloat(rows[0]?.avg_rating || 0);

  let multiplier   = 1.0;
  let bonusReason  = null;
  if (avgRating >= 4.8)  { multiplier = 1.25; bonusReason = 'rating_4_8_plus'; }
  else if (avgRating >= 4.5) { multiplier = 1.10; bonusReason = 'rating_4_5_plus'; }

  const finalPoints = Math.round(basePoints * multiplier);

  await query(
    `INSERT INTO point_transactions
      (agent_id, points, action_type, description, source_type, source_id, base_points, multiplier, bonus_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [agentId, finalPoints, actionType, description, sourceType, sourceId, basePoints, multiplier, bonusReason]
  );

  return finalPoints;
};

module.exports = { POINTS, awardPoints };
