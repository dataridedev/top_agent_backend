'use strict';
const scrapingService = require('../services/scraping.service');
const { success, paginated, created } = require('../utils/response');

const scrapezillowController = async (req, res) => {
  try {
    console.log("scrapezillowController :::");
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "url is required",
      });
    }

    const response = await  scrapingService.scrapeAgentRouter({
      url
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Scrape Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


module.exports = { scrapezillowController };