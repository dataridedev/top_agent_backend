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
// const puppeteer = require('puppeteer');
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { autoScroll } = require("../utils/scraper");

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const agentScrapPlatform = async (id) => {
  try {
    console.log("agentScrapPlatform :::");

    const result = await query(
      `   SELECT 
  sr.*,
  TO_CHAR(sr.created_at, 'YYYY-MM-DD') AS created_at
FROM scrape_requests sr
WHERE sr."user_id"='${id}'
ORDER BY sr.created_at DESC
LIMIT 1;`


    );

    return {
      success: true,
       data: result.rows[0]
    };

  } catch (error) {
    console.error("agentScrapPlatform Error:", error);
    throw error;
  }
};

const scrapeAgentRouter = async ({ url,scrapeId,userId }) => {
  console.log("scrapeAgentRouter called with URL:", url);
  if (!url || typeof url !== "string") {
    throw new Error("Valid URL is required");
  }

  const cleanUrl = url.toLowerCase();

  try {
    // =========================
    // 1. ZILLOW DETECTION
    // =========================
    if (cleanUrl.includes("zillow")) {
      console.log("➡️ Zillow provider selected");
      return await scrapeZillowAgentProvider({ url,scrapeId,userId });
    }

    // =========================
    // 2. RATE MY AGENT DETECTION
    // =========================
    else if (
      cleanUrl.includes("rate-my-agent") ||
      cleanUrl.includes("ratemyagent")
    ) {
      console.log("➡️ RateMyAgent provider selected");
      return await scrapeAndSaveProvider({ url,scrapeId ,userId});
    }

    // =========================
    // 3. UNKNOWN SOURCE
    // =========================
    else {
      throw new Error("Unsupported platform URL");
    }

  } catch (err) {
    console.error("Router Error:", err);
    throw err;
  }
};

// const scrapeAndSaveProvider = async ({ url }) => {
//   if (!url || typeof url !== "string") {
//     throw new Error("Valid URL is required");
//   }

//   const trimmedUrl = url.trim();

//   let browser, page;

//   try {
//     browser = await puppeteer.launch({
//       headless: true,
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });

//     page = await browser.newPage();

//     await page.setUserAgent(
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
//     );

//     await page.goto(trimmedUrl, {
//       waitUntil: "networkidle2",
//       timeout: 60000,
//     });

//     // =========================
//     // WAIT FOR REVIEWS
//     // =========================
//     await page.waitForSelector(".review-panel", { timeout: 15000 });

//     // =========================
//     // AUTO SCROLL (LOAD ALL REVIEWS)
//     // =========================
//     await autoScroll(page);

//     async function autoScroll(page) {
//       await page.evaluate(async () => {
//         await new Promise((resolve) => {
//           let totalHeight = 0;
//           const distance = 500;

//           const timer = setInterval(() => {
//             const scrollHeight = document.body.scrollHeight;
//             window.scrollBy(0, distance);
//             totalHeight += distance;

//             if (totalHeight >= scrollHeight) {
//               clearInterval(timer);
//               resolve();
//             }
//           }, 300);
//         });
//       });
//     }

//     const html = await page.content();
//     const $ = cheerio.load(html);

//     // =========================
//     // SAFE FLOAT
//     // =========================
//     const safeFloat = (val) => {
//       if (!val) return null;
//       const num = parseFloat(val);
//       if (isNaN(num)) return null;
//       return Math.min(num, 9.9); // avoid overflow
//     };

//     // =========================
//     // AGENT DATA
//     // =========================
//     const agent_name = $("h1").first().text().trim();

//  // =========================
//     // DESCRIPTION (Own Words)
//     // =========================
//     let description = null;
//     let custom_title = null;

//     $("h4").each((i, el) => {
//       const text = $(el).text().toLowerCase();
//       if (text.includes("own words")) {
//         custom_title = $(el).text().trim();
//         description = $(el).next("div").text().trim().replace(/\s+/g, " ");
//       }
//     });

//     // =========================
//     // EXTRA FIELDS
//     // =========================
//     const team = $("td:contains('Team')").next().text().trim() || null;

//     const company =
//       $("td:contains('Company')").next().text().trim() || null;


//     // const profile_url =
//     //   $(".agent-summary a[href^='http']").attr("href") || null;

//    let profile_url = $(".avatar img").attr("src") || null;

// if (profile_url && !profile_url.startsWith("http")) {
//   profile_url = "https://www.rate-my-agent.com" + profile_url;
// }
//     // const profile_url =
//     //   $(".agent-image img").attr("src") || null;

//      const avg_rating_raw =
//       $("td:contains('Overall Rating')")
//         .next()
//         .text()
//         .trim();

//     const avg_rating = avg_rating_raw
//       ? parseFloat(avg_rating_raw).toFixed(2)
//       : null;

//     const accepting_new_clients =
//       $(".accepting-clients")
//         .text()
//         .toLowerCase()
//         .includes("accepting");

//     const emailHref = $("a[href^='mailto:']").attr("href");
//     const email = emailHref
//       ? emailHref.replace("mailto:", "").trim()
//       : null;

//     const primary_city =
//       $(".agent-top-rated-cities a").first().text().trim() || null;

//     const phone =
//       $("a[href^='tel:']").attr("href")?.replace("tel:", "") || null;

//     const total_clients = parseInt($("#count_up").text()) || 0;

//     const total_hired =
//       parseInt(
//         $("p:contains('reviews')").text().match(/\d+/)?.[0]
//       ) || 0;
//     // =========================
//     // SOCIAL LINKS
//     // =========================
//     let facebook_url = null,
//       linkedin_url = null,
//       instagram_url = null,
//       youtube_url = null,
//       twitter_url = null;

//     $("a").each((i, el) => {
//       const href = $(el).attr("href") || "";

//       if (href.includes("facebook")) facebook_url ||= href;
//       if (href.includes("linkedin")) linkedin_url ||= href;
//       if (href.includes("instagram")) instagram_url ||= href;
//       if (href.includes("youtube")) youtube_url ||= href;
//       if (href.includes("twitter") || href.includes("x.com"))
//         twitter_url ||= href;
//     });

