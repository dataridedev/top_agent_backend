'use strict';
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const swaggerUi    = require('swagger-ui-express');
const YAML         = require('yamljs');
const path         = require('path');

const config       = require('./config');
const routes       = require('./routes');
const { errorHandler }   = require('./middleware/errorHandler');
const { defaultLimiter } = require('./middleware/rateLimiter');
const { pool }     = require('./db/pool');
const { registerJobs }   = require('./services/cron.service');

const app = express();

// ─── Security & Parsing ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.cors.origins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// ─── Global rate limit ───────────────────────────────────────────────────────
app.use(defaultLimiter);

// ─── Health check (no auth, no rate limit) ───────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status:    'ok',
      env:       config.env,
      timestamp: new Date().toISOString(),
      db:        'connected',
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ─── Swagger UI ──────────────────────────────────────────────────────────────
const swaggerDoc = YAML.load(path.join(__dirname, 'swagger', 'swagger.yaml'));

// Inject server URL dynamically
swaggerDoc.servers = [
  { url: `${config.baseUrl}/api/${config.apiVersion}`, description: 'Current server' },
  { url: 'https://api.topagents.ca/api/v1',            description: 'Production'    },
];

// Helmet's default CSP blocks Swagger UI inline scripts — disable it for docs routes only
app.use('/api-docs', (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDoc, {
    customSiteTitle: 'TopAgents API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1B3A5C; }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

// Expose raw spec for tooling (Postman import, code gen, etc.)
app.get('/api-docs.json', (_req, res) => res.json(swaggerDoc));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(`/api/${config.apiVersion}`, routes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 404, message: 'Route not found' },
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`\n┌────────────────────────────────────────────────────┐`);
  console.log(`│  TopAgents API                                      │`);
  console.log(`│  Env  : ${config.env.padEnd(42)}│`);
  console.log(`│  Port : ${String(config.port).padEnd(42)}│`);
  console.log(`│  API  : ${`${config.baseUrl}/api/${config.apiVersion}`.padEnd(42)}│`);
  console.log(`│  Docs : ${`${config.baseUrl}/api-docs`.padEnd(42)}│`);
  console.log(`└────────────────────────────────────────────────────┘\n`);

  // Register cron jobs after server is up
  if (config.env !== 'test') {
    registerJobs();
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  server.close(async () => {
    await pool.end();
    console.log('[SHUTDOWN] DB pool closed. Bye!');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => { console.error('[SHUTDOWN] Forced exit'); process.exit(1); }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
