'use strict';
const { query, withTransaction } = require('../db/pool');
const { ApiError }               = require('../utils/errors');
const { awardPoints }            = require('../utils/points');

// ─── Send referral ────────────────────────────────────────────────────────────
const createReferral = async (senderId, data) => {
  const { receiver_id, client_name, client_email, client_phone,
          property_type, transaction_type, budget_min, budget_max,
          location, timeline, notes, referral_fee_percent, message } = data;

  if (senderId === receiver_id) throw new ApiError(400, 'Cannot refer to yourself');

  // Verify both agents exist
  const { rows: agents } = await query(
    'SELECT id FROM agents WHERE id = ANY($1::int[])',
    [[senderId, receiver_id]]
  );
  if (agents.length < 2) throw new ApiError(404, 'One or both agents not found');

  const { rows } = await query(
    `INSERT INTO referrals
       (sender_id, receiver_id, client_name, client_email, client_phone,
        property_type, transaction_type, budget_min, budget_max,
        location, timeline, notes, referral_fee_percent, message, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING')
     RETURNING *`,
    [senderId, receiver_id, client_name, client_email, client_phone,
     property_type, transaction_type, budget_min, budget_max,
     location, timeline, notes, referral_fee_percent, message]
  );
  return rows[0];
};

// ─── Respond to referral ──────────────────────────────────────────────────────
const respondToReferral = async (referralId, receiverId, { action, response_message, counter_fee_percent }) => {
  const { rows } = await query(
    'SELECT * FROM referrals WHERE id = $1 AND receiver_id = $2',
    [referralId, receiverId]
  );
  if (!rows.length) throw new ApiError(404, 'Referral not found');
  if (rows[0].status !== 'PENDING') throw new ApiError(400, `Referral is already ${rows[0].status}`);

  const statusMap = { accept: 'ACCEPTED', decline: 'DECLINED', counter: 'PENDING' };
  const newStatus = statusMap[action];

  const updateFields = {
    status:           newStatus,
    responded_at:     new Date(),
    response_message: response_message || null,
    accepted_at:      action === 'accept' ? new Date() : null,
  };

  // Counter-offer updates the fee
  if (action === 'counter' && counter_fee_percent !== undefined) {
    updateFields.referral_fee_percent = counter_fee_percent;
  }

  const { rows: updated } = await query(
    `UPDATE referrals
     SET status = $1, responded_at = NOW(), response_message = $2,
         accepted_at = CASE WHEN $1 = 'ACCEPTED' THEN NOW() ELSE NULL END,
         referral_fee_percent = COALESCE($3, referral_fee_percent)
     WHERE id = $4
     RETURNING *`,
    [newStatus, response_message, counter_fee_percent, referralId]
  );
  return updated[0];
};

// ─── Complete referral ────────────────────────────────────────────────────────
const completeReferral = async (referralId, agentId, { sale_price, commission_amount, referral_fee_paid }) => {
  const { rows } = await query(
    `SELECT * FROM referrals WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
    [referralId, agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Referral not found');
  if (!['ACCEPTED','IN_PROGRESS'].includes(rows[0].status)) {
    throw new ApiError(400, 'Only accepted or in-progress referrals can be completed');
  }

  const { rows: updated } = await query(
    `UPDATE referrals
     SET status = 'COMPLETED', completed_at = NOW(),
         sale_price = $1, commission_amount = $2, referral_fee_paid = $3
     WHERE id = $4
     RETURNING *`,
    [sale_price, commission_amount, referral_fee_paid, referralId]
  );

  // Award points to both agents
  await Promise.all([
    awardPoints(rows[0].sender_id,   'REFERRAL_COMPLETE', 'referral', referralId, 'Referral completed - sender'),
    awardPoints(rows[0].receiver_id, 'REFERRAL_COMPLETE', 'referral', referralId, 'Referral completed - receiver'),
  ]);

  return updated[0];
};

// ─── List referrals ───────────────────────────────────────────────────────────
const listReferrals = async (agentId, { status, direction = 'all' }, { limit, offset }) => {
  const conditions = [];
  const params     = [];
  let p = 1;

  if (direction === 'sent')     { conditions.push(`r.sender_id = $${p++}`);   params.push(agentId); }
  else if (direction === 'received') { conditions.push(`r.receiver_id = $${p++}`); params.push(agentId); }
  else {
    conditions.push(`(r.sender_id = $${p} OR r.receiver_id = $${p})`);
    params.push(agentId); p++;
  }

  if (status) { conditions.push(`r.status = $${p++}`); params.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [countRes, dataRes] = await Promise.all([
    query(`SELECT COUNT(*) FROM referrals r ${where}`, params),
    query(
      `SELECT r.*,
         s.first_name AS sender_first, s.last_name AS sender_last, s.photo_url AS sender_photo,
         rc.first_name AS receiver_first, rc.last_name AS receiver_last, rc.photo_url AS receiver_photo
       FROM referrals r
       JOIN agents s  ON s.id  = r.sender_id
       LEFT JOIN agents rc ON rc.id = r.receiver_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, limit, offset]
    ),
  ]);

  return { referrals: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

// ─── Get referral by ID ───────────────────────────────────────────────────────
const getReferralById = async (referralId, agentId) => {
  const { rows } = await query(
    `SELECT r.*,
       s.first_name AS sender_first, s.last_name AS sender_last,
       rc.first_name AS receiver_first, rc.last_name AS receiver_last
     FROM referrals r
     JOIN agents s ON s.id = r.sender_id
     LEFT JOIN agents rc ON rc.id = r.receiver_id
     WHERE r.id = $1 AND (r.sender_id = $2 OR r.receiver_id = $2)`,
    [referralId, agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Referral not found');
  return rows[0];
};

module.exports = { createReferral, respondToReferral, completeReferral, listReferrals, getReferralById };