//     //  =========================
//     // SERVICE AREAS
//     // =========================
//     const service_areas = [];
//     $(".hidden-city").each((i, el) => {
//       service_areas.push($(el).text().trim());
//     });

//     // =========================
//     // AWARDS
//     // =========================
//     const awards = [];
//     $(".badges img").each((i, el) => {
//       const src = $(el).attr("src");
//       if (src) awards.push(src);
//     });


//     // =========================
//     // REVIEWS
//     // =========================
//     const reviews = [];

//     $(".review-panel").each((i, el) => {
//       const $el = $(el);

//       const description = $el.find(".review-comment p").first().text().trim();
//       if (!description) return;

//       let reviewer_name = null;
//       if (description.includes("-")) {
//         reviewer_name = description.split("-").pop().trim();
//       }

//       const title = $el.find("h4").first().text().trim();

//       const overall_rating = safeFloat(
//         $el.find(".overall-rating label.full").first().attr("data-star")
//       );

//       const getRating = (label) =>
//         safeFloat(
//           $el
//             .find(`.rate:contains('${label}') label.full`)
//             .first()
//             .attr("data-star")
//         );

//       const responsiveness_rating = getRating("Responsiveness");
//       const knowledgeability_rating = getRating("Knowledgeability");
//       const professionalism_rating = getRating("Professionalism");
//       const value_of_service_rating = getRating("Value of Service");
//       const marketing_reach_rating = getRating("Marketing");
//       const home_prep_rating = getRating("Home Prep");

//       const transaction_type = $el
//         .find(".rate:contains('Transaction Type') .rate-value")
//         .text()
//         .trim();

//       const status = $el
//         .find(".rate:contains('Status') .rate-value")
//         .text()
//         .trim();

//       const recommend = $el
//         .find(".rate:contains('Recommend')")
//         .text()
//         .toLowerCase()
//         .includes("yes");

//       const property_type = $el
//         .find(".rate:contains('Property Type') .rate-value")
//         .text()
//         .trim();

//       const property_location = $el
//         .find(".rate:contains('Property Location') .rate-value")
//         .text()
//         .trim();

//       const property_closed_date = $el
//         .find(".rate:contains('Property Closed On') .rate-value")
//         .text()
//         .replace(/\s+/g, " ")
//         .trim();

//       const rating_posted_date = $el
//         .find(".rate:contains('Rating Posted On') .rate-value")
//         .text()
//         .replace(/\s+/g, " ")
//         .trim();

//       const is_verified =
//         $el.find("img[src*='verified'], img[src*='stamp']").length > 0;

//       reviews.push({
//         title,
//         description,
//         reviewer_name,
//         overall_rating,
//         responsiveness_rating,
//         knowledgeability_rating,
//         professionalism_rating,
//         value_of_service_rating,
//         marketing_reach_rating,
//         home_prep_rating,
//         transaction_type,
//         status,
//         recommend,
//         property_type,
//         property_location,
//         property_closed_date,
//         rating_posted_date,
//         is_verified,
//       });
//     });

//     console.log("TOTAL REVIEWS:", reviews.length);

//     // =========================
//     // INSERT AGENT
//     // =========================
//    const agentRes = await dbInstance.rawQuery(
//         `
//         INSERT INTO agent_master (
//           name, title, description,
//           company, team,
//           profile_url,
//           total_clients, total_hired,
//           avg_rating,
//           accepting_new_clients,
//           phone,
//           website_url,
//           facebook_url, linkedin_url, instagram_url, twitter_url, youtube_url,
//           primary_city,
//           service_areas,
//           awards
//         )
//         VALUES (
//           $1,$2,$3,
//           $4,$5,
//           $6,
//           $7,$8,
//           $9,
//           $10,
//           $11,
//           $12,
//           $13,$14,$15,$16,$17,
//           $18,
//           $19,
//           $20
//         )
//         RETURNING id
//         `,
//         [
//           agent_name,
//           custom_title,
//           description,
//           company,
//           team,
//           profile_url,
//           total_clients,
//           total_hired,
//           avg_rating,
//           accepting_new_clients,
//           phone,
//           trimmedUrl,
//           facebook_url,
//           linkedin_url,
//           instagram_url,
//           twitter_url,
//           youtube_url,
//            primary_city,
//           JSON.stringify(service_areas),
//           JSON.stringify(awards),
//         ]
//       );

//     const agent_id = agentRes.rows[0].id;

//     // =========================
//     // INSERT REVIEWS
//     // =========================
//     for (const r of reviews) {
//       await dbInstance.rawQuery(
//         `
//         INSERT INTO review_master (
//           agent_id,
//           title,
//           description,
//           reviewer_name,
//           overall_rating,
//           responsiveness_rating,
//           knowledgeability_rating,
//           professionalism_rating,
//           value_of_service_rating,
//           marketing_reach_rating,
//           home_prep_rating,
//           transaction_type,
//           status,
//           recommend,
//           property_type,
//           property_location,
//           property_closed_date,
//           rating_posted_date,
//           is_verified
//         )
//         VALUES (
//           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
//           $11,$12,$13,$14,$15,$16,$17,$18,$19
//         )
//         `,
//         [
//           agent_id,
//           r.title,
//           r.description,
//           r.reviewer_name,
//           r.overall_rating,
//           r.responsiveness_rating,
//           r.knowledgeability_rating,
//           r.professionalism_rating,
//           r.value_of_service_rating,
//           r.marketing_reach_rating,
//           r.home_prep_rating,
//           r.transaction_type,
//           r.status,
//           r.recommend,
//           r.property_type,
//           r.property_location,
//           r.property_closed_date,
//           r.rating_posted_date,
//           r.is_verified,
//         ]
//       );
//     }

//     return {
//       success: true,
//       agent: agent_name,
//       totalReviews: reviews.length,
//     };
//   } catch (err) {
//     console.error(err);
//     throw new Error("Scraping failed: " + err.message);
//   } finally {
//     if (page) await page.close();
//     if (browser) await browser.close();
//   }
// };



