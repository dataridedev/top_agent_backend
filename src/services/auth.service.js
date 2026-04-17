'use strict';
const { query, withTransaction } = require('../db/pool');
const { hash, compare }          = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { ApiError }               = require('../utils/errors');
const { v4: uuidv4 }             = require('uuid');
const config                     = require('../config');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require('puppeteer');
const StealthPlugin = require("puppeteer-extra-plugin-stealth");



// ─── Signup ───────────────────────────────────────────────────────────────────
const signup = async ({ email, password, first_name, last_name, role = 'consumer' }) => {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) throw new ApiError(409, 'Email already registered');

  const password_hash = await hash(password);

  const { rows } = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, email, first_name, last_name, role`,
    [email, password_hash, first_name, last_name, role]
  );
  const user = rows[0];

  // Create verification token
  const token = uuidv4();
  await query(
    `INSERT INTO email_verification_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '24 hours')`,
    [user.id, token]
  );

  return { user, verificationToken: token };
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const { rows } = await query(
    'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
    [email]
  );
  if (!rows.length) throw new ApiError(401, 'Invalid email or password');

  const user = rows[0];
  if (!user.is_active) throw new ApiError(401, 'Account is deactivated');
  if (!user.password_hash) throw new ApiError(401, 'Please sign in with Google');

  const valid = await compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  // Update last login
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const accessToken  = signAccess(user.id, user.first_name, user.last_name, user.role);
  const refreshToken = signRefresh(user.id, user.first_name, user.last_name, user.role);

  // Persist refresh token
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '30 days')`,
    [user.id, refreshToken]
  );

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
};

///-------- google or facebook login ───────────────────────────────────────────────────────────


const socialAuth = async ({ provider, idToken, accessToken }) => {
  try {
    let email, first_name, last_name, avatar_url, socialId;

    // ================= GOOGLE =================
    if (provider === 'google') {

      if (!idToken) {
        throw new ApiError(400, 'Google idToken is required');
      }

      let ticket;

      try {
        ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch (err) {
        console.log("Google verify failed, retry without audience check");

        // fallback (fix audience mismatch issue)
        ticket = await googleClient.verifyIdToken({
          idToken,
        });
      }

      const payload = ticket.getPayload();

      if (!payload) {
        throw new ApiError(401, 'Invalid Google token payload');
      }

      socialId = payload.sub;
      email = payload.email;
      first_name = payload.given_name;
      last_name = payload.family_name;
      avatar_url = payload.picture;
    }

    // ================= FACEBOOK =================
    else if (provider === 'facebook') {

      if (!accessToken) {
        throw new ApiError(400, 'Facebook accessToken is required');
      }

      const fbRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );

      const data = await fbRes.json();

      if (!data || !data.email) {
        throw new ApiError(401, 'Facebook email not provided');
      }

      socialId = data.id;
      email = data.email;
      first_name = data.name?.split(' ')[0] || '';
      last_name = data.name?.split(' ')[1] || '';
      avatar_url = data.picture?.data?.url || null;
    }

    else {
      throw new ApiError(400, 'Invalid provider');
    }

    if (!email) {
      throw new ApiError(401, 'Email not found from provider');
    }

    const normalizedEmail = email.toLowerCase();

    // ================= CHECK USER =================
    const existing = await query(
      `SELECT * FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    let user;

    const column = provider === 'google' ? 'google_id' : 'facebook_id';

    // ================= CREATE USER =================
    if (!existing.rows.length) {

      const { rows } = await query(
        `INSERT INTO users 
        (email, first_name, last_name, avatar_url, ${column}, is_verified, is_active, role, last_login_at)
        VALUES ($1,$2,$3,$4,$5,true,true,'consumer',NOW())
        RETURNING id, email, first_name, last_name, role, avatar_url`,
        [
          normalizedEmail,
          first_name,
          last_name,
          avatar_url,
          socialId
        ]
      );

      user = rows[0];
    }

    // ================= UPDATE USER =================
    else {

      const { rows } = await query(
        `UPDATE users 
         SET ${column} = $1,
             first_name = COALESCE(first_name, $2),
             last_name = COALESCE(last_name, $3),
             avatar_url = COALESCE(avatar_url, $4),
             is_verified = true,
             last_login_at = NOW(),
             updated_at = NOW()
         WHERE email = $5
         RETURNING id, email, first_name, last_name, role, avatar_url`,
        [
          socialId,
          first_name,
          last_name,
          avatar_url,
          normalizedEmail
        ]
      );

      user = rows[0];
    }

    // ================= JWT =================
    const token = signAccess(user.id);
    const refreshToken = signRefresh(user.id);

    return {
      user,
      accessToken: token,
      refreshToken,
    };

  } catch (err) {
    console.error('Social Auth Error:', err);
    throw err;
  }
};



// ─── Refresh token ────────────────────────────────────────────────────────────
const refreshTokens = async (refreshToken) => {
  let payload;
  try { payload = verifyRefresh(refreshToken); }
  catch { throw new ApiError(401, 'Invalid or expired refresh token'); }

  const { rows } = await query(
    `SELECT id FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()`,
    [refreshToken]
  );
  if (!rows.length) throw new ApiError(401, 'Refresh token revoked or expired');

  // Rotate — revoke old, issue new
  await query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);

  const newAccess  = signAccess(payload.sub);
  const newRefresh = signRefresh(payload.sub);
  await query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '30 days')`,
    [payload.sub, newRefresh]
  );

  return { accessToken: newAccess, refreshToken: newRefresh };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (refreshToken) => {
  await query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refreshToken]);
};






const scrapeZillowAgentProvider = async ({ url }) => {
    let browser, page;
    let agentId = null;

    const safeNum = (v) => v ? parseFloat(String(v).replace(/[^0-9.]/g, "")) || null : null;
    const safeInt = (v) => v ? parseInt(String(v).replace(/[^0-9]/g, "")) || null : null;

    const cleanPrice = (str) => {
        if (!str) return null;
        let val = safeNum(str);
        if (!val) return null;

        if (str.includes('M')) val *= 1000000;
        else if (str.includes('K')) val *= 1000;

        return val;
    };

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        page = await browser.newPage();

        // ✅ FIX: prevent navigation timeout crash
        page.setDefaultNavigationTimeout(0);
        page.setDefaultTimeout(0);

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        await page.setExtraHTTPHeaders({
            "accept-language": "en-US,en;q=0.9",
        });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // =========================
        // SAFE NAVIGATION (FIXED)
        // =========================
        try {
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: 120000
            });
        } catch (e) {
            console.log("⚠ networkidle2 failed, retrying domcontentloaded...");

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 120000
            });
        }

        const html = await page.content();
        const $ = cheerio.load(html);

        // =========================
        // AGENT DATA
        // =========================
        const name = $("h1").text().trim();
        const team_heading = $("h2:contains('Team listings & sales')")
            .text()
            .replace(/Team listings & sales.*/, "")
            .trim() || "Team Listings";

        const company_name = $(".hJOiOT").first().text().trim();
        const phone_number = $("a[href^='tel:']").first().text().replace("tel:", "").trim();
        const office_number = $("a[href^='tel:']").eq(1).text().trim();
        const email = $("a[href^='mailto:']").text().trim();
        const address = $("a[href*='maps.google.com']").first().text().trim();

        const total_reviews = safeInt($("a[href='#reviews']").text());
        const sales_12m = safeInt($("span:contains('sales last 12 months')").prev().text());
        const total_sales = safeInt($("span:contains('total sales')").prev().text());
        const avg_price = safeNum($("span:contains('average price')").prev().text());

        const rangeText = $("span:contains('price range')").prev().text() || "";
        const rangeParts = rangeText.split("-");
        const price_min = cleanPrice(rangeParts[0]);
        const price_max = cleanPrice(rangeParts[1]);

 


  await page.waitForSelector('div[aria-hidden="true"] img', {
    timeout: 10000
}).catch(() => {});

const profile_url = await page.evaluate(() => {
    const img = document.querySelector('div[aria-hidden="true"] img');
    return img ? img.src : null;
});

