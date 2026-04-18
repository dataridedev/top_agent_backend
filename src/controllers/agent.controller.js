'use strict';
const agentService = require('../services/agent.service');
const { success, paginated, created } = require('../utils/response');

const searchAgents = async (req, res, next) => {
  try {
    const { agents, total } = await agentService.searchAgents(req.query, req.pagination);
    paginated(res, agents, total, req.pagination);
  } catch (err) { next(err); }
};

const getAgent = async (req, res, next) => {
  try {
    const agent = await agentService.getAgentById(parseInt(req.params.agentId, 10));
    success(res, agent);
  } catch (err) { next(err); }
};

const createAgent = async (req, res, next) => {
  try {
    const agent = await agentService.createAgent(req.body);
    created(res, agent);
  } catch (err) { next(err); }
};


const updateAgent = async (req, res, next) => {
  try {
    const agent = await agentService.updateAgent(parseInt(req.params.agentId, 10), req.body);
    success(res, agent);
  } catch (err) { next(err); }
};

const claimAgent = async (req, res, next) => {
  try {
    const agent = await agentService.claimAgent(
      parseInt(req.params.agentId, 10),
      req.user.id,
      req.body.license_number
    );
    success(res, agent);
  } catch (err) { next(err); }
};

const getclaim = async (req, res, next) => {
  try {
    const { role} = req.user;

    let data;

    if (role === 'admin') {
      data = await agentService.claim();
    }
    // } else if (role === 'agent') {
    //   data = await agentService.getMyClaimedAgent(userId);

    // } else {
    //   return res.status(403).json({ message: 'Forbidden' });
    // }

    return res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
};

const getAgentStats = async (req, res, next) => {
  try {
    const stats = await agentService.getAgentStats(parseInt(req.params.agentId, 10));
    success(res, stats);
  } catch (err) { next(err); }
};

const getAgentReviews = async (req, res, next) => {
  try {
    const { reviews, total } = await agentService.getAgentReviews(
      parseInt(req.params.agentId, 10),
      req.query,
      req.pagination
    );
    paginated(res, reviews, total, req.pagination);
  } catch (err) { next(err); }
};

const getAllAgent = async (req, res, next) => {
  try {
    console.log('Fetching all agents');
    const stats = await agentService.getAllAgentService(req.query);
    success(res, stats);
  } catch (err) { next(err); }
};

const getAgentDetails = async (req, res, next) => {
  try {
    console.log('Fetching all agents');
    const stats = await agentService.getAllAgentDetailsService(parseInt(req.params.agentId, 10));
    success(res, stats);
  } catch (err) { next(err); }
};

const userinfo = async (req, res, next) => {
  try {
    const userId = req.user.id; 

    const data = await agentService.getUserInfo(userId);

    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
};

const editUserAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;

  
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Avatar file is required"
      });
    }

  
    const data = await agentService.UserAvatar(userId, file);

    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      success: true,
      data
    });

  } catch (err) {
    next(err);
  }
};



module.exports = { searchAgents, getAgent, createAgent, updateAgent, claimAgent, getAgentStats, getAgentReviews,getAllAgent, getAgentDetails,getclaim,userinfo,editUserAvatar };
