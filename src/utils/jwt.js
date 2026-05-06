'use strict';
const jwt    = require('jsonwebtoken');
const config = require('../config');

const signAccess = (userId, firstName, lastName, role, avatarUrl,agent_id) =>
  jwt.sign({ sub: userId, first_name: firstName, last_name: lastName, role: role, avatar_url: avatarUrl,agent_id:agent_id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const signRefresh = (userId, firstName, lastName, role, avatarUrl,agent_id) =>
  jwt.sign({ sub: userId, first_name: firstName, last_name: lastName, role: role, avatar_url: avatarUrl,agent_id:agent_id  }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });

const verifyRefresh = (token) =>
  jwt.verify(token, config.jwt.refreshSecret);

module.exports = { signAccess, signRefresh, verifyRefresh };
