'use strict';
const cron   = require('node-cron');
const { query } = require('../db/pool');

/**
 * Register all scheduled jobs.
 * Called once from app.js after the server starts.
 */
const registerJobs = () => {

  // ── Nightly tier & score recalculation — 2:00 AM every day ───────────────
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running nightly tier recalculation…');
    try {
      await query('SELECT update_agent_scores()');
      console.log('[CRON] Tier recalculation complete');
    } catch (err) {
      console.error('[CRON] Tier recalculation failed:', err.message);
    }
  });

  // ── Annual year_points reset — 00:05 on January 1st ───────────────────────
  cron.schedule('5 0 1 1 *', async () => {
    console.log('[CRON] Running annual points reset…');
    try {
      await query('UPDATE agents SET year_points = 0, updated_at = NOW()');
      console.log('[CRON] Annual points reset complete');
    } catch (err) {
      console.error('[CRON] Annual reset failed:', err.message);
    }
  });

  // ── Clean up expired tokens — every 6 hours ───────────────────────────────
  cron.schedule('0 */6 * * *', async () => {
    try {
      const [rt, prt, evt] = await Promise.all([
        query('DELETE FROM refresh_tokens       WHERE expires_at < NOW() OR revoked = true'),
        query('DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = true'),
        query('DELETE FROM email_verification_tokens WHERE expires_at < NOW() OR used = true'),
      ]);
      console.log(`[CRON] Token cleanup: ${rt.rowCount + prt.rowCount + evt.rowCount} rows deleted`);
    } catch (err) {
      console.error('[CRON] Token cleanup failed:', err.message);
    }
  });

  // ── City agent counts refresh — every hour ────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      await query(`
        UPDATE cities c
        SET total_agents = (
          SELECT COUNT(*)
          FROM agents a
          WHERE c.city_name = ANY(a.areas_served)
            AND a.claimed_at IS NOT NULL
        )
      `);
    } catch (err) {
      console.error('[CRON] City count refresh failed:', err.message);
    }
  });

  // ── Founding Agent badge award — runs daily at 3:00 AM ───────────────────
  // Awards the Founding Agent badge to all agents who claimed in year 1
  cron.schedule('0 3 * * *', async () => {
    try {
      const { rows: badge } = await query(
        "SELECT id FROM badges WHERE badge_name = 'Founding Agent'"
      );
      if (!badge.length) return;

      // Year 1 = first 365 days from the earliest claimed profile
      const { rows: earliest } = await query(
        'SELECT MIN(claimed_at) AS first_claim FROM agents WHERE claimed_at IS NOT NULL'
      );
      if (!earliest[0].first_claim) return;

      const cutoff = new Date(earliest[0].first_claim);
      cutoff.setFullYear(cutoff.getFullYear() + 1);

      await query(`
        INSERT INTO agent_badges (agent_id, badge_id, year_earned, requirements_met)
        SELECT a.id, $1, EXTRACT(YEAR FROM a.claimed_at)::int,
               jsonb_build_object('claimed_at', a.claimed_at, 'cutoff', $2)
        FROM agents a
        WHERE a.claimed_at IS NOT NULL
          AND a.claimed_at <= $2
        ON CONFLICT (agent_id, badge_id, year_earned) DO NOTHING
      `, [badge[0].id, cutoff]);
    } catch (err) {
      console.error('[CRON] Founding Agent badge failed:', err.message);
    }
  });

  console.log('[CRON] All jobs registered');
};

module.exports = { registerJobs };
