# TopAgents API

> Real Estate Agent Review & Referral Platform — Express.js REST API

## Owner
dataRide Technologies Pvt Ltd

## Tech Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Runtime      | Node.js ≥ 18                                    |
| Framework    | Express.js 4                                    |
| Database     | PostgreSQL (raw `pg` driver — no ORM)           |
| Auth         | JWT (access + refresh token rotation)           |
| Validation   | express-validator                               |
| Docs         | Swagger UI (OpenAPI 3.0)                        |
| Scheduling   | node-cron                                       |
| Security     | helmet, cors, express-rate-limit, bcryptjs      |

---

## Project Structure

```
topagents-api/
├── src/
│   ├── app.js                  # Entry point — Express setup, Swagger, server boot
│   ├── config/
│   │   └── index.js            # All env vars in one place
│   ├── db/
│   │   ├── pool.js             # pg Pool — query(), withTransaction(), getClient()
│   │   ├── migrate.js          # Migration runner (node src/db/migrate.js)
│   │   ├── seed.js             # Seed tiers, badges, BC cities
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       ├── 002_users_auth.sql
│   │       ├── 003_review_requests.sql
│   │       └── 004_review_reports.sql
│   ├── middleware/
│   │   ├── auth.js             # authenticate, optionalAuth, authorize, ownsAgent
│   │   ├── errorHandler.js     # Global error handler (ApiError + pg codes)
│   │   ├── rateLimiter.js      # defaultLimiter, authLimiter, searchLimiter
│   │   ├── validate.js         # express-validator result collector
│   │   └── pagination.js       # ?page=&limit= → req.pagination
│   ├── routes/
│   │   ├── index.js            # Mounts all routers under /api/v1
│   │   ├── auth.routes.js
│   │   ├── agent.routes.js
│   │   ├── review.routes.js
│   │   ├── referral.routes.js
│   │   ├── lead.routes.js
│   │   ├── points.routes.js
│   │   ├── city.routes.js
│   │   └── admin.routes.js
│   ├── controllers/            # Thin HTTP layer — calls services, sends responses
│   ├── services/               # All business logic and raw SQL queries
│   │   ├── auth.service.js
│   │   ├── agent.service.js
│   │   ├── review.service.js
│   │   ├── referral.service.js
│   │   ├── lead.service.js
│   │   ├── points.service.js
│   │   ├── city.service.js
│   │   └── cron.service.js     # Scheduled jobs (tier recalc, token cleanup)
│   ├── validators/             # express-validator rule sets per domain
│   ├── utils/
│   │   ├── errors.js           # ApiError class + helpers
│   │   ├── response.js         # success(), paginated(), created(), noContent()
│   │   ├── jwt.js              # signAccess, signRefresh, verifyRefresh
│   │   ├── password.js         # bcrypt hash/compare
│   │   └── points.js           # POINTS constants + awardPoints()
│   └── swagger/
│       └── swagger.yaml        # Full OpenAPI 3.0 spec
└── .env.example
```

---

## Quick Start

### 1. Prerequisites

```bash
node -v   # >= 18
psql --version  # PostgreSQL >= 14
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET
```

### 4. Create the database

```bash
psql -U postgres -c "CREATE DATABASE topagents_dev;"
```

### 5. Run migrations

```bash
node src/db/migrate.js
```

### 6. Seed initial data (tiers, badges, BC cities)

```bash
node src/db/seed.js
```

### 7. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3000`

---

## API Documentation

Swagger UI is available at:

```
http://localhost:3000/api-docs
```

Raw OpenAPI JSON for Postman/code gen:

```
http://localhost:3000/api-docs.json
```

---

## API Endpoints Summary

### Auth — `/api/v1/auth`

| Method | Path                   | Auth | Description                    |
|--------|------------------------|------|--------------------------------|
| POST   | /signup                | —    | Register new user              |
| POST   | /login                 | —    | Login, receive JWT tokens      |
| POST   | /refresh               | —    | Rotate refresh token           |
| POST   | /logout                | —    | Revoke refresh token           |
| GET    | /verify-email/:token   | —    | Verify email address           |
| POST   | /forgot-password       | —    | Request password reset email   |
| POST   | /reset-password        | —    | Reset via email token          |
| GET    | /me                    | ✓    | Get current user               |
| PUT    | /change-password       | ✓    | Change password                |

### Agents — `/api/v1/agents`