const formatDate = (rawDate) => {
  if (!rawDate) return null;

  const cleaned = rawDate.replace(/\s+/g, " ").trim();

  // add day if missing
  const withDay = cleaned.match(/^\w+ \d{4}$/)
    ? `1 ${cleaned}`
    : cleaned;

  const date = new Date(withDay);

  if (isNaN(date)) return null;

  return date.toISOString().split("T")[0];
};

const scrapeAndSaveProvider = async ({ url,scrapeId ,userId}) => {
  console.log("scrapeAndSaveProvider called with URL:", url);
  if (!url || typeof url !== "string") {
    throw new Error("Valid URL is required");
  }

  const trimmedUrl = url.trim();

  let browser, page;

  try {
      await query(
          `UPDATE scrape_requests 
           SET status = 'in_progress', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );


    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    await page.goto(trimmedUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page.waitForSelector(".review-panel", { timeout: 15000 });

    await autoScroll(page);

    const html = await page.content();
    const $ = cheerio.load(html);

    const safeFloat = (val) => {
      if (!val) return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : Math.min(num, 9.9);
    };

    // =========================
    // AGENT OBJECT (MAPPED)
    // =========================


    
    // const agent = {
    //   name: $("h1").first().text().trim(),
    //   title: null,

    //   description: $("h4:contains('Own words')")
    //     .next()
    //     .text()
    //     .trim()
    //     .replace(/\s+/g, " "),
    //         let description = null;
    // let custom_title = null;

    // $("h4").each((i, el) => {
    //   const text = $(el).text().toLowerCase();
    //   if (text.includes("own words")) {
    //     custom_title = $(el).text().trim();
    //     description = $(el).next("div").text().trim().replace(/\s+/g, " ");
    //   }
    // });

    //   company: $("td:contains('Company')").next().text().trim(),
    //   team: $("td:contains('Team')").next().text().trim(),

    //   profile_url: $(".avatar img").attr("src")
    //     ? $(".avatar img").attr("src").startsWith("http")
    //       ? $(".avatar img").attr("src")
    //       : "https://www.rate-my-agent.com" + $(".avatar img").attr("src")
    //     : null,

    //   avg_rating: parseFloat(
    //     $("td:contains('Overall Rating')").next().text().trim()
    //   ) || null,

    //   accepting_new_clients: $(".accepting-clients")
    //     .text()
    //     .toLowerCase()
    //     .includes("accepting"),

    //   email: $("a[href^='mailto:']").attr("href")?.replace("mailto:", "") || null,
    //   phone_number: $("a[href^='tel:']").attr("href")?.replace("tel:", "") || null,

    //   primary_city: $(".agent-top-rated-cities a").first().text().trim(),

    //   total_clients: parseInt($("#count_up").text()) || 0,
    //   total_hired: parseInt($("p:contains('reviews')").text().match(/\d+/)?.[0]) || 0,

    //   facebook_url: null,
    //   linkedin_url: null,
    //   instagram_url: null,
    //   youtube_url: null,
    //   twitter_url: null,
    //      $("a").each((i, el) => {
    //   const href = $(el).attr("href") || "";

    //   if (href.includes("facebook")) facebook_url ||= href;
    //   if (href.includes("linkedin")) linkedin_url ||= href;
    //   if (href.includes("instagram")) instagram_url ||= href;
    //   if (href.includes("youtube")) youtube_url ||= href;
    //   if (href.includes("twitter") || href.includes("x.com"))
    //     twitter_url ||= href;
    // });

    //   service_areas: $(".hidden-city")
    //     .map((i, el) => $(el).text().trim())
    //     .get(),

    //   awards: $(".badges img")
    //     .map((i, el) => $(el).attr("src"))
    //     .get(),

    //   source_url: trimmedUrl,
    // };


     const agent = {
      // name: $("h1").first().text().trim(),
 
   name: $("h1")
    .contents()
    .filter(function () {
      return this.type === "text";
    })
    .first()
    .text()
    .trim(),

  company_name: $("h1 span").text().trim(),
      // about_h: $("h4:contains('Own words')").first().text().trim() || null,

      // about_d: (() => {
      //   let desc = null;

      //   $("h4").each((i, el) => {
      //     const text = $(el).text().toLowerCase();
      //     if (text.includes("own words")) {
      //       desc = $(el).next("div").text().trim().replace(/\s+/g, " ");
      //     }
      //   });

      //   return desc;
      // })(),

       about_h : $("h4")
  .filter((i, el) => $(el).text().toLowerCase().includes("own words"))
  .first()
  .text()
  .trim() || null,
 about_d : (() => {
  let desc = null;

  $("h4").each((i, el) => {
    const text = $(el).text().toLowerCase();

    if (text.includes("own words")) {
      desc = $(el)
        .nextAll("div")   // safer than next()
        .first()
        .text()
        .trim()
        .replace(/\s+/g, " ");
    }
  });

  return desc;
})(),

        // about_d: $("h4:contains('Own words')")
        // .next()
        // .text()
        // .trim()
        // .replace(/\s+/g, " ") || null,
            
    // let custom_title = null;

      company: $("td:contains('Company')").next().text().trim() || null,
      team: $("td:contains('Team')").next().text().trim() || null,

      profile_url: (() => {
        let img = $(".avatar img").attr("src") || null;
        if (!img) return null;
        return img.startsWith("http")
          ? img
          : "https://www.rate-my-agent.com" + img;
      })(),

      avg_rating:
        parseFloat($("td:contains('Overall Rating')").next().text()) || null,

      accepting_new_clients: $(".accepting-clients")
        .text()
        .toLowerCase()
        .includes("accepting"),

      email:
        $("a[href^='mailto:']").attr("href")?.replace("mailto:", "") || null,

      phone_number:
        $("a[href^='tel:']").attr("href")?.replace("tel:", "") || null,

      // city: $(".agent-top-rated-cities a").first().text().trim() || null,
       city : $("p.agent-top-rated-cities.atf-agent_city a")
  .first()
  .text()
  .trim() || null,

      total_clients: parseInt($("#count_up").text()) || 0,

      total_hired:
        parseInt($("p:contains('reviews')").text().match(/\d+/)?.[0]) || 0,

      facebook_url: null,
      linkedin_url: null,
      instagram_url: null,
      youtube_url: null,
      twitter_url: null,

      service_areas: [],
      awards: [],
      reviews: [],
      source_url: trimmedUrl,
     userId:userId
    };

    // =========================
    // SOCIAL LINKS FIXED
    // =========================
    $("a").each((i, el) => {
      const href = $(el).attr("href") || "";

      if (href.includes("facebook")) agent.facebook_url ||= href;
      if (href.includes("linkedin")) agent.linkedin_url ||= href;
      if (href.includes("instagram")) agent.instagram_url ||= href;
      if (href.includes("youtube")) agent.youtube_url ||= href;
      if (href.includes("twitter") || href.includes("x.com"))
        agent.twitter_url ||= href;
    });

    // =========================
    // SERVICE AREAS
    // =========================
    $(".hidden-city").each((i, el) => {
      agent.service_areas.push($(el).text().trim());
    });

    // =========================
    // AWARDS
    // =========================
    $(".badges img").each((i, el) => {
      const src = $(el).attr("src");
      if (src) agent.awards.push(src);
    });


    // =========================
    // REVIEWS
    // =========================
    const reviews = [];

    $(".review-panel").each((i, el) => {
      const $el = $(el);

      const review_description = $el.find(".review-comment p").first().text().trim();
      if (!review_description) return;

      reviews.push({
        review_title: $el.find("h4").first().text().trim(),
        review_description,

        reviewer_name: review_description.includes("-")
          ? review_description.split("-").pop().trim()
          : null,

        overall_rating: safeFloat(
          $el.find(".overall-rating label.full").attr("data-star")
        ),

        responsiveness_rating: safeFloat(
          $el.find(".rate:contains('Responsiveness') label.full").attr("data-star")
        ),

        knowledgeability_rating: safeFloat(
          $el.find(".rate:contains('Knowledgeability') label.full").attr("data-star")
        ),

        professionalism_rating: safeFloat(
          $el.find(".rate:contains('Professionalism') label.full").attr("data-star")
        ),

        value_of_service_rating: safeFloat(
          $el.find(".rate:contains('Value') label.full").attr("data-star")
        ),

        marketing_reach_rating: safeFloat(
          $el.find(".rate:contains('Marketing') label.full").attr("data-star")
        ),

        home_prep_rating: safeFloat(
          $el.find(".rate:contains('Home Prep') label.full").attr("data-star")
        ),

        transaction_type: $el.find(".rate:contains('Transaction Type') .rate-value").text().trim(),
        status: $el.find(".rate:contains('Status') .rate-value").text().trim(),

        recommend: $el.find(".rate:contains('Recommend')").text().toLowerCase().includes("yes"),

        // property_type: $el.find(".rate:contains('Property Type') .rate-value").text().trim(),
        // property_location: $el.find(".rate:contains('Property Location') .rate-value").text().trim(),

        // property_closed_date: $el.find(".rate:contains('Property Closed On') .rate-value").text().trim(),
        // rating_posted_date: $el.find(".rate:contains('Rating Posted On') .rate-value").text().trim(),
        rating_posted_date: formatDate(
  $el.find(".rate:contains('Rating Posted On') .rate-value")
    .text()
    .trim()
),  

        is_verified: $el.find("img[src*='verified']").length > 0,
        review_source : "RateMyAgent",
          userId:userId
      });
    });

    // =========================
    // ❌ NO DB INSERT HERE
    // =========================

      await query(
          `UPDATE scrape_requests 
           SET status = 'in_progress', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );

  
return await insertZillowDataProvider({
  agent,
  reviews,
  teamMembers: [],   // ✅ FIX
  properties: [] ,
  scrapeId  ,
userId
});

  } catch (err) {
    console.error(err);
     await query(
          `UPDATE scrape_requests 
           SET status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );

    throw new Error("Scraping failed: " + err.message);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

// const scrapeZillowAgentProvider = async ({ url }) => {
//     let browser, page;
//     let agentId = null;

//     const safeNum = (v) => v ? parseFloat(String(v).replace(/[^0-9.]/g, "")) || null : null;
//     const safeInt = (v) => v ? parseInt(String(v).replace(/[^0-9]/g, "")) || null : null;

//     const cleanPrice = (str) => {
//         if (!str) return null;
//         let val = safeNum(str);
//         if (!val) return null;

//         if (str.includes('M')) val *= 1000000;
//         else if (str.includes('K')) val *= 1000;

//         return val;
//     };

//     try {
//         browser = await puppeteer.launch({
//             headless: "new",
//             args: ["--no-sandbox", "--disable-setuid-sandbox"]
//         });

//         page = await browser.newPage();

//         // ✅ FIX: prevent navigation timeout crash
//         page.setDefaultNavigationTimeout(0);
//         page.setDefaultTimeout(0);

//         await page.setUserAgent(
//             "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
//         );

//         await page.setExtraHTTPHeaders({
//             "accept-language": "en-US,en;q=0.9",
//         });

//         await page.evaluateOnNewDocument(() => {
//             Object.defineProperty(navigator, 'webdriver', {
//                 get: () => false,
//             });
//         });

//         // =========================
//         // SAFE NAVIGATION (FIXED)
//         // =========================
//         try {
//             await page.goto(url, {
//                 waitUntil: "networkidle2",
//                 timeout: 120000
//             });
//         } catch (e) {
//             console.log("⚠ networkidle2 failed, retrying domcontentloaded...");

//             await page.goto(url, {
//                 waitUntil: "domcontentloaded",
//                 timeout: 120000
//             });
//         }

//         const html = await page.content();
//         const $ = cheerio.load(html);

//         // =========================
//         // AGENT DATA
//         // =========================
//         const name = $("h1").text().trim();
//         const team_heading = $("h2:contains('Team listings & sales')")
//             .text()
//             .replace(/Team listings & sales.*/, "")
//             .trim() || "Team Listings";

//         const company_name = $(".hJOiOT").first().text().trim();
//         const phone_number = $("a[href^='tel:']").first().text().replace("tel:", "").trim();
//         const office_number = $("a[href^='tel:']").eq(1).text().trim();
//         const email = $("a[href^='mailto:']").text().trim();
//         const address = $("a[href*='maps.google.com']").first().text().trim();

//         const total_reviews = safeInt($("a[href='#reviews']").text());
//         const sales_12m = safeInt($("span:contains('sales last 12 months')").prev().text());
//         const total_sales = safeInt($("span:contains('total sales')").prev().text());
//         const avg_price = safeNum($("span:contains('average price')").prev().text());

//         const rangeText = $("span:contains('price range')").prev().text() || "";
//         const rangeParts = rangeText.split("-");
//         const price_min = cleanPrice(rangeParts[0]);
//         const price_max = cleanPrice(rangeParts[1]);

 


//   await page.waitForSelector('div[aria-hidden="true"] img', {
//     timeout: 10000
// }).catch(() => {});

// const profile_url = await page.evaluate(() => {
//     const img = document.querySelector('div[aria-hidden="true"] img');
//     return img ? img.src : null;
// });

// //       const profile_url = await page.$eval(
// //   'div[aria-hidden="true"] img',
// //   img => img.getAttribute('src')
// // );
      

//         const specs = [];
//         $(".iilNUJ").each((i, el) => specs.push($(el).text().trim()));

//         const website_url = $("a:contains('Visit team website')").attr("href");

//         const social = {
//             fb: $("a[href*='facebook.com']").attr("href"),
//             insta: $("a[href*='instagram.com']").attr("href"),
//             yt: $("a[href*='youtube.com']").attr("href"),
//             twitter: $("a[href*='x.com']").attr("href")
//         };

//         const about_h = $("h2:contains('Get to know')").text().trim();
//         const about_d = $(".dcLnWx p").text().trim();

//         // =========================
//         // INSERT AGENT (SAFE)
//         // =========================
//         await query("BEGIN");

//         const agentRes = await query(
//             `INSERT INTO agent_zillow_master (
//                 name, team_heading, company_name, profile_url,
//                 total_reviews, sales_last_12_months, total_sales_amount,
//                 avg_price, price_range_min, price_range_max,
//                 about_heading, about_description, specialization,
//                 website_url, facebook_url, instagram_url,
//                 youtube_url, twitter_url,
//                 phone_number, office_number, email, address
//             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
//             RETURNING id`,
//             [
//                 name,
//                 team_heading,
//                 company_name,
//                 profile_url,
//                 total_reviews,
//                 sales_12m,
//                 total_sales,
//                 avg_price,
//                 price_min,
//                 price_max,
//                 about_h,
//                 about_d,
//                 specs.join(", "),
//                 website_url,
//                 social.fb,
//                 social.insta,
//                 social.yt,
//                 social.twitter,
//                 phone_number,
//                 office_number,
//                 email,
//                 address
//             ]
//         );

//         agentId = agentRes.rows[0].id;

//         if (!agentId) throw new Error("Agent insert failed");

//         await query("COMMIT");

//         // =========================
//         // CHILD TRANSACTION START
//         // =========================
//         await query("BEGIN");

//         let allReviews = [];

// // wait until reviews are loaded
// await page.waitForSelector('[data-c11n-component="Carousel.Slide"]', {
//     timeout: 10000
// }).catch(() => {});

// const pageHtml = await page.content();
// const $page = cheerio.load(pageHtml);

// $page('[data-c11n-component="Carousel.Slide"]').each((i, el) => {

//     const slide = $page(el);
//     const metaInfo = slide.find('ul[data-c11n-component="Text"] li.nVRGN');

//     const reviewDate = metaInfo.eq(0).text().trim();
//     const reviewerName = metaInfo.eq(1).text().replace('•', '').trim();

//     const ratingLabel = slide.find('[data-c11n-component="RatingStars"]').attr('aria-label');
//     const ratingValue = ratingLabel
//         ? parseFloat(ratingLabel.split(' ')[0])
//         : 5.0;

//     const reviewTitle = slide.find('h3[data-c11n-component="Heading"]').text().trim();

//     const reviewDesc =
//         slide.find('.kXeRhO .hvzgx').text().trim() ||
//         slide.find('.diIEdR .hvzgx').text().trim();

//     if (reviewerName && reviewDesc) {
//         allReviews.push({
//             agent_id: agentId,
//             reviewer_name: reviewerName,
//             review_title: reviewTitle,
//             review_description: reviewDesc,
//             rating: ratingValue,
//             review_date: reviewDate,
//             review_source: 'Zillow'
//         });
//     }
// });

// console.log("Reviews scraped:", allReviews.length);
//         // =========================
//         // TEAM MEMBERS
//         // =========================
//         const teamMembers = [];

//         $("#team-member-card a[role='link']").each((idx, el) => {

//             const mRange = ($(el).find("p:contains('price range')").find(".gaCWqj").text() || "").split("-");

//             teamMembers.push({
//                 member_name: $(el).find("h3").text().trim(),
//                 rating: safeNum($(el).find(".cGSLnk .gaCWqj").text()),
//                 sales_range_min: cleanPrice(mRange[0]),
//                 sales_range_max: cleanPrice(mRange[1]),
//                 total_sales: safeInt($(el).find("p:contains('sales last 12 months')").find(".gaCWqj").text())
//             });
//         });

  


// const properties = [];

// $("#forSaleListings, #forRentListings, #pastSales").each((i, section) => {

//     const sectionId = $(section).attr("id");

//     let status =
//         sectionId === "forRentListings" ? "rented"
//         : sectionId === "pastSales" ? "sold"
//         : "sale";

//     $(section).find("tbody tr").each((idx, row) => {

//         const rowNode = $(row);

//         const addressNode = rowNode.find(".MediaObject__Body-sc-12gs3hz-2");

//         const line1 = addressNode.contents().first().text().trim();
//         const line2 = addressNode.find("br").get(0)?.nextSibling?.nodeValue?.trim() || "";

//         const fullAddress = `${line1} ${line2}`.trim();

//         const propUrl = rowNode.find("a").attr("href");

//         // ✅ FIXED IMAGE EXTRACTION
//         const image_url = rowNode
//             .find("div.MediaObject__Media-sc-12gs3hz-3 img")
//             .attr("src");

//         if (!fullAddress || !propUrl) return;

//         const fullUrl = propUrl.startsWith("http")
//             ? propUrl
//             : "https://www.zillow.com" + propUrl;

//         let rawPrice = "";
//         let soldDate = null;
//         let beds = null;
//         let baths = null;

//         if (status === "sold") {
//             soldDate = rowNode.find("td").eq(1).text().trim();
//             rawPrice = rowNode.find("td").eq(2).text().trim();
//         } else {
//             rawPrice = rowNode.find("td:contains('$')").last().text().trim();

//             const bedBathText = rowNode.find("td").eq(1).text().trim();

//             beds = bedBathText.includes("Studio")
//                 ? 0
//                 : safeInt(bedBathText.split(",")[0]);

//             baths = safeInt(bedBathText.split(",")[1]);
//         }

//         properties.push({
//             property_title: line1,
//             property_address: fullAddress,
//             property_type: "Residential",
//             status,
//             bedrooms: beds,
//             bathrooms: baths,
//             listing_price: cleanPrice(rawPrice),
//             sold_date: soldDate,
//             image_url: image_url, // ✅ single correct image
//             property_url: fullUrl
//         });
//     });
// });
//         // =========================
//         // INSERT TEAM MEMBERS
//         // =========================
//         for (const m of teamMembers) {
//             await query(
//                 `INSERT INTO team_members (agent_id, member_name, rating, sales_range_min, sales_range_max, total_sales)
//                  VALUES ($1,$2,$3,$4,$5,$6)`,
//                 [agentId, m.member_name, m.rating, m.sales_range_min, m.sales_range_max, m.total_sales]
//             );
//         }

//         // =========================
//         // INSERT PROPERTIES
//         // =========================
//         for (const p of properties) {
//             await query(
//                 `INSERT INTO agent_properties
//                 (agent_id, property_title, property_address, property_type, status, bedrooms, bathrooms, listing_price, image_urls, property_url, sold_date)
//                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//                  ON CONFLICT (property_url)
//                  DO UPDATE SET status = EXCLUDED.status, listing_price = EXCLUDED.listing_price`,
//                 [
//                     agentId,
//                     p.property_title,
//                     p.property_address,
//                     p.property_type,
//                     p.status,
//                     p.bedrooms,
//                     p.bathrooms,
//                     p.listing_price,
//                     [p.image_url],
//                     p.property_url,
//                     p.sold_date
//                 ]
//             );
//         }

//         // =========================
//         // INSERT REVIEWS
//         // =========================
//         for (const r of allReviews) {
//             await query(
//                 `INSERT INTO reviews_zillow_master
//                 (agent_id, reviewer_name, review_title, review_description, rating, review_date, review_source)
//                  VALUES ($1,$2,$3,$4,$5,$6,$7)
//                  ON CONFLICT DO NOTHING`,
//                 [
//                     agentId,
//                     r.reviewer_name,
//                     r.review_title,
//                     r.review_description,
//                     r.rating,
//                     r.review_date,
//                     r.review_source
//                 ]
//             );
//         }

//         await query("COMMIT");

//         return {
//             success: true,
//             agentId,
//             reviews: allReviews.length,
//             properties: properties.length,
//             teamMembers: teamMembers.length
//         };
      
//     } catch (err) {
//         try { await query("ROLLBACK"); } catch (e) {}
//         console.error("Scrape Error:", err);
//         throw err;

//     } finally {
//         if (browser) await browser.close();
//     }
// };



const scrapeZillowAgentProvider = async ({ url,scrapeId }) => {
    // let browser, page;

    // const safeNum = (v) => v ? parseFloat(String(v).replace(/[^0-9.]/g, "")) || null : null;
    // const safeInt = (v) => v ? parseInt(String(v).replace(/[^0-9]/g, "")) || null : null;

    // const cleanPrice = (str) => {
    //     if (!str) return null;
    //     let val = safeNum(str);
    //     if (!val) return null;

    //     if (str.includes('M')) val *= 1000000;
    //     else if (str.includes('K')) val *= 1000;

    //     return val;
    // };

    // try {
    // await query(
    //   `UPDATE scrape_requests 
    //    SET status = 'in_progress', updated_at = NOW()
    //    WHERE id = $1`,
    //   [scrapeId]
    // );

    //     browser = await puppeteer.launch({
    //         headless: "new",
    //         args: ["--no-sandbox", "--disable-setuid-sandbox"]
    //     });

    //     page = await browser.newPage();

    //     await page.setDefaultNavigationTimeout(0);
    //     await page.setDefaultTimeout(0);

    //     await page.setUserAgent(
    //         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    //     );

    //     await page.goto(url, { waitUntil: "domcontentloaded" });

    //     const html = await page.content();
    //     const $ = cheerio.load(html);

    let browser;

  try {
    console.log("🚀 START SCRAPING");

    // 🔹 in_progress
    await query(
      `UPDATE scrape_requests 
       SET status = 'in_progress', updated_at = NOW()
       WHERE id = $1`,
      [scrapeId]
    );

    browser = await puppeteer.launch({
      headless: false, // 🔥 first test false
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled"
      ]
    });

    const page = await browser.newPage();

    // 🔹 headers + user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9"
    });

    console.log("🌐 Opening URL...");
    await page.goto(url, { waitUntil: "networkidle2" });

    // 🔹 human-like delay
    await page.waitForTimeout(4000);

    // 🔹 scroll
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

 await new Promise(res => setTimeout(res, 2000));

    console.log("📄 Getting HTML...");
    const html = await page.content();

    // ❌ CAPTCHA DETECT
    if (
      html.includes("Access to this page has been denied") ||
      html.includes("px-captcha")
    ) {
      console.log("❌ CAPTCHA BLOCKED");

      await query(
        `UPDATE scrape_requests 
         SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [scrapeId]
      );

      throw new Error("Blocked by CAPTCHA");
    }

    const $ = cheerio.load(html);

    console.log("✅ Page Loaded Successfully");

        const rangeText =
  $("span:contains('price range')").prev().text() || "";

const rangeParts = rangeText.split("-");

const price_min = cleanPrice(rangeParts[0]);
const price_max = cleanPrice(rangeParts[1]);
        // =========================
        // AGENT DATA
        // =========================
        const agent = {
            name: $("h1").text().trim(),
            team_heading: $("h2:contains('Team listings & sales')")
                .text()
                .replace(/Team listings & sales.*/, "")
                .trim(),

            company_name: $(".hJOiOT").first().text().trim(),
            phone_number: $("a[href^='tel:']").first().text().trim(),
            office_number: $("a[href^='tel:']").eq(1).text().trim(),
            email: $("a[href^='mailto:']").text().trim(),
            city: $("a[href*='maps.google.com']").first().text().trim(),

            total_reviews: safeInt($("a[href='#reviews']").text()),
            sales_12m: safeInt($("span:contains('sales last 12 months')").prev().text()),
            total_sales: safeInt($("span:contains('total sales')").prev().text()),
            avg_price: safeNum($("span:contains('average price')").prev().text()),
            price_min,
            price_max,
            about_h: $("h2:contains('Get to know')").text().trim(),
            about_d: $(".dcLnWx p").text().trim(),
            source_url: url,
            userId:userId
        };

        // =========================
        // REVIEWS
        // =========================
        const reviews = [];

        await page.waitForSelector('[data-c11n-component="Carousel.Slide"]').catch(() => {});

        const pageHtml = await page.content();
        const $page = cheerio.load(pageHtml);

        $page('[data-c11n-component="Carousel.Slide"]').each((i, el) => {
            const reviewerName = $page(el).find("li").eq(1).text().trim();
            const reviewDesc = $page(el).find("h3").text().trim();

            if (reviewerName && reviewDesc) {
                reviews.push({
                    reviewer_name: reviewerName,
                    review_description: reviewDesc,
                    rating: 5,
                    review_source: "Zillow"
                });
            }
        });

        // =========================
        // TEAM MEMBERS
        // =========================
        const teamMembers = [];

        $("#team-member-card a").each((i, el) => {
            teamMembers.push({
                member_name: $(el).find("h3").text().trim(),
                rating: safeNum($(el).find(".gaCWqj").text())
            });
        });

        // =========================
        // PROPERTIES
        // =========================
        const properties = [];

        $("tbody tr").each((i, row) => {
            const address = $(row).find("td").first().text().trim();
            if (!address) return;

            properties.push({
                property_address: address,
                property_type: "Residential"
            });
        });

        // =========================
        // ✅ FINAL CALL (ONLY ONCE)
        // =========================
        return await insertZillowDataProvider({
            agent,
            reviews,
            teamMembers,
            properties,
            scrapeId
        });

    } catch (err) {
        console.error("Scrape Error:", err);
            await query(
          `UPDATE scrape_requests 
           SET status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );

        throw err;
    } finally {
        if (browser) await browser.close();
    }
};


const insertZillowDataProvider = async ({ agent, reviews, teamMembers, properties,scrapeId,userId }) => {
    try {
        await query("BEGIN");

        // =========================
        // INSERT AGENT (FULL SCHEMA)
        // =========================
        const agentRes = await query(
            `INSERT INTO agent_zillow_master (
                name,
                company_name,
                profile_url,
                total_reviews,
                sales_last_12_months,
                total_sales_amount,
                avg_price,
                price_range_min,
                price_range_max,
                about_heading,
                about_description,
                specialization,
                team_heading,
                website_url,
                linkedin_url,
                facebook_url,
                instagram_url,
                youtube_url,
                twitter_url,
                city,
                email,
                office_number,
                license_number,
                phone_number,
                claimed_at,
                total_clients,
                total_hired,
                avg_rating,
                accepting_new_clients,
                service_areas,
                awards,
                source_url,
                user_id 
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
                $31,$32,$33
            )
            RETURNING id`,
            [
                agent.name || null,
                agent.company_name || null,
                agent.profile_url || null,
                agent.total_reviews || 0,
                agent.sales_12m || 0,
                agent.total_sales || 0,
                agent.avg_price || null,
                agent.price_min || null,
                agent.price_max || null,
                agent.about_h || null,
                agent.about_d || null,
                agent.specialization || null,
                agent.team_heading || null,
                agent.website_url || null,
                agent.linkedin_url || null,
                agent.facebook_url || agent.social?.fb || null,
                agent.instagram_url || agent.social?.insta || null,
                agent.youtube_url || agent.social?.yt || null,
                agent.twitter_url || agent.social?.twitter || null,
                agent.city || null,
                agent.email || null,
                agent.office_number || null,
                agent.license_number || null,
                agent.phone_number || null,
                agent.claimed_at || null,
                agent.total_clients || 0,
                agent.total_hired || 0,
                agent.avg_rating || null,
                agent.accepting_new_clients ?? null,
                agent.service_areas ? JSON.stringify(agent.service_areas) : null,
                agent.awards ? JSON.stringify(agent.awards) : null,
                agent.source_url || null,
                agent.userId || null

            ]
        );

        const agentId = agentRes.rows[0].id;

        // =========================
        // REVIEWS INSERT (already fixed earlier)
        // =========================
        for (const r of reviews) {

  const cleanString = (val, len = 100) => {
    if (!val) return null;
    return val.toString().replace(/\s+/g, " ").trim().substring(0, len);
  };

  const formatDate = (str) => {
    if (!str) return null;
    const clean = str.replace(/\s+/g, " ").trim();
    const date = new Date(clean);
    return isNaN(date) ? null : date.toISOString().split("T")[0];
  };

            await query(
                `INSERT INTO reviews_zillow_master (
                    agent_id,
                    reviewer_name,
                    reviewer_profile_url,
                    review_title,
                    review_description,
                    rating,
                    review_date,
                    review_source,
                    agent_reply,
                    overall_rating,
                    responsiveness_rating,
                    knowledgeability_rating,
                    professionalism_rating,
                    value_of_service_rating,
                    marketing_reach_rating,
                    home_prep_rating,
                    transaction_type,
                    status,
                    recommend,
                    rating_posted_date,
                    is_verified,
                    verified_image_url,
                    source_url,
                   user_id 
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,
                    $9,$10,$11,$12,$13,$14,$15,$16,
                    $17,$18,$19,$20,$21,$22,$23,$24
                )
                ON CONFLICT DO NOTHING`,
                [
                    agentId,
                    r.reviewer_name || null,
                    r.reviewer_profile_url || null,
                    r.review_title || null,
                    r.review_description || null,
                    r.rating || null,
                    r.review_date || null,
                    r.review_source ,
                    r.agent_reply || null,
                    r.overall_rating || null,
                    r.responsiveness_rating || null,
                    r.knowledgeability_rating || null,
                    r.professionalism_rating || null,
                    r.value_of_service_rating || null,
                    r.marketing_reach_rating || null,
                    r.home_prep_rating || null,
                    r.transaction_type || null,
                    r.status || null,
                    r.recommend ?? null,
                    r.rating_posted_date || null,
                    r.is_verified ?? null,
                    r.verified_image_url || null,
                    r.source_url || null,
                    r.userId || null
                    
                ]
            );
        }

        // =========================
        // TEAM MEMBERS
        // =========================
        for (const t of teamMembers) {
            await query(
                `INSERT INTO team_members (agent_id, member_name, rating, sales_range_min, sales_range_max, total_sales,user_id )
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    agentId,
                    t.member_name || null,
                    t.rating || null,
                    t.sales_range_min || null,
                    t.sales_range_max || null,
                    t.total_sales || null,
                    t.userId || null,

                ]
            );
        }

        // =========================
        // PROPERTIES
        // =========================
        for (const p of properties) {
            await query(
                `INSERT INTO agent_properties (
                    agent_id,
                    property_title,
                    property_address,
                    property_type,
                    status,
                    bedrooms,
                    bathrooms,
                    listing_price,
                    image_urls,
                    property_url,
                    sold_date,
                    user_id 
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                ON CONFLICT (property_url)
                DO UPDATE SET status = EXCLUDED.status, listing_price = EXCLUDED.listing_price`,
                [
                    agentId,
                    p.property_title || null,
                    p.property_address || null,
                    p.property_type || null,
                    p.status || null,
                    p.bedrooms || null,
                    p.bathrooms || null,
                    p.listing_price || null,
                    p.image_url ? [p.image_url] : null,
                    p.property_url || null,
                    p.sold_date || null,
                    p.userId || null
                ]
            );
        }

        await query("COMMIT");

            await query(
          `UPDATE scrape_requests 
           SET status = 'completed', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );

        return {
            success: true,
            agentId,
            reviews: reviews.length,
            teamMembers: teamMembers.length,
            properties: properties.length
        };

    } catch (err) {
        await query("ROLLBACK");
            await query(
          `UPDATE scrape_requests 
           SET status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [scrapeId]
        );

        console.error("Insert Error:", err);
        throw err;
    }
};





// const scrapeAgentData =async function scrapeAgentsData(city) {
const scrapeAgentData =async ({city}) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const url = `https://www.zillow.com/professionals/real-estate-agent-reviews/${city.replace(/ /g, "-")}/`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  let agents = [];
  let hasNextPage = true;

  // while (hasNextPage) {
  //   await page.waitForSelector(".StyledCard-c11n-8-101-3__sc-1w6p0lv-0");

  //   // const names = await page.evaluate(() => {
  //   //   return Array.from(document.querySelectorAll("a"))
  //   //     .map(el => el.innerText.trim())
  //   //     .filter(text => text.length > 0);
  //   // });

  //   // agents.push(...names);

  //   // const nextBtn = await page.$('a[title="Next page"]');

  //    const agents = await page.evaluate(() => {
  //     return Array.from(document.querySelectorAll("a"))
  //       .map(el => el.innerText.trim())
  //       .filter(text => text.length > 0);
  //   });

  //   for (let name of agents) {
  //     await insertAgent({
  //       name,
  //       city
  //     });
  //   }

  while (hasNextPage) {
  // ✅ Wait for stable element
  await page.waitForSelector("a[href*='/profile/']", {
    timeout: 60000
  });

  const agents = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='/profile/']"))
      .map(el => el.innerText.trim())
      .filter(text => text.length > 0);
  });

  for (let name of agents) {
    await insertAgent({
      name,
      city
    });
  }

  console.log(`Inserted ${agents.length} agents`);

    console.log(`Inserted ${agents.length} agents for ${city}`);

    const nextBtn = await page.$('a[title="Next page"]');

    if (nextBtn) {
      await Promise.all([
        page.click('a[title="Next page"]'),
        page.waitForNavigation({ waitUntil: "networkidle2" })
      ]);
    } else {
      hasNextPage = false;
    }
  }

  await browser.close();
  return agents;
}




const insertAgent= async ({agent})=> {
  const query = `
    INSERT INTO public.cities_agents (name, city)
    VALUES ($1, $2)
  `;

  const values = [agent.name, agent.city];

  await pool.query(query, values);
}











const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "sovereigntaylor/zillow-agent-scraper"; 

const getAgentsFromApify = async (city) => {
  try {
    // 1. Start actor run
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
      {
        searchLocations: [city],
        maxPagesPerQuery: 50,
      }
    );

    const runId = runResponse.data.data.id;

    // 2. Wait for completion
    let status = "RUNNING";
    let datasetId;

    while (status === "RUNNING" || status === "READY") {
      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await axios.get(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );

      status = statusRes.data.data.status;
      datasetId = statusRes.data.data.defaultDatasetId;
    }

    if (status !== "SUCCEEDED") {
      throw new Error("Apify run failed");
    }

    // 3. Fetch dataset items
    const datasetRes = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`
    );

    // 4. Normalize data
    const agents = datasetRes.data.map((item) => ({
      name: item.name || item.fullName,
      rating: item.rating || null,
      website: item.businessWebsite || null,
    }));

    return agents;
  } catch (error) {
    console.error("Apify error:", error.message);
    throw error;
  }
};


const saveAgents = async (agents, city) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const agent of agents) {
      await client.query(
        `
        INSERT INTO agents (name, rating, website, city)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        `,
        [agent.name, agent.rating, agent.website, city]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


module.exports = { scrapeZillowAgentProvider ,insertZillowDataProvider, scrapeAndSaveProvider,scrapeAgentData ,getAgentsFromApify, saveAgents, insertAgent ,scrapeAgentRouter,
  agentScrapPlatform
};