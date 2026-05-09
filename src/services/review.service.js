'use strict';
const { query, withTransaction } = require('../db/pool');
const { ApiError }               = require('../utils/errors');
const { awardPoints }            = require('../utils/points');
const { v4: uuidv4 }             = require('uuid');



const verifyscrapreview = async (userId, search, limit, page) => {
  try {
    // ===============================
    // SAFE PAGINATION
    // ===============================
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Number(limit) || 10);
    const safeOffset = (safePage - 1) * safeLimit;

    // ===============================
    // CLEAN SEARCH
    // ===============================
    const cleanSearch =
      typeof search === "string" ? search.trim().replace(/\s+/g, " ") : "";

    const conditions = [`"user_id" = $1`];
    const params = [userId];
    let p = 2;

    // ===============================
    // SEARCH CONDITION
    // ===============================
    if (cleanSearch) {
      conditions.push(`
        LOWER(reviewer_name) LIKE LOWER($${p})
      `);
      params.push(`%${cleanSearch}%`);
      p++;
    }

    // ===============================
    // WHERE CLAUSE
    // ===============================
    const where = `WHERE ${conditions.join(" AND ")}`;

    // ===============================
    // DATA QUERY
    // ===============================
    const dataSql = `
      SELECT *,TO_CHAR(rating_posted_date, 'YYYY-MM-DD') AS rating_posted_date
      FROM reviews_zillow_master
      ${where}
      ORDER BY id DESC
      LIMIT $${p} OFFSET $${p + 1}
    `;

    // ===============================
    // COUNT QUERY
    // ===============================
    const countSql = `
      SELECT COUNT(*)
      FROM reviews_zillow_master
      ${where}
    `;

    // ===============================
    // EXECUTION
    // ===============================
    const [countRes, dataRes] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, safeLimit, safeOffset]),
    ]);

    return {
      success: true,
      data: dataRes.rows,
      page: safePage,
      limit: safeLimit,
      count: parseInt(countRes.rows[0].count, 10),
    };

  } catch (error) {
    console.error("verifyscrapreview error:", error);
    throw error;
  }
};
// ─── Create review ────────────────────────────────────────────────────────────
const createReview = async (data) => {
  const {
    agent_id, rating, reviewer_name, reviewer_email, text, title,
    platform = 'native', platform_review_id, platform_url, property_address,
    transaction_type, review_date,
    rating_communication, rating_negotiation, rating_market_knowledge,
    rating_responsiveness, rating_pricing, rating_paperwork,
    rating_availability, rating_recommendation,
  } = data;

  // Check agent exists
  const { rows: agent } = await query('SELECT id FROM agents WHERE id = $1', [agent_id]);
  if (!agent.length) throw new ApiError(404, 'Agent not found');

  // Deduplication for platform reviews
  if (platform !== 'native' && platform_review_id) {
    const { rows: dup } = await query(
      'SELECT id FROM reviews WHERE agent_id = $1 AND platform = $2 AND platform_review_id = $3',
      [agent_id, platform, platform_review_id]
    );
    if (dup.length) throw new ApiError(409, 'Review already imported');
  }

  const isNative   = platform === 'native';
  const finalDate  = review_date || new Date().toISOString().split('T')[0];

  const { rows } = await query(
    `INSERT INTO reviews
       (agent_id, platform, platform_review_id, platform_url, rating, title, text,
        reviewer_name, reviewer_email, review_date,
        verified, transaction_verified,
        property_address, transaction_type,
        rating_communication, rating_negotiation, rating_market_knowledge,
        rating_responsiveness, rating_pricing, rating_paperwork,
        rating_availability, rating_recommendation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      agent_id, platform, platform_review_id || null, platform_url || null,
      rating, title, text, reviewer_name, reviewer_email, finalDate,
      !isNative,       // platform reviews are auto-verified
      false,           // transaction_verified set manually
      property_address, transaction_type,
      rating_communication || null, rating_negotiation || null,
      rating_market_knowledge || null, rating_responsiveness || null,
      rating_pricing || null, rating_paperwork || null,
      rating_availability || null, rating_recommendation || null,
    ]
  );

  const review = rows[0];

  // Award points for platform-imported reviews immediately
  if (!isNative) {
    const isFirst = await isPlatformConnectionNew(agent_id, platform);
    if (isFirst) {
      await awardPoints(agent_id, 'PLATFORM_CONNECT_FIRST', 'review', review.id, `First ${platform} review imported`);
    }
    await awardPoints(agent_id, 'REVIEW_PLATFORM', 'review', review.id, `Review imported from ${platform}`);
  }

  return review;
};



const addAgentReview = async (data) => {
  const {
    agent_id,
    reviewer_name,
    review_title,
    review_description,
    rating,
    review_date,
    review_source
  } = data;

  // ✅ Check agent exists
  const { rows: agent } = await query(
    'SELECT id FROM agents WHERE id = $1',
    [agent_id]
  );

  if (!agent.length) {
    throw new ApiError(404, 'Agent not found');
  }

  // ✅ Safe date
  // const finalDate =
  //   review_date || new Date().toISOString().split('T')[0];
  const finalDate = review_date
  ? new Date(review_date).toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0];

  // ✅ Insert into correct table
  const { rows } = await query(
    `INSERT INTO reviews_zillow_master
      (agent_id, reviewer_name, review_title, review_description, rating, review_date, review_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      agent_id,
      reviewer_name,
      review_title,
      review_description,
      rating,
      finalDate,
      review_source
    ]
  );

  return rows[0];
};

