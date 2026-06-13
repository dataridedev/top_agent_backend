'use strict';
const { query, withTransaction } = require('../db/pool');
const { ApiError }               = require('../utils/errors');
const { awardPoints }            = require('../utils/points');
const { uploadToS3 }             = require('../config/awsFileHelper');

const createdBadges = async (data) => {
  const {
    badge_name,
    badge_description,
    requirements,
    badge_color,
    is_career_badge,
    verification,
    type,
    file
  } = data;

  // Upload image to S3
  const uploadResult = await uploadToS3(file);

  if (!uploadResult || !uploadResult.Location) {
    throw new Error('S3 upload failed');
  }

  const badge_icon = uploadResult.Location;

  const result = await query(
    `
      INSERT INTO badges (
        badge_name,
        badge_description,
        requirements,
        badge_icon,
        badge_color,
        is_career_badge,
        verification,
        type
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      badge_name,
      badge_description,
      requirements,
      badge_icon, // S3 URL
      badge_color,
      is_career_badge === 'true' || is_career_badge === true,
      verification,
      type
    ]
  );

  return result.rows[0];
};




module.exports = {
  createdBadges,
};
