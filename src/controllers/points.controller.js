'use strict';
const pointsService = require('../services/points.service');
const { success, paginated } = require('../utils/response');

const getPointHistory = async (req, res, next) => {
  try {
    const { transactions, total, breakdown } = await pointsService.getPointHistory(
      parseInt(req.params.agentId, 10),
      req.query.year ? parseInt(req.query.year, 10) : null,
      req.pagination
    );
    paginated(res, transactions, total, { ...req.pagination, breakdown });
  } catch (err) { next(err); }
};

const getTierProgress = async (req, res, next) => {
  try {
    const data = await pointsService.getTierProgress(parseInt(req.params.agentId, 10));
    success(res, data);
  } catch (err) { next(err); }
};

const connectPlatform = async (req, res, next) => {
  try {
    const result = await pointsService.connectPlatform(
      req.user.agentId,
      req.body.platform,
      req.body.platform_account_id,
      req.body.credentials || {}
    );
    success(res, result);
  } catch (err) { next(err); }
};

const listConnections = async (req, res, next) => {
  try {
    const connections = await pointsService.listConnections(req.user.agentId);
    success(res, connections);
  } catch (err) { next(err); }
};

const disconnectPlatform = async (req, res, next) => {
  try {
    await pointsService.disconnectPlatform(req.user.agentId, req.params.platform);
    success(res, { message: `${req.params.platform} disconnected` });
  } catch (err) { next(err); }
};

module.exports = { getPointHistory, getTierProgress, connectPlatform, listConnections, disconnectPlatform };
