'use strict';
const scrapingService = require('../services/scraping.service');
const { success, paginated, created } = require('../utils/response');
const { query, withTransaction } = require('../db/pool');

const scrapplatform = async (req, res) => {
  try {
    console.log("ScrapeRequest :::");
   const{id}=req.query
    const response = await scrapingService.agentScrapPlatform(id);

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error("Scrape Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


// const scrapezillowController = async (req, res) => {
//   try {
//     console.log("scrapezillowController :::");

//      const { url, platform} = req.body
//    const response = await  scrapingService.AgentScrapeRequest({
//       url,platform
//     });

//     const { url } = req.body;

//     if (!url) {
//       return res.status(400).json({
//         success: false,
//         message: "url is required",
//       });
//     }

//     // const response = await  scrapingService.run({
//     // const response = await   scrapingService.scrapeAndSaveProvider({
//     //   url
//     // });

//     const response = await  scrapingService.scrapeAgentRouter({
//       url,scrapeId
//     });

//     return res.status(200).json(response);
//   } catch (error) {
//     console.error("Scrape Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

const scrapezillowController = async (req, res) => {
  try {
    console.log("scrapezillowController :::");

    const { url, platform } = req.body;
    const userId = req.user.id

    // 🔹 Validation पहले
    if (!url || !platform) {
      return res.status(400).json({
        success: false,
        message: "url and platform are required",
      });
    }

    // 🔹 Step 1: Create scrape request (pending)
    const result = await query(
      `INSERT INTO scrape_requests (url, platform, status,user_id)
       VALUES ($1, $2, 'pending',$3)
       RETURNING *`,
      [url, platform,userId]
    );

    const scrapeId = result.rows[0].id;

    // 🔹 Step 2: Background scraping (NO await)
    const response = await scrapingService.scrapeAgentRouter({
      url,
      scrapeId,userId
    });
    //  return res.status(200).json(response);

    // 🔹 Step 3: Response तुरंत भेजो
    return res.status(200).json({
      success: true,
      message: "Scraping started",
      scrapeId,
      data:response
    });

  } catch (error) {
    console.error("Scrape Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};




const getAgentsByCity = async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required"
      });
    }

    const agents = await scrapingService.scrapeAgentData({city});

    res.status(200).json({
      success: true,
      total: agents.length,
      data: agents
    });

  } catch (error) {
    console.error("Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};





const scrapeAgentsByCity = async (req, res) => {
  try {
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ message: "City is required" });
    }

    // Step 1: Fetch from Apify
    const agents = await scrapingService.getAgentsFromApify(city);

    // Step 2: Store in DB
    await scrapingService.saveAgents(agents, city);

    return res.json({
      message: "Agents scraped & stored successfully",
      count: agents.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};



module.exports = { scrapezillowController, scrapeAgentsByCity, getAgentsByCity,scrapplatform };