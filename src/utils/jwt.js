'use strict';
const jwt    = require('jsonwebtoken');
const config = require('../config');

const signAccess = (userId) =>
  jwt.sign({ sub: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const signRefresh = (userId) =>
  jwt.sign({ sub: userId }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });

const verifyRefresh = (token) =>
  jwt.verify(token, config.jwt.refreshSecret);

module.exports = { signAccess, signRefresh, verifyRefresh };