| Method | Path                          | Auth        | Description                  |
|--------|-------------------------------|-------------|------------------------------|
| GET    | /                             | Optional    | Search & filter agents       |
| POST   | /                             | Admin       | Create agent (bulk seed)     |
| GET    | /:agentId                     | —           | Get agent profile            |
| PATCH  | /:agentId                     | Owner/Admin | Update agent profile         |
| POST   | /:agentId/claim               | Agent       | Claim unclaimed profile      |
| GET    | /:agentId/stats               | —           | Review & referral stats      |
| GET    | /:agentId/reviews             | —           | Paginated agent reviews      |
| GET    | /:agentId/points              | Owner       | Point transaction history    |
| GET    | /:agentId/tier                | —           | Tier progress                |
| GET    | /:agentId/connections         | Owner       | Connected platforms          |
| POST   | /:agentId/connections         | Owner       | Connect review platform      |
| DELETE | /:agentId/connections/:platform | Owner     | Disconnect platform          |

### Reviews — `/api/v1/reviews`

| Method | Path               | Auth        | Description               |
|--------|--------------------|-------------|---------------------------|
| POST   | /                  | Optional    | Submit review             |
| POST   | /import            | Agent       | Bulk import from platform |
| GET    | /:reviewId         | —           | Get review by ID          |
| POST   | /:reviewId/reply   | Agent       | Reply to review           |
| POST   | /:reviewId/report  | Optional    | Report for moderation     |
| PATCH  | /:reviewId/verify  | Admin       | Verify review             |

### Referrals — `/api/v1/referrals`

| Method | Path                     | Auth  | Description              |
|--------|--------------------------|-------|--------------------------|
| GET    | /                        | Agent | List referrals           |
| POST   | /                        | Agent | Send referral            |
| GET    | /:referralId             | Agent | Get referral details     |
| PATCH  | /:referralId/respond     | Agent | Accept/decline/counter   |
| PATCH  | /:referralId/complete    | Agent | Mark complete            |

### Leads — `/api/v1/leads`

| Method | Path                | Auth     | Description            |
|--------|---------------------|----------|------------------------|
| POST   | /                   | Optional | Submit lead            |
| GET    | /                   | Agent    | List leads             |
| PATCH  | /:leadId/status     | Agent    | Update lead stage      |

### Cities — `/api/v1/cities`

| Method | Path        | Auth | Description                      |
|--------|-------------|------|----------------------------------|
| GET    | /           | —    | List BC cities                   |
| GET    | /:slug      | —    | City landing page with top agents|

### Admin — `/api/v1/admin`

| Method | Path                          | Auth  | Description                |
|--------|-------------------------------|-------|----------------------------|
| GET    | /dashboard                    | Admin | Platform KPIs              |
| GET    | /agents                       | Admin | All agents (admin view)    |
| PATCH  | /agents/:agentId/suspend      | Admin | Suspend/reactivate agent   |
| GET    | /reviews/flagged              | Admin | Flagged review queue       |
| POST   | /tiers/recalculate            | Admin | Manual tier recalculation  |

---

## Points System

| Action                        | Points     |
|-------------------------------|------------|
| Native review verified        | 50         |
| Platform review imported      | 20         |
| Review response               | 10         |
| First platform connected      | 75         |
| Each additional platform      | 35         |
| Referral completed (each side)| 80         |
| Lead responded < 1 hour       | 20         |
| Lead responded < 2 hours      | 10         |
| Profile completed             | 100 (once) |
| Rating avg 4.5–4.79           | +10% bonus |
| Rating avg 4.8+               | +25% bonus |

---

## Scheduled Jobs (node-cron)

| Schedule        | Job                                           |
|-----------------|-----------------------------------------------|
| Daily at 2:00am | Tier recalculation (`update_agent_scores()`)  |
| Jan 1 00:05     | Annual `year_points` reset                    |
| Every 6 hours   | Expired token cleanup                         |
| Every hour      | City agent counts refresh                     |
| Daily at 3:00am | Founding Agent badge award                    |

---

## Response Format

All responses follow this envelope:

```json
{ "success": true, "data": { ... } }
```

Paginated responses include a `meta` object:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 250,
    "page": 1,
    "limit": 20,
    "totalPages": 13,
    "hasNext": true,
    "hasPrev": false
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": 422,
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Valid email is required" }]
  }
}
```
