'use strict';
const { query } = require('../db/pool');
const { ApiError } = require('../utils/errors');
const { awardPoints } = require('../utils/points');

// ─── Create lead ──────────────────────────────────────────────────────────────
const createLead = async (data) => {
  const { agent_id, name, email, phone, message, looking_for,
          property_type, budget_min, budget_max, location, timeline,
          source = 'agent_profile', source_url } = data;

  const { rows: agent } = await query(
    'SELECT id, lead_notifications FROM agents WHERE id = $1',
    [agent_id]
  );
  if (!agent.length) throw new ApiError(404, 'Agent not found');

  const { rows } = await query(
    `INSERT INTO leads
       (agent_id, name, email, phone, message, looking_for, property_type,
        budget_min, budget_max, location, timeline, source, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [agent_id, name, email, phone, message, looking_for, property_type,
     budget_min, budget_max, location, timeline, source, source_url]
  );
  return { lead: rows[0], notifyAgent: agent[0].lead_notifications };
};

// ─── List leads for agent ─────────────────────────────────────────────────────
const listLeads = async (agentId, { status }, { limit, offset }) => {
  const conditions = ['l.agent_id = $1'];
  const params     = [agentId];
  let p = 2;

  if (status) { conditions.push(`l.status = $${p++}`); params.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, dataRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM leads l ${where}`, params),
    query(
      `SELECT * FROM leads l ${where}
       ORDER BY l.created_at DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]
    ),
  ]);

  return { leads: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

// ─── Update lead status ───────────────────────────────────────────────────────
const updateLeadStatus = async (leadId, agentId, status, notes) => {
  const now = new Date();
  const timestamps = {};
  if (status === 'CONTACTED') timestamps.contacted_at = now;
  if (status === 'QUALIFIED')  timestamps.qualified_at = now;

  const { rows } = await query(
    `UPDATE leads
     SET status = $1, notes = COALESCE($2, notes),
         contacted_at = CASE WHEN $1 = 'CONTACTED' AND contacted_at IS NULL THEN NOW() ELSE contacted_at END,
         qualified_at  = CASE WHEN $1 = 'QUALIFIED'  AND qualified_at  IS NULL THEN NOW() ELSE qualified_at  END
     WHERE id = $3 AND agent_id = $4
     RETURNING *`,
    [status, notes, leadId, agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Lead not found');

  // Award points for fast response (check created_at vs now)
  if (status === 'CONTACTED') {
    const minutesSinceCreated = Math.floor(
      (now - new Date(rows[0].created_at)) / 60000
    );
    if (minutesSinceCreated <= 60) {
      await awardPoints(agentId, 'LEAD_RESPOND_1HR', 'lead', leadId, 'Responded to lead within 1 hour');
    } else if (minutesSinceCreated <= 120) {
      await awardPoints(agentId, 'LEAD_RESPOND_2HR', 'lead', leadId, 'Responded to lead within 2 hours');
    }
  }

  return rows[0];
};

module.exports = { createLead, listLeads, updateLeadStatus };
