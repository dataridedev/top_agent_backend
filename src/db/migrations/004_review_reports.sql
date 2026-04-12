-- Review reports (moderation queue)
CREATE TABLE IF NOT EXISTS review_reports (
    id          SERIAL PRIMARY KEY,
    review_id   INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
    reported_by INTEGER REFERENCES users(id)   ON DELETE SET NULL,
    reason      VARCHAR(50) NOT NULL,
    description TEXT,
    resolved    BOOLEAN DEFAULT false,
    resolved_by INTEGER REFERENCES users(id)   ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    resolution  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, reported_by)
);

-- Add extra columns to reviews for 8-dimension ratings
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reviewer_email      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS property_address    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS transaction_type    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rating_communication    INTEGER CHECK (rating_communication    BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_negotiation      INTEGER CHECK (rating_negotiation      BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_market_knowledge INTEGER CHECK (rating_market_knowledge BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_responsiveness   INTEGER CHECK (rating_responsiveness   BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_pricing          INTEGER CHECK (rating_pricing          BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_paperwork        INTEGER CHECK (rating_paperwork        BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_availability     INTEGER CHECK (rating_availability     BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_recommendation   INTEGER CHECK (rating_recommendation   BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_review_reports_review   ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_resolved ON review_reports(resolved) WHERE resolved = false;
