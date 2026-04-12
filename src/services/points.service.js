'use strict';
const { query } = require('../db/pool');
const { ApiError } = require('../utils/errors');

// ─── Get agent's point history ────────────────────────────────────────────────
const getPointHistory = async (agentId, year, { limit, offset }) => {
  const currentYear = year || new Date().getFullYear();

  const [countRes, dataRes, summaryRes] = await Promise.all([
    query(
      'SELECT COUNT(*) FROM point_transactions WHERE agent_id = $1 AND year = $2',
      [agentId, currentYear]
    ),
    query(
      `SELECT * FROM point_transactions
       WHERE agent_id = $1 AND year = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [agentId, currentYear, limit, offset]
    ),
    query(
      `SELECT
         SUM(points) AS year_total,
         COUNT(*) FILTER (WHERE points > 0) AS earning_actions,
         action_type, SUM(points) AS action_total
       FROM point_transactions
       WHERE agent_id = $1 AND year = $2
       GROUP BY action_type
       ORDER BY action_total DESC`,
      [agentId, currentYear]
    ),
  ]);

  return {
    transactions: dataRes.rows,
    total: parseInt(countRes.rows[0].count, 10),
    breakdown: summaryRes.rows,
  };
};

// ─── Get tier progress ────────────────────────────────────────────────────────
const getTierProgress = async (agentId) => {
  const { rows: agentRows } = await query(
    'SELECT current_tier, year_points, total_points, avg_rating, total_reviews FROM agents WHERE id = $1',
    [agentId]
  );
  if (!agentRows.length) throw new ApiError(404, 'Agent not found');

  const { rows: tiers } = await query(
    'SELECT * FROM tiers ORDER BY tier_order ASC'
  );

  const agent       = agentRows[0];
  const currentTier = tiers.find(t => t.tier_name === agent.current_tier);
  const nextTier    = tiers.find(t => t.tier_order === (currentTier?.tier_order || 0) + 1);

  return {
    current_tier:  agent.current_tier,
    year_points:   agent.year_points,
    total_points:  agent.total_points,
    avg_rating:    agent.avg_rating,
    total_reviews: agent.total_reviews,
    next_tier:     nextTier || null,
    points_to_next: nextTier ? Math.max(0, nextTier.min_points - agent.year_points) : 0,
    all_tiers:     tiers,
  };
};

// ─── Platform connections & points ───────────────────────────────────────────
const connectPlatform = async (agentId, platform, platformAccountId, apiCredentials) => {
  // Upsert connection
  const { rows: existing } = await query(
    'SELECT id FROM platform_connections WHERE agent_id = $1 AND platform = $2',
    [agentId, platform]
  );

  if (existing.length) {
    await query(
      `UPDATE platform_connections
       SET platform_account_id = $1, api_credentials = $2,
           sync_status = 'ACTIVE', sync_error_message = NULL, last_sync_at = NULL
       WHERE agent_id = $3 AND platform = $4`,
      [platformAccountId, JSON.stringify(apiCredentials), agentId, platform]
    );
    return { reconnected: true };
  }

  await query(
    `INSERT INTO platform_connections (agent_id, platform, platform_account_id, api_credentials)
     VALUES ($1,$2,$3,$4)`,
    [agentId, platform, platformAccountId, JSON.stringify(apiCredentials)]
  );

  // Points: first connection vs additional
  const { rows: connCount } = await query(
    'SELECT COUNT(*) FROM platform_connections WHERE agent_id = $1',
    [agentId]
  );
  const count = parseInt(connCount[0].count, 10);
  const action = count === 1 ? 'PLATFORM_CONNECT_FIRST' : 'PLATFORM_CONNECT_ADD';
  await require('../utils/points').awardPoints(agentId, action, 'platform', null, `Connected ${platform}`);

  return { connected: true };
};

const listConnections = async (agentId) => {
  const { rows } = await query(
    `SELECT id, platform, platform_account_id, connected_at, last_sync_at,
            sync_status, sync_error_message, total_synced_reviews
     FROM platform_connections WHERE agent_id = $1`,
    [agentId]
  );
  return rows;
};

const disconnectPlatform = async (agentId, platform) => {
  await query(
    `UPDATE platform_connections SET sync_status = 'DISABLED' WHERE agent_id = $1 AND platform = $2`,
    [agentId, platform]
  );
};

module.exports = { getPointHistory, getTierProgress, connectPlatform, listConnections, disconnectPlatform };
