-- Review request system
CREATE TABLE IF NOT EXISTS review_requests (
    id             SERIAL PRIMARY KEY,
    agent_id       INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    client_name    VARCHAR(200) NOT NULL,
    client_email   VARCHAR(255),
    client_phone   VARCHAR(20),
    property_address VARCHAR(500),
    transaction_type VARCHAR(20),
    channel        VARCHAR(20) DEFAULT 'email',  -- email | sms | whatsapp
    custom_message TEXT,
    status         VARCHAR(20) DEFAULT 'PENDING', -- PENDING|SENT|DELIVERED|OPENED|CLICKED|COMPLETED|FAILED
    sent_at        TIMESTAMP,
    delivered_at   TIMESTAMP,
    opened_at      TIMESTAMP,
    clicked_at     TIMESTAMP,
    completed_at   TIMESTAMP,
    review_id      INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
    reminder_count INTEGER DEFAULT 0,
    next_reminder  TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved agents (consumer feature)
CREATE TABLE IF NOT EXISTS saved_agents (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    agent_id   INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    notes      TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, agent_id)
);

-- Review alerts (consumer feature)
CREATE TABLE IF NOT EXISTS review_alerts (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    agent_id    INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    min_rating  INTEGER DEFAULT 4 CHECK (min_rating >= 1 AND min_rating <= 5),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_rr_agent_status ON review_requests(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_saved_user       ON saved_agents(user_id);
