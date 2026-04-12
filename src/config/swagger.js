const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TopAgents.ca API',
      version: '1.0.0',
      description: `
## TopAgents.ca — Real Estate Agent Review & Referral SaaS Platform

BC's first comprehensive agent review, ranking, and referral network.

### Authentication
Most endpoints require a Bearer JWT token in the **Authorization** header:
\`\`\`
Authorization: Bearer <your_access_token>
\`\`\`

Obtain a token via **POST /api/v1/auth/login**.

### Rate Limiting
- General endpoints: **100 requests / 15 minutes**
- Auth endpoints: **10 requests / 15 minutes**

### Roles
| Role       | Description |
|------------|-------------|
| consumer   | Home buyer/seller browsing agents |
| agent      | Licensed real estate agent |
| admin      | Platform administrator |
      `,
      contact: {
        name:  'TopAgents.ca Support',
        email: 'support@topagents.ca',
        url:   'https://topagents.ca',
      },
      license: { name: 'Proprietary' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local Development' },
      { url: 'https://api.topagents.ca', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtained from /api/v1/auth/login',
        },
      },
      schemas: {
        // ── Pagination ─────────────────────────────────────────────────────
        Pagination: {
          type: 'object',
          properties: {
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            total:      { type: 'integer', example: 150 },
            totalPages: { type: 'integer', example: 8 },
          },
        },

        // ── Error ──────────────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: 'Validation failed' },
            errors:  { type: 'array', items: { type: 'object' } },
          },
        },

        // ── User ──────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id:         { type: 'integer', example: 1 },
            email:      { type: 'string',  example: 'jane@example.com' },
            first_name: { type: 'string',  example: 'Jane' },
            last_name:  { type: 'string',  example: 'Smith' },
            role:       { type: 'string',  enum: ['consumer','agent','admin'] },
            avatar_url: { type: 'string',  nullable: true },
            created_at: { type: 'string',  format: 'date-time' },
          },
        },

        AuthTokens: {
          type: 'object',
          properties: {
            access_token:  { type: 'string' },
            refresh_token: { type: 'string' },
            expires_in:    { type: 'integer', example: 604800 },
            token_type:    { type: 'string',  example: 'Bearer' },
          },
        },

        // ── Agent ─────────────────────────────────────────────────────────
        Agent: {
          type: 'object',
          properties: {
            id:             { type: 'integer' },
            license_number: { type: 'string' },
            first_name:     { type: 'string' },
            last_name:      { type: 'string' },
            email:          { type: 'string' },
            phone:          { type: 'string', nullable: true },
            brokerage:      { type: 'string', nullable: true },
            bio:            { type: 'string', nullable: true },
            photo_url:      { type: 'string', nullable: true },
            website:        { type: 'string', nullable: true },
            languages:      { type: 'array', items: { type: 'string' } },
            specialties:    { type: 'array', items: { type: 'string' } },
            areas_served:   { type: 'array', items: { type: 'string' } },
            current_tier:   { type: 'string', enum: ['BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','LUMINARY'] },
            total_points:   { type: 'integer' },
            year_points:    { type: 'integer' },
            avg_rating:     { type: 'number',  format: 'float' },
            total_reviews:  { type: 'integer' },
            claimed_at:     { type: 'string',  format: 'date-time', nullable: true },
            verified_at:    { type: 'string',  format: 'date-time', nullable: true },
            created_at:     { type: 'string',  format: 'date-time' },
          },
        },

        // ── Review ────────────────────────────────────────────────────────
        Review: {
          type: 'object',
          properties: {
            id:                  { type: 'integer' },
            agent_id:            { type: 'integer' },
            platform:            { type: 'string' },
            rating:              { type: 'integer', minimum: 1, maximum: 5 },
            title:               { type: 'string', nullable: true },
            text:                { type: 'string', nullable: true },
            reviewer_name:       { type: 'string' },
            dim_communication:   { type: 'integer', nullable: true },
            dim_negotiation:     { type: 'integer', nullable: true },
            dim_market_knowledge:{ type: 'integer', nullable: true },
            dim_responsiveness:  { type: 'integer', nullable: true },
            dim_pricing:         { type: 'integer', nullable: true },
            dim_paperwork:       { type: 'integer', nullable: true },
            dim_availability:    { type: 'integer', nullable: true },
            dim_recommendation:  { type: 'integer', nullable: true },
            verified:            { type: 'boolean' },
            transaction_verified:{ type: 'boolean' },
            status:              { type: 'string', enum: ['PENDING','APPROVED','REJECTED'] },
            agent_responded:     { type: 'boolean' },
            agent_response:      { type: 'string', nullable: true },
            helpful_votes:       { type: 'integer' },
            review_date:         { type: 'string', format: 'date' },
            created_at:          { type: 'string', format: 'date-time' },
          },
        },

        // ── Referral ──────────────────────────────────────────────────────
        Referral: {
          type: 'object',
          properties: {
            id:                  { type: 'integer' },
            sender_id:           { type: 'integer' },
            receiver_id:         { type: 'integer', nullable: true },
            client_name:         { type: 'string' },
            property_type:       { type: 'string', nullable: true },
            transaction_type:    { type: 'string', nullable: true },
            budget_min:          { type: 'integer', nullable: true },
            budget_max:          { type: 'integer', nullable: true },
            location:            { type: 'string', nullable: true },
            referral_fee_percent:{ type: 'number', nullable: true },
            status:              { type: 'string', enum: ['PENDING','ACCEPTED','DECLINED','IN_PROGRESS','COMPLETED','CANCELLED'] },
            created_at:          { type: 'string', format: 'date-time' },
          },
        },

        // ── Lead ──────────────────────────────────────────────────────────
        Lead: {
          type: 'object',
          properties: {
            id:           { type: 'integer' },
            agent_id:     { type: 'integer', nullable: true },
            source:       { type: 'string' },
            name:         { type: 'string' },
            email:        { type: 'string', nullable: true },
            phone:        { type: 'string', nullable: true },
            looking_for:  { type: 'string', nullable: true },
            property_type:{ type: 'string', nullable: true },
            budget_min:   { type: 'integer', nullable: true },
            budget_max:   { type: 'integer', nullable: true },
            intent_score: { type: 'integer' },
            status:       { type: 'string', enum: ['NEW','CONTACTED','QUALIFIED','CONVERTED','CLOSED'] },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },

        // ── Point Transaction ─────────────────────────────────────────────
        PointTransaction: {
          type: 'object',
          properties: {
            id:           { type: 'integer' },
            agent_id:     { type: 'integer' },
            points:       { type: 'integer' },
            action_type:  { type: 'string' },
            description:  { type: 'string', nullable: true },
            source_type:  { type: 'string', nullable: true },
            multiplier:   { type: 'number' },
            bonus_reason: { type: 'string', nullable: true },
            year:         { type: 'integer' },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },

        // ── Tier ──────────────────────────────────────────────────────────
        Tier: {
          type: 'object',
          properties: {
            id:                      { type: 'integer' },
            tier_name:               { type: 'string' },
            min_points:              { type: 'integer' },
            max_points:              { type: 'integer', nullable: true },
            tier_order:              { type: 'integer' },
            min_reviews:             { type: 'integer' },
            min_avg_rating:          { type: 'number' },
            min_platforms_connected: { type: 'integer' },
            color_hex:               { type: 'string' },
          },
        },

        // ── Subscription ──────────────────────────────────────────────────
        Subscription: {
          type: 'object',
          properties: {
            id:                   { type: 'integer' },
            agent_id:             { type: 'integer' },
            plan_type:            { type: 'string', enum: ['ESSENTIAL','PRO','FEATURED','BROKERAGE','ENTERPRISE'] },
            price_monthly:        { type: 'integer', description: 'Amount in cents' },
            status:               { type: 'string', enum: ['ACTIVE','CANCELLED','PAST_DUE','SUSPENDED'] },
            started_at:           { type: 'string', format: 'date-time' },
            next_billing_date:    { type: 'string', format: 'date', nullable: true },
            cancelled_at:         { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid authentication token',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        ValidationError: {
          description: 'Validation failed',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
      },
    },
    tags: [
      { name: 'Auth',          description: 'Authentication — signup, login, token refresh, logout' },
      { name: 'Agents',        description: 'Agent profiles — search, view, claim, update' },
      { name: 'Reviews',       description: 'Review CRUD, moderation, agent responses' },
      { name: 'Referrals',     description: 'Peer-to-peer referral marketplace' },
      { name: 'Leads',         description: 'Consumer lead capture and agent routing' },
      { name: 'Points',        description: 'Points engine and tier progression' },
      { name: 'Subscriptions', description: 'Billing plans and subscription management' },
      { name: 'Platforms',     description: 'External platform connections (Google, REW, etc.)' },
      { name: 'Cities',        description: 'BC city directory and SEO landing page data' },
      { name: 'Tiers',         description: 'Tier definitions and requirements' },
      { name: 'Badges',        description: 'Achievement badges — career and annual' },
      { name: 'Admin',         description: 'Platform administration — requires admin role' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
