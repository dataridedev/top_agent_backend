'use strict';
const { query, withTransaction } = require('../db/pool');
const { ApiError }               = require('../utils/errors');
const { awardPoints }            = require('../utils/points');
const { uploadToS3 }             = require('../config/awsFileHelper');

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
  const dataSql  = ` SELECT a.id, a.first_name, a.last_name, a.brokerage, a.photo_url,
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
     FROM agent_zillow_master a
     WHERE a.id = $1`,
    [agentId]
  );
  if (!rows.length) throw new ApiError(404, 'Agent not found');
  return rows[0];
};

// ─── Create agent (admin / auto-seed) ────────────────────────────────────────
const createAgent = async (data) => {
  const { name, company_name, profile_url, about_heading, about_description, specialization, team_heading, website_url, linkedin_url, facebook_url, instagram_url, youtube_url, twitter_url, city, email, office_number, license_number, phone_number, total_clients, total_hired, accepting_new_clients, service_areas, awards} = data;
  // const { license_number, first_name, last_name, email, phone, brokerage,
  //         bio, website, languages, specialties, areas_served } = data;

  const { rows } = await query(
    `INSERT INTO agent_zillow_master
       (name, company_name, profile_url, about_heading, about_description, specialization, team_heading, website_url, linkedin_url, facebook_url, instagram_url, youtube_url, twitter_url, city, email, office_number, license_number, phone_number, total_clients, total_hired, accepting_new_clients, service_areas, awards)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [name, company_name, profile_url, about_heading, about_description, specialization, team_heading, website_url, linkedin_url, facebook_url, instagram_url, youtube_url, twitter_url, city, email, office_number, license_number, phone_number, total_clients, total_hired, accepting_new_clients, service_areas, awards]
  );
  // const { rows } = await query(
  //   `INSERT INTO agents
  //      (license_number, first_name, last_name, email, phone, brokerage, bio, website, languages, specialties, areas_served)
  //    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  //    RETURNING *`,
  //   [license_number, first_name, last_name, email, phone, brokerage, bio,
  //    website, languages || [], specialties || [], areas_served || []]
  // );
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


// const claimAgent = async (agentId, userId, licenseNumber) => {
//   // Verify license matches
//   const { rows: agentRows } = await query(
//     'SELECT id, claimed_at, license_number FROM agent_zillow_master WHERE id = $1',
//     [agentId]
//   );
//   if (!agentRows.length) throw new ApiError(404, 'Agent not found');
//   if (agentRows[0].claimed_at) throw new ApiError(409, 'Profile already claimed');
//   if (agentRows[0].license_number.toLowerCase() !== licenseNumber.toLowerCase()) {
//     throw new ApiError(400, 'License number does not match');
//   }

//   await withTransaction(async (client) => {
//     await client.query(
//       `UPDATE agent_zillow_master SET claimed_at = NOW(), updated_at = NOW() WHERE id = $1`,
//       [agentId]
//     );
//     await client.query(
//       `UPDATE users SET agent_id = $1, updated_at = NOW() WHERE id = $2`,
//       [agentId, userId]
//     );
//   });

//   // Award founding agent points for profile completion
//   await awardPoints(agentId, 'PROFILE_COMPLETE', 'profile', agentId, 'Profile claimed and completed');

//   return getAgentById(agentId);
// };


const claimAgent = async (agentId, userId, licenseNumber) => {
  const { rows: agentRows } = await query(
    `SELECT id, claimed_at, license_number 
     FROM agent_zillow_master 
     WHERE id = $1`,
    [agentId]
  );

  if (!agentRows.length) {
    throw new ApiError(404, "Agent not found");
  }

  const agent = agentRows[0];

  if (agent.claimed_at) {
    throw new ApiError(409, "Profile already claimed");
  }

  if (agentRows[0].license_number.toLowerCase() !== licenseNumber.toLowerCase()) {
    throw new ApiError(400, 'License number does not match');
  }

  const updatedAgent = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE agent_zillow_master 
       SET claimed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [agentId]
    );

    return result.rows[0];
  });

  return updatedAgent;
};




 // ─── get Claim agent profile ──────────────────────────────────────────────────────

