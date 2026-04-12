'use strict';
const bcrypt = require('bcryptjs');
const config = require('../config');

const hash    = (plain) => bcrypt.hash(plain, config.bcrypt.rounds);
const compare = (plain, hashed) => bcrypt.compare(plain, hashed);

module.exports = { hash, compare };