//       const profile_url = await page.$eval(
//   'div[aria-hidden="true"] img',
//   img => img.getAttribute('src')
// );
      

        const specs = [];
        $(".iilNUJ").each((i, el) => specs.push($(el).text().trim()));

        const website_url = $("a:contains('Visit team website')").attr("href");

        const social = {
            fb: $("a[href*='facebook.com']").attr("href"),
            insta: $("a[href*='instagram.com']").attr("href"),
            yt: $("a[href*='youtube.com']").attr("href"),
            twitter: $("a[href*='x.com']").attr("href")
        };

        const about_h = $("h2:contains('Get to know')").text().trim();
        const about_d = $(".dcLnWx p").text().trim();

        // =========================
        // INSERT AGENT (SAFE)
        // =========================
        await query("BEGIN");

        const agentRes = await query(
            `INSERT INTO agent_zillow_master (
                name, team_heading, company_name, profile_url,
                total_reviews, sales_last_12_months, total_sales_amount,
                avg_price, price_range_min, price_range_max,
                about_heading, about_description, specialization,
                website_url, facebook_url, instagram_url,
                youtube_url, twitter_url,
                phone_number, office_number, email, address
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
            RETURNING id`,
            [
                name,
                team_heading,
                company_name,
                profile_url,
                total_reviews,
                sales_12m,
                total_sales,
                avg_price,
                price_min,
                price_max,
                about_h,
                about_d,
                specs.join(", "),
                website_url,
                social.fb,
                social.insta,
                social.yt,
                social.twitter,
                phone_number,
                office_number,
                email,
                address
            ]
        );

        agentId = agentRes.rows[0].id;

        if (!agentId) throw new Error("Agent insert failed");

        await query("COMMIT");

        // =========================
        // CHILD TRANSACTION START
        // =========================
        await query("BEGIN");

        // =========================
        // REVIEWS
        // =========================
        // let allReviews = [];
        // let hasNextPage = true;
        // let currentPage = 1;

        // while (hasNextPage) {
        //     console.log(`Scraping reviews page ${currentPage}...`);
        //     const pageHtml = await page.content();
        //     const $page = cheerio.load(pageHtml);

        //     $page('[data-c11n-component="Carousel.Slide"]').each((i, el) => {
        //         const slide = $page(el);
        //         const metaInfo = slide.find('ul[data-c11n-component="Text"] li.nVRGN');
                
        //         const reviewDate = metaInfo.eq(0).text().trim();
        //         const reviewerName = metaInfo.eq(1).text().replace('•', '').trim();
        //         const ratingLabel = slide.find('[data-c11n-component="RatingStars"]').attr('aria-label');
        //         const ratingValue = ratingLabel ? parseFloat(ratingLabel.split(' ')[0]) : 5.0;
        //         const reviewTitle = slide.find('h3[data-c11n-component="Heading"]').text().trim();
        //         const reviewDesc = slide.find('.kXeRhO .hvzgx').text().trim() || slide.find('.diIEdR .hvzgx').text().trim();

        //         if (reviewerName && reviewDesc) {
        //             allReviews.push({
        //                 agent_id: agentId,
        //                 reviewer_name: reviewerName,
        //                 review_title: reviewTitle,
        //                 review_description: reviewDesc,
        //                 rating: ratingValue,
        //                 review_date: reviewDate,
        //                 review_source: 'Zillow'
        //             });
        //         }
        //     });
        
        //     // Pagination logic: Next button dhundo
        //     const nextButton = await page.$('button[title="Next page"], a[title="Next page"]');
        //     if (nextButton) {
        //         const isBtnDisabled = await page.evaluate(btn => btn.disabled || btn.getAttribute('aria-disabled') === 'true', nextButton);
                
        //         if (!isBtnDisabled) {
        //             await nextButton.click();
        //             await new Promise(r => setTimeout(r, 3000)); // Rate limiting se bachne ke liye
        //             currentPage++;
        //             // Zillow often loads reviews dynamically, networkidle2 is risky inside loops, better wait for a selector
        //             await page.waitForSelector('[data-c11n-component="Carousel.Slide"]', { timeout: 5000 }).catch(() => {});
        //         } else {
        //             hasNextPage = false;
        //         }
        //     } else {
        //         hasNextPage = false;
        //     }

        //     // Safety break for testing (e.g., max 20 pages)
        //     if (currentPage > 50) break;


        let allReviews = [];

// wait until reviews are loaded
await page.waitForSelector('[data-c11n-component="Carousel.Slide"]', {
    timeout: 10000
}).catch(() => {});

const pageHtml = await page.content();
const $page = cheerio.load(pageHtml);

$page('[data-c11n-component="Carousel.Slide"]').each((i, el) => {

    const slide = $page(el);
    const metaInfo = slide.find('ul[data-c11n-component="Text"] li.nVRGN');

    const reviewDate = metaInfo.eq(0).text().trim();
    const reviewerName = metaInfo.eq(1).text().replace('•', '').trim();

    const ratingLabel = slide.find('[data-c11n-component="RatingStars"]').attr('aria-label');
    const ratingValue = ratingLabel
        ? parseFloat(ratingLabel.split(' ')[0])
        : 5.0;

    const reviewTitle = slide.find('h3[data-c11n-component="Heading"]').text().trim();

    const reviewDesc =
        slide.find('.kXeRhO .hvzgx').text().trim() ||
        slide.find('.diIEdR .hvzgx').text().trim();

    if (reviewerName && reviewDesc) {
        allReviews.push({
            agent_id: agentId,
            reviewer_name: reviewerName,
            review_title: reviewTitle,
            review_description: reviewDesc,
            rating: ratingValue,
            review_date: reviewDate,
            review_source: 'Zillow'
        });
    }
});

