'use strict';
const jwt    = require('jsonwebtoken');
const config = require('../config');

const signAccess = (userId, firstName, lastName) =>
  jwt.sign({ sub: userId, first_name: firstName, last_name: lastName }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const signRefresh = (userId, firstName, lastName) =>
  jwt.sign({ sub: userId, first_name: firstName, last_name: lastName  }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });

const verifyRefresh = (token) =>
  jwt.verify(token, config.jwt.refreshSecret);

module.exports = { signAccess, signRefresh, verifyRefresh };
