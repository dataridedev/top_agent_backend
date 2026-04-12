/**
 * Canonical point values for every action on the platform.
 * Referenced by controllers when awarding points.
 */
const POINTS = {
  // Reviews
  REVIEW_NATIVE_VERIFIED:      50,
  REVIEW_IMPORTED:             20,
  REVIEW_RESPONDED:            10,
  REVIEW_INVITE_SENT:           8, // max 60/year

  // Referrals
  REFERRAL_SENT_COMPLETED:     80,
  REFERRAL_RECEIVED_COMPLETED: 80,

  // Leads
  LEAD_RESPONSE_UNDER_1H:      20,
  LEAD_RESPONSE_UNDER_2H:      10,

  // Profile
  PROFILE_COMPLETED:          100, // one-time
  BADGE_EMBEDDED:              40,  // one-time

  // Platform connections
  PLATFORM_CONNECTED_FIRST:    75,  // one-time
  PLATFORM_CONNECTED_EXTRA:    35,

  // Tier milestone
  TIER_UPGRADED:               25,

  // Tenure
  ANNUAL_ACTIVE_BONUS:        150,
};

/**
 * Rating quality multipliers applied to review points.
 */
const RATING_MULTIPLIERS = {
  ELITE:    { min: 4.8, multiplier: 1.25 },
  QUALITY:  { min: 4.5, multiplier: 1.10 },
  STANDARD: { min: 0,   multiplier: 1.00 },
};

/**
 * Annual per-agent caps on certain point actions.
 */
const ANNUAL_CAPS = {
  REVIEW_INVITE_SENT: 60,
};

/**
 * Referral status values.
 */
const REFERRAL_STATUS = {
  PENDING:     'PENDING',
  ACCEPTED:    'ACCEPTED',
  DECLINED:    'DECLINED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
};

/**
 * Review status values.
 */
const REVIEW_STATUS = {
  PENDING:  'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

/**
 * Lead status values.
 */
const LEAD_STATUS = {
  NEW:       'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  CLOSED:    'CLOSED',
};

module.exports = { POINTS, RATING_MULTIPLIERS, ANNUAL_CAPS, REFERRAL_STATUS, REVIEW_STATUS, LEAD_STATUS };