console.log("Reviews scraped:", allReviews.length);
        // =========================
        // TEAM MEMBERS
        // =========================
        const teamMembers = [];

        $("#team-member-card a[role='link']").each((idx, el) => {

            const mRange = ($(el).find("p:contains('price range')").find(".gaCWqj").text() || "").split("-");

            teamMembers.push({
                member_name: $(el).find("h3").text().trim(),
                rating: safeNum($(el).find(".cGSLnk .gaCWqj").text()),
                sales_range_min: cleanPrice(mRange[0]),
                sales_range_max: cleanPrice(mRange[1]),
                total_sales: safeInt($(el).find("p:contains('sales last 12 months')").find(".gaCWqj").text())
            });
        });

        // =========================
        // PROPERTIES
        // =========================
//         const properties = [];

//         $("#forSaleListings, #forRentListings, #pastSales").each((i, section) => {

//             const sectionId = $(section).attr("id");

//             let status =
//                 sectionId === "forRentListings" ? "rented"
//                 : sectionId === "pastSales" ? "sold"
//                 : "sale";

//             $(section).find("tbody tr").each((idx, row) => {

//                 const rowNode = $(row);

//                 const addressNode = rowNode.find(".MediaObject__Body-sc-12gs3hz-2");

//                 const line1 = addressNode.contents().first().text().trim();
//                 const line2 = addressNode.find("br").get(0)?.nextSibling?.nodeValue?.trim() || "";

//                 const fullAddress = `${line1} ${line2}`.trim();

//                 const propUrl = rowNode.find("a").attr("href");
//                 const image_urls = await page.$$eval(
//   'div.MediaObject__Media-sc-12gs3hz-3 img',
//   imgs => imgs.map(img => img.src)
// );

//                 if (!fullAddress || !propUrl) return;

//                 const fullUrl = propUrl.startsWith("http")
//                     ? propUrl
//                     : "https://www.zillow.com" + propUrl;

//                 let rawPrice = "";
//                 let soldDate = null;
//                 let beds = null;
//                 let baths = null;

//                 if (status === "sold") {
//                     soldDate = rowNode.find("td").eq(1).text().trim();
//                     rawPrice = rowNode.find("td").eq(2).text().trim();
//                 } else {
//                     rawPrice = rowNode.find("td:contains('$')").last().text().trim();

//                     const bedBathText = rowNode.find("td").eq(1).text().trim();

//                     beds = bedBathText.includes("Studio")
//                         ? 0
//                         : safeInt(bedBathText.split(",")[0]);

//                     baths = safeInt(bedBathText.split(",")[1]);
//                 }

//                 properties.push({
//                     property_title: line1,
//                     property_address: fullAddress,
//                     property_type: "Residential",
//                     status,
//                     bedrooms: beds,
//                     bathrooms: baths,
//                     listing_price: cleanPrice(rawPrice),
//                     sold_date: soldDate,
//                     image_urls: image_urls,
//                     property_url: fullUrl
//                 });
//             });
//         });


const properties = [];

