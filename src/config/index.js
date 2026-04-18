'use strict';
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiVersion: process.env.API_VERSION || 'v1',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    name:     process.env.DB_NAME     || 'topagents_dev',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    pool: {
      max:     parseInt(process.env.DB_POOL_MAX,     10) || 20,
      idleTimeoutMillis:    parseInt(process.env.DB_POOL_IDLE,    10) || 10000,
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
    },
  },

  jwt: {
    secret:         process.env.JWT_SECRET         || 'changeme',
    expiresIn:      process.env.JWT_EXPIRES_IN      || '7d',
    refreshSecret:  process.env.JWT_REFRESH_SECRET  || 'changeme_refresh',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max:      parseInt(process.env.RATE_LIMIT_MAX,        10) || 100,
    authMax:  parseInt(process.env.AUTH_RATE_LIMIT_MAX,   10) || 10,
  },

  email: {
    host:     process.env.SMTP_HOST     || 'smtp.resend.com',
    port:     parseInt(process.env.SMTP_PORT, 10) || 465,
    secure:   process.env.SMTP_SECURE === 'true',
    user:     process.env.SMTP_USER,
    pass:     process.env.SMTP_PASS,
    from:     process.env.EMAIL_FROM    || 'noreply@topagents.ca',
    fromName: process.env.EMAIL_FROM_NAME || 'TopAgents',
  },

  stripe: {
    secretKey:     process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  google: {
    clientId:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:  process.env.GOOGLE_REDIRECT_URI,
  },

    aws: {
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.AWS_REGION,
  bucketName: process.env.AWS_BUCKET_NAME,
},


  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(','),
  },

  adminSecret: process.env.ADMIN_SECRET_KEY || 'admin_secret',
};