const claim = async () => {

  const { rows } =  await query(
       `SELECT 
  am.*,
  u."id" as user_id,
  u.first_name || ' ' || u.last_name as user_name,
  u.role as user_role
FROM agent_zillow_master am
LEFT JOIN users u 
  ON am.id = u.agent_id
WHERE am.claimed_at IS NOT NULL and u.agent_id is NULL 
ORDER BY am.claimed_at DESC; `
    );

  return rows;
};

 // ─── get unClaim agent profile ──────────────────────────────────────────────────────

// const unclaimAgent = async () => {

//   const { rows } =  await query(
//        `SELECT * from agent_zillow_master where claimed_at IS  NULL  `
//     );

//   return rows;
// };

const unclaimAgent = async (page = 1, limit = 10, search = "") => {
  page = Math.max(parseInt(page) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

  const offset = (page - 1) * limit;

  let whereClause = `WHERE claimed_at IS NULL`;
  let values = [];

  // 🔍 SEARCH FIXED
  if (search && search.trim() !== "") {
    const searchValue = `%${search.trim().replace(/\s+/g, '%')}%`;

    values.push(searchValue);

    whereClause += `
      AND (
        COALESCE(name, '') ILIKE $1
        OR COALESCE(city, '') ILIKE $1
      )
    `;
  }

  // 🔹 COUNT QUERY (SAFE)
  const countQuery = `
    SELECT COUNT(*) 
    FROM agent_zillow_master
    ${whereClause}
  `;

  const { rows: countRows } = await query(countQuery, values);
  const total = Number(countRows?.[0]?.count || 0);

  // 🔹 DATA QUERY (IMPORTANT FIX)
  const dataQuery = `
    SELECT * 
    FROM agent_zillow_master
    ${whereClause}
    ORDER BY id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  const finalValues = [...values, limit, offset];

  const result = await query(dataQuery, finalValues);
  const rows = result.rows || [];

  return {
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      currentCount: rows.length,
      hasNext: page * limit < total,
      hasPrev: page > 1,
      remaining: Math.max(total - page * limit, 0),
    },
  };
};


 // ─── get unClaim agent profile ──────────────────────────────────────────────────────

// const ActiveAgent = async () => {

//   const { rows } =  await query(
//        `SELECT * from agent_zillow_master a
//        join users u on  a.id=u.agent_id
//        where u.agent_id is not null and a.agent_verified=true and u.is_active=true
//  `
//     );

//   return rows;
// };

const ActiveAgent = async (page = 1, limit = 10, search = "") => {
  page = parseInt(page);
  limit = parseInt(limit);

  const offset = (page - 1) * limit;

  let whereClause = `
    WHERE u.agent_id IS NOT NULL 
    AND a.agent_verified = true 
    AND u.is_active = true
  `;

  let values = [];
  let paramIndex = 1;

  // 🔍 Search (name + email + city)
  if (search) {
    whereClause += `
      AND (
        COALESCE(a.name, '') ILIKE $${paramIndex}
        OR COALESCE(a.city, '') ILIKE $${paramIndex}
        OR COALESCE(u.email, '') ILIKE $${paramIndex}
      )
    `;
    values.push(`%${search}%`);
    paramIndex++;
  }

  // 🔹 Total count
  const countQuery = `
    SELECT COUNT(*) 
    FROM agent_zillow_master a
    JOIN users u ON a.id = u.agent_id
    ${whereClause}
  `;

  const { rows: countRows } = await query(countQuery, values);
  const total = parseInt(countRows[0].count);

  // 🔹 Data query
  const dataQuery = `
    SELECT a.*, u.email, u.is_active
    FROM agent_zillow_master a
    JOIN users u ON a.id = u.agent_id
    ${whereClause}
    ORDER BY a.id DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  values.push(limit, offset);

  const { rows } = await query(dataQuery, values);

  return {
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

 // ─── edit  Claim agent profile ──────────────────────────────────────────────────────

// const editClaimAgentByAdmin = async (agentId, agent_verified,userId) => {

  let queryText;
  let values;

//   if (agent_verified === true) {


//     queryText = `
//       UPDATE agent_zillow_master 
//       SET agent_verified = $1,
//           updated_at = NOW()
//       WHERE id = $2
//       RETURNING *
//     `;

//        await client.query(
//       `UPDATE users 
//        SET agent_id = $1, updated_at = NOW() 
//        WHERE id = $2`,
//       [agentId, userId]
//     );

//     values = [true, agentId];

//   } else {


//     queryText = `
//       UPDATE agent_zillow_master 
//       SET agent_verified = $1,
//           claimed_at = NULL,
//           updated_at = NOW()
//       WHERE id = $2
//       RETURNING *
//     `;

//     values = [false, agentId];
//   }

//   const { rows } = await query(queryText, values);

//   console.log("UPDATED AGENT DATA:", rows[0]);

//   return rows[0];
// };

const editClaimAgentByAdmin = async (agentId, agent_verified, userId) => {
  // const client = await pool.connect();

  try {
    await query("BEGIN");

    let agentQuery;
    let values;

    if (agent_verified === true) {
      // ✅ Agent verify = TRUE
      agentQuery = `
        UPDATE agent_zillow_master 
        SET agent_verified = true,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      values = [agentId];

    } else {
      // ❌ Agent verify = FALSE
      agentQuery = `
        UPDATE agent_zillow_master 
        SET agent_verified = false,
            claimed_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      values = [agentId];
    }

    // 🔹 Step 1: Update Agent Table
    const agentResult = await query(agentQuery, values);

    if (agentResult.rows.length === 0) {
      throw new Error("Agent not found");
    }

    const updatedAgent = agentResult.rows[0];

    // 🔹 Step 2: ONLY if verified = true → update users
    if (agent_verified === true) {
      await query(
        `
        UPDATE users 
        SET agent_id = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [agentId, userId]
      );
    }

    await query("COMMIT");

    console.log("UPDATED AGENT DATA:", updatedAgent);

    return updatedAgent;

  } catch (error) {
    await query("ROLLBACK");
    console.error("Error:", error);
    throw error;
  } 
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


// ------------------------------------------

  
// const getAllAgentService = async (
//   { searchKey },
//   { page=1 , limit=20  } = {}
// ) => {

//   const conditions = [];
//   const params = [];
//   let p = 1;

//   const safeLimit = Number(limit) || 20;
//   const safeOffset = (Number(page) - 1) * safeLimit;


//   const cleanSearch = searchKey?.trim().replace(/\s+/g, ' ');


//   if (cleanSearch) {

//     conditions.push(`
//       (
    
//         a.name ILIKE $${p}

//         -- ✅ Company search
//         OR a.company_name ILIKE $${p}

       
//         OR a.city ILIKE $${p}
   
//         OR a.specialization ILIKE $${p}
//         OR a.about_heading ILIKE $${p}
//         OR a.about_description ILIKE $${p}
//       )
//     `);

//     params.push(`%${cleanSearch}%`);
//     p++;
//   }

//   // ===============================
//   // WHERE
//   // ===============================
//   const where = conditions.length
//     ? `WHERE ${conditions.join(' AND ')}`
//     : '';

//   // ===============================
//   // MAIN QUERY
//   // ===============================
//   const dataSql = `
//     SELECT 
//       a.id,
//       a.name,
//       a.company_name,
//       a.profile_url,
//       a.total_reviews,
//       a.sales_last_12_months,
//       a.total_sales_amount,
//       a.avg_price,
//       a.price_range_min,
//       a.price_range_max,
//       a.about_heading,
//       a.about_description,
//       a.specialization,
//       a.team_heading,
//       a.website_url,
//       a.linkedin_url,
//       a.facebook_url,
//       a.instagram_url,
//       a.youtube_url,
//       a.twitter_url,
//       a.created_at,
//       a.updated_at,
//       a.city,
//       a.email,
//       a.office_number,
//       a.license_number,
//       a.phone_number,
//       a.total_hired,
//       a.avg_rating
//     FROM agent_zillow_master a
//     ${where}
//     ORDER BY a.id DESC
//     LIMIT $${p} OFFSET $${p + 1}
//   `;

//   const countSql = `
//     SELECT COUNT(*) 
//     FROM agent_zillow_master a 
//     ${where}
//   `;

//   // ===============================
//   // EXECUTION
//   // ===============================
//   const [countRes, dataRes] = await Promise.all([
//     query(countSql, params),
//     query(dataSql, [...params, safeLimit, safeOffset]),
//   ]);

//   return {
//     success: true,
//     agents: dataRes.rows,
//     totalAgents: parseInt(countRes.rows[0].count, 10),
//     page: Number(page),
//     limit: safeLimit
//   };
// };

const getAllAgentService = async (
  { searchKey, sortOrder  },
  { page = 1, limit = 20 } = {}
) => {
  const conditions = [];
  const params = [];
  let p = 1;

  // ===============================
  // SAFE PAGINATION
  // ===============================
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeOffset = (safePage - 1) * safeLimit;

  // ===============================
  // SAFE SORT ORDER
  // ===============================
  const order = sortOrder?.toLowerCase() === "desc" ? "DESC" : "ASC";

  // ===============================
  // CLEAN SEARCH
  // ===============================
  const cleanSearch = searchKey?.trim().replace(/\s+/g, " ");

  // ===============================
  // SEARCH CONDITIONS
  // ===============================
  if (cleanSearch) {
    conditions.push(`
      (
        a.name ILIKE $${p}
        OR a.company_name ILIKE $${p}
        OR a.city ILIKE $${p}
        OR a.specialization ILIKE $${p}
        OR a.about_heading ILIKE $${p}
        OR a.about_description ILIKE $${p}
      )
    `);

    params.push(`%${cleanSearch}%`);
    p++;
  }

  // ===============================
  // WHERE CLAUSE
  // ===============================
  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // ===============================
  // MAIN DATA QUERY
  // ===============================
  const dataSql = `
    SELECT 
      a.id,
      a.name,
      a.company_name,
      a.profile_url,
      a.total_reviews,
      a.sales_last_12_months,
      a.total_sales_amount,
      a.avg_price,
      a.price_range_min,
      a.price_range_max,
      a.about_heading,
      a.about_description,
      a.specialization,
      a.team_heading,
      a.website_url,
      a.linkedin_url,
      a.facebook_url,
      a.instagram_url,
      a.youtube_url,
      a.twitter_url,
      a.created_at,
      a.updated_at,
      a.city,
      a.email,
      a.office_number,
      a.license_number,
      a.phone_number,
      a.total_hired,
      a.avg_rating,
      a.claimed_at
    FROM agent_zillow_master a
    ${where}
    ORDER BY 
      CASE WHEN a.claimed_at IS NOT NULL THEN 0 ELSE 1 END,  
      a.name ${order}                 -- dynamic asc/desc
    LIMIT $${p} OFFSET $${p + 1}
  `;

  // ===============================
  // COUNT QUERY
  // ===============================
  const countSql = `
    SELECT COUNT(*) 
    FROM agent_zillow_master a 
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
    agents: dataRes.rows,
    totalAgents: parseInt(countRes.rows[0].count, 10),
    page: safePage,
    limit: safeLimit,
  };
};



const getAllAgentDetailsService = async (agentId) => {
  console.log('Fetching all agents from service');

  const { rows } = await query(
    `SELECT 
      a.*,
      COALESCE(
          jsonb_agg(
              DISTINCT jsonb_build_object(
                  'property_title', ap.property_title,
                  'property_address', ap.property_address,
                  'property_type', ap.property_type,
                  'status', ap.status,
                  'bedrooms', ap.bedrooms,
                  'bathrooms', ap.bathrooms,
                  'listing_price', ap.listing_price,
                  'sold_price', ap.sold_price,
                  'listed_date', ap.listed_date,
                  'image_urls', ap.image_urls,
                  'property_url', ap.property_url
              )
          ) FILTER (WHERE ap.id IS NOT NULL),
          '[]'
      ) AS properties,

      COALESCE(
          jsonb_agg(
              DISTINCT jsonb_build_object(
                  'reviewer_name', rm.reviewer_name,
                  'review_title', rm.review_title,
                  'review_description', rm.review_description,
                  'rating', rm.rating,
                  'review_date', rm.review_date
              )
          ) FILTER (WHERE rm.id IS NOT NULL),
          '[]'
      ) AS reviews,

      COALESCE(
          jsonb_agg(
              DISTINCT jsonb_build_object(
                  'member_name', tm.member_name,
                  'rating', tm.rating,
                  'sales_range_min', tm.sales_range_min,
                  'sales_range_max', tm.sales_range_max,
                  'total_sales', tm.total_sales
              )
          ) FILTER (WHERE tm.id IS NOT NULL),
          '[]'
      ) AS team

    FROM   agent_zillow_master a
    LEFT JOIN agent_properties ap ON a.id = ap.agent_id
    LEFT JOIN reviews_zillow_master rm ON a.id = rm.agent_id
    LEFT JOIN team_members tm ON a.id = tm.agent_id

    WHERE a.id = $1

    GROUP BY a.id
    ORDER BY a.id DESC;`,
    [agentId]
  );

  
  // const { rows } = await query(
  //   `SELECT 
  //    * from agent_detail
  //   WHERE agent_id = $1
  // `, [agentId]);

  return rows;
};


const getUserInfo = async (userId) => {
  const { rows } = await query(   
    `SELECT *
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0];
}

const UserAvatar = async (userId, file) => {
  
  if (!file || !file.buffer) {
    throw new Error("Invalid file");
  }

  // 1. Upload to S3
  const uploadResult = await uploadToS3(file);

  if (!uploadResult || !uploadResult.Location) {
    throw new Error("S3 upload failed");
  }

  const avatarUrl = uploadResult.Location;

  // 2. Save in DB
  const { rows } = await query(
    `UPDATE users 
     SET avatar_url = $1, 
         updated_at = NOW() 
     WHERE id = $2 
     RETURNING avatar_url`,
    [avatarUrl, userId]
  );

  return rows[0];
};





const UserInfo = async (userId, payload ) => {

  // const { first_name, last_name, role,phone,company_name	,address,	city} = payload;
  // 1. Check if user exists
  const userResult = await query(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const existingUser = userResult.rows[0];

  // 2. Merge old + new values
  const updatedData = {
    first_name: payload.first_name ?? existingUser.first_name,
    last_name: payload.last_name ?? existingUser.last_name,
    role: payload.role ?? existingUser.role,
    phone: payload.phone ?? existingUser.phone,
    company_name: payload.company_name ?? existingUser.company_name,
    address: payload.address ?? existingUser.address,
    city: payload.city ?? existingUser.city,
  };

  // 3. Update query
  const { rows } = await query(
    `UPDATE users 
     SET first_name = $1,
         last_name = $2,
         role = $3,
         phone = $4,
         company_name = $5,
         address = $6,
         city = $7,
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      updatedData.first_name,
      updatedData.last_name,
      updatedData.role,
      updatedData.phone,
      updatedData.company_name,
      updatedData.address,
      updatedData.city,
      userId
    ]
  );

  return {message: "Data updated successfully"};
};  






module.exports = {
  searchAgents, getAgentById, createAgent, updateAgent, getAllAgentService, getAllAgentDetailsService,
  claimAgent, getAgentStats, getAgentReviews, recalculateTiers,claim,editClaimAgentByAdmin, getUserInfo
  ,UserAvatar, UserInfo,ActiveAgent,unclaimAgent
};