$("#forSaleListings, #forRentListings, #pastSales").each((i, section) => {

    const sectionId = $(section).attr("id");

    let status =
        sectionId === "forRentListings" ? "rented"
        : sectionId === "pastSales" ? "sold"
        : "sale";

    $(section).find("tbody tr").each((idx, row) => {

        const rowNode = $(row);

        const addressNode = rowNode.find(".MediaObject__Body-sc-12gs3hz-2");

        const line1 = addressNode.contents().first().text().trim();
        const line2 = addressNode.find("br").get(0)?.nextSibling?.nodeValue?.trim() || "";

        const fullAddress = `${line1} ${line2}`.trim();

        const propUrl = rowNode.find("a").attr("href");

        // ✅ FIXED IMAGE EXTRACTION
        const image_url = rowNode
            .find("div.MediaObject__Media-sc-12gs3hz-3 img")
            .attr("src");

        if (!fullAddress || !propUrl) return;

        const fullUrl = propUrl.startsWith("http")
            ? propUrl
            : "https://www.zillow.com" + propUrl;

        let rawPrice = "";
        let soldDate = null;
        let beds = null;
        let baths = null;

        if (status === "sold") {
            soldDate = rowNode.find("td").eq(1).text().trim();
            rawPrice = rowNode.find("td").eq(2).text().trim();
        } else {
            rawPrice = rowNode.find("td:contains('$')").last().text().trim();

            const bedBathText = rowNode.find("td").eq(1).text().trim();

            beds = bedBathText.includes("Studio")
                ? 0
                : safeInt(bedBathText.split(",")[0]);

            baths = safeInt(bedBathText.split(",")[1]);
        }

        properties.push({
            property_title: line1,
            property_address: fullAddress,
            property_type: "Residential",
            status,
            bedrooms: beds,
            bathrooms: baths,
            listing_price: cleanPrice(rawPrice),
            sold_date: soldDate,
            image_url: image_url, // ✅ single correct image
            property_url: fullUrl
        });
    });
});
        // =========================
        // INSERT TEAM MEMBERS
        // =========================
        for (const m of teamMembers) {
            await query(
                `INSERT INTO team_members (agent_id, member_name, rating, sales_range_min, sales_range_max, total_sales)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [agentId, m.member_name, m.rating, m.sales_range_min, m.sales_range_max, m.total_sales]
            );
        }

        // =========================
        // INSERT PROPERTIES
        // =========================
        for (const p of properties) {
            await query(
                `INSERT INTO agent_properties
                (agent_id, property_title, property_address, property_type, status, bedrooms, bathrooms, listing_price, image_urls, property_url, sold_date)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 ON CONFLICT (property_url)
                 DO UPDATE SET status = EXCLUDED.status, listing_price = EXCLUDED.listing_price`,
                [
                    agentId,
                    p.property_title,
                    p.property_address,
                    p.property_type,
                    p.status,
                    p.bedrooms,
                    p.bathrooms,
                    p.listing_price,
                    [p.image_url],
                    p.property_url,
                    p.sold_date
                ]
            );
        }

        // =========================
        // INSERT REVIEWS
        // =========================
        for (const r of allReviews) {
            await query(
                `INSERT INTO reviews_zillow_master
                (agent_id, reviewer_name, review_title, review_description, rating, review_date, review_source)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT DO NOTHING`,
                [
                    agentId,
                    r.reviewer_name,
                    r.review_title,
                    r.review_description,
                    r.rating,
                    r.review_date,
                    r.review_source
                ]
            );
        }

        await query("COMMIT");

        return {
            success: true,
            agentId,
            reviews: allReviews.length,
            properties: properties.length,
            teamMembers: teamMembers.length
        };
      
    } catch (err) {
        try { await query("ROLLBACK"); } catch (e) {}
        console.error("Scrape Error:", err);
        throw err;

    } finally {
        if (browser) await browser.close();
    }
};






// ─── Verify email ─────────────────────────────────────────────────────────────
const verifyEmail = async (token) => {
  const { rows } = await query(
    `SELECT user_id FROM email_verification_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [token]
  );
  if (!rows.length) throw new ApiError(400, 'Invalid or expired verification token');

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET is_verified = true WHERE id = $1', [rows[0].user_id]);
    await client.query('UPDATE email_verification_tokens SET used = true WHERE token = $1', [token]);
  });
};

// ─── Forgot password ──────────────────────────────────────────────────────────
const forgotPassword = async (email) => {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (!rows.length) return null; // silently succeed (don't reveal email existence)

  const token = uuidv4();
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1,$2, NOW() + INTERVAL '1 hour')`,
    [rows[0].id, token]
  );
  return token;
};

// ─── Reset password ───────────────────────────────────────────────────────────
const resetPassword = async (token, newPassword) => {
  const { rows } = await query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [token]
  );
  if (!rows.length) throw new ApiError(400, 'Invalid or expired reset token');

  const password_hash = await hash(newPassword);
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);
    // Revoke all refresh tokens (security: force re-login everywhere)
    await client.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [rows[0].user_id]);
  });
};

// ─── Change password ──────────────────────────────────────────────────────────
const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await compare(currentPassword, rows[0].password_hash);
  if (!valid) throw new ApiError(401, 'Current password is incorrect');

  const password_hash = await hash(newPassword);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [password_hash, userId]);

};

module.exports = { signup, login, refreshTokens, logout, verifyEmail, forgotPassword, resetPassword, changePassword ,scrapeZillowAgentProvider};
