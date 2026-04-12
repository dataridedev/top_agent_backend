'use strict';
const leadService = require('../services/lead.service');
const { success, created, paginated } = require('../utils/response');

const createLead = async (req, res, next) => {
  try {
    const { lead } = await leadService.createLead(req.body);
    created(res, lead);
  } catch (err) { next(err); }
};

const listLeads = async (req, res, next) => {
  try {
    const { leads, total } = await leadService.listLeads(
      req.user.agentId, req.query, req.pagination
    );
    paginated(res, leads, total, req.pagination);
  } catch (err) { next(err); }
};

const updateLeadStatus = async (req, res, next) => {
  try {
    const lead = await leadService.updateLeadStatus(
      parseInt(req.params.leadId, 10),
      req.user.agentId,
      req.body.status,
      req.body.notes
    );
    success(res, lead);
  } catch (err) { next(err); }
};

module.exports = { createLead, listLeads, updateLeadStatus };
