'use strict';
/**
 * Seeds tiers, badges, and sample BC cities.
 * Run: node src/db/seed.js
 */
require('dotenv').config();
const { pool } = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Tiers ──────────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO tiers (tier_name, min_points, max_points, tier_order, min_reviews, min_avg_rating, min_platforms_connected, color_hex)
      VALUES
        ('BRONZE',   0,    249,  1, 1,  0.0, 0, '#CD7F32'),
        ('SILVER',   250,  599,  2, 5,  4.0, 1, '#C0C0C0'),
        ('GOLD',     600,  1199, 3, 15, 4.3, 2, '#FFD700'),
        ('PLATINUM', 1200, 2499, 4, 30, 4.5, 3, '#E5E4E2'),
        ('DIAMOND',  2500, 4999, 5, 50, 4.7, 3, '#B9F2FF'),
        ('LUMINARY', 5000, NULL, 6, 100,4.8, 3, '#9966CC')
      ON CONFLICT (tier_name) DO NOTHING
    `);

    // ── Career Badges ───────────────────────────────────────────────────────
    const badges = [
      { name: 'Hall of Excellence',     desc: 'Gold tier or above for three consecutive years',           career: true  },
      { name: 'Circle of Trust',        desc: '100+ lifetime verified reviews, 4.5+ avg across platforms',career: true  },
      { name: 'Referral Champion',      desc: '50+ completed referrals sent or received',                 career: true  },
      { name: 'Luminary of Distinction',desc: 'Luminary tier achieved in any three separate calendar years', career: true },
      { name: 'Founding Agent',         desc: 'Claimed profile in Year 1 of platform launch',             career: true  },
      { name: 'Top Giving Agent',       desc: 'Supported charitable causes for 3+ consecutive years',     career: true  },
      { name: 'Perfect Responder',      desc: 'Maintained 100% response rate for a full calendar year',   career: true  },
    ];

    for (const b of badges) {
      await client.query(`
        INSERT INTO badges (badge_name, badge_description, is_career_badge)
        VALUES ($1, $2, $3) ON CONFLICT (badge_name) DO NOTHING
      `, [b.name, b.desc, b.career]);
    }

    // ── BC Cities ───────────────────────────────────────────────────────────
    const cities = [
      ['Vancouver',      'Greater Vancouver', 'BC', 'vancouver',       675218, 1200000],
      ['Burnaby',        'Greater Vancouver', 'BC', 'burnaby',         249125,  980000],
      ['Surrey',         'Greater Vancouver', 'BC', 'surrey',          568322,  890000],
      ['Richmond',       'Greater Vancouver', 'BC', 'richmond',        209937,  960000],
      ['Coquitlam',      'Greater Vancouver', 'BC', 'coquitlam',       148625,  870000],
      ['Kelowna',        'Okanagan',          'BC', 'kelowna',         136853,  750000],
      ['Victoria',       'Vancouver Island',  'BC', 'victoria',        367770,  820000],
      ['Abbotsford',     'Fraser Valley',     'BC', 'abbotsford',      153524,  720000],
      ['Kamloops',       'Interior BC',       'BC', 'kamloops',        97902,   520000],
      ['Nanaimo',        'Vancouver Island',  'BC', 'nanaimo',         99863,   600000],
      ['Langley',        'Greater Vancouver', 'BC', 'langley',         132603,  880000],
      ['Delta',          'Greater Vancouver', 'BC', 'delta',           108455,  920000],
      ['New Westminster','Greater Vancouver', 'BC', 'new-westminster', 78916,   790000],
      ['Penticton',      'Okanagan',          'BC', 'penticton',       33761,   620000],
      ['Vernon',         'Okanagan',          'BC', 'vernon',          40116,   560000],
      ['Prince George',  'Interior BC',       'BC', 'prince-george',   74003,   380000],
      ['Chilliwack',     'Fraser Valley',     'BC', 'chilliwack',      93203,   680000],
      ['Maple Ridge',    'Greater Vancouver', 'BC', 'maple-ridge',     90990,   810000],
    ];

    for (const [city, region, prov, slug, pop, price] of cities) {
      await client.query(`
        INSERT INTO cities (city_name, region, province, slug, population, avg_home_price,
          seo_title, seo_description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (slug) DO NOTHING
      `, [
        city, region, prov, slug, pop, price,
        `Top Real Estate Agents in ${city}, BC | TopAgents.ca`,
        `Find the best reviewed real estate agents in ${city}, BC. Read verified reviews, compare ratings, and connect with top-rated local agents.`,
      ]);
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED FAIL]', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
