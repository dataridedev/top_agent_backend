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


module.exports = { searchAgents, getAgent, createAgent, updateAgent, claimAgent, getAgentStats, getAgentReviews,getAllAgent, getAgentDetails };