// Helper: check if this is the first review from a given platform (proxy for connection)
const isPlatformConnectionNew = async (agentId, platform) => {
  const { rows } = await query(
    'SELECT COUNT(*) FROM reviews WHERE agent_id = $1 AND platform = $2',
    [agentId, platform]
  );
  return parseInt(rows[0].count, 10) <= 1;
};

// ─── Verify review (admin/moderation) ────────────────────────────────────────
const verifyReview = async (reviewId,is_expected,userId) => {
  const { rows } = await query(
    `UPDATE reviews_zillow_master SET is_expected  = ${is_expected} WHERE id = $1 RETURNING *`,
    [reviewId]
  );
  if (!rows.length) throw new ApiError(404, 'Review not found');

  // Award native review points on verification
  if (rows[0].platform === 'native') {
    await awardPoints(rows[0].agent_id, 'REVIEW_NATIVE', 'review', reviewId, 'Native review verified');
  }
    return {
    data: rows[0],

    message: is_expected
      ? "Review approved successfully"
      : "Review rejected successfully",
  };
};


// ─── Reply to review ──────────────────────────────────────────────────────────
const replyToReview = async (reviewId, agentId, response) => {
  const { rows } = await query(
    `UPDATE reviews
     SET agent_responded = true, agent_response = $1, response_date = NOW()
     WHERE id = $2 AND agent_id = $3
     RETURNING *`,
    [response, reviewId, agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Review not found or you do not own this agent profile');

  await awardPoints(agentId, 'REVIEW_RESPONSE', 'review', reviewId, 'Responded to review');
  return rows[0];
};

// ─── Report review ────────────────────────────────────────────────────────────
const reportReview = async (reviewId, userId, reason, description) => {
  // Check review exists
  const { rows } = await query('SELECT id FROM reviews WHERE id = $1', [reviewId]);
  if (!rows.length) throw new ApiError(404, 'Review not found');

  // Store report (naive: just flag for moderation)
  await query(
    `INSERT INTO review_reports (review_id, reported_by, reason, description)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING`,
    [reviewId, userId, reason, description]
  );
  return { message: 'Review reported for moderation' };
};

// ─── Bulk import reviews (platform sync) ─────────────────────────────────────
const bulkImportReviews = async (agentId, platform, reviews) => {
  let imported = 0;
  let skipped  = 0;

  for (const r of reviews) {
    try {
      await createReview({ ...r, agent_id: agentId, platform });
      imported++;
    } catch (err) {
      if (err.statusCode === 409) { skipped++; } // duplicate
      else throw err;
    }
  }
  return { imported, skipped, total: reviews.length };
};

// ─── Get review by ID ─────────────────────────────────────────────────────────
const getReviewById = async (reviewId) => {
  const { rows } = await query(
    `SELECT r.*, a.first_name, a.last_name, a.brokerage
     FROM reviews r JOIN agents a ON a.id = r.agent_id
     WHERE r.id = $1`,
    [reviewId]
  );
  if (!rows.length) throw new ApiError(404, 'Review not found');
  return rows[0];
};

module.exports = { createReview, verifyReview, replyToReview, reportReview, bulkImportReviews, getReviewById,addAgentReview,verifyscrapreview };
