-- TopAgents Platform Database Schema
-- PostgreSQL recommended for JSON support and complex queries

-- Core agent profiles
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    brokerage VARCHAR(255),
    bio TEXT,
    photo_url VARCHAR(500),
    website VARCHAR(500),
    languages TEXT[], -- PostgreSQL array for multiple languages
    specialties TEXT[], -- Array for specialties (residential, commercial, etc.)
    areas_served TEXT[], -- Array for cities/regions
    
    -- Profile status
    claimed_at TIMESTAMP NULL, -- NULL = unclaimed, NOT NULL = claimed
    verified_at TIMESTAMP NULL,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Scoring system
    current_tier VARCHAR(20) DEFAULT 'BRONZE',
    total_points INTEGER DEFAULT 0,
    year_points INTEGER DEFAULT 0, -- Resets annually
    avg_rating DECIMAL(3,2) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    
    -- Contact preferences
    lead_notifications BOOLEAN DEFAULT true,
    referral_notifications BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multi-platform review aggregation
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Review source
    platform VARCHAR(50) NOT NULL, -- 'google', 'rew', 'ratemyagent', etc.
    platform_review_id VARCHAR(100), -- External review ID for deduplication
    platform_url VARCHAR(500),
    
    -- Review content
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    text TEXT,
    reviewer_name VARCHAR(100),
    
    -- Verification and dates
    verified BOOLEAN DEFAULT false,
    transaction_verified BOOLEAN DEFAULT false, -- RateMyAgent style verification
    review_date DATE NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Response tracking
    agent_responded BOOLEAN DEFAULT false,
    agent_response TEXT,
    response_date TIMESTAMP NULL,
    
    UNIQUE(agent_id, platform, platform_review_id)
);

-- Referral marketplace
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    
    -- Agent relationships
    sender_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    
    -- Client and property details
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    property_type VARCHAR(50), -- 'residential', 'commercial', 'investment'
    transaction_type VARCHAR(20), -- 'buy', 'sell', 'rent'
    budget_min INTEGER,
    budget_max INTEGER,
    location VARCHAR(200),
    timeline VARCHAR(100),
    notes TEXT,
    
    -- Referral terms
    referral_fee_percent DECIMAL(4,2), -- e.g., 25.00 for 25%
    referral_fee_flat INTEGER, -- Alternative to percentage
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, IN_PROGRESS, COMPLETED, CANCELLED
    message TEXT, -- Initial message from sender
    response_message TEXT, -- Receiver's response
    
    -- Important dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- Completion details
    sale_price INTEGER, -- Final transaction amount
    commission_amount INTEGER, -- Total commission
    referral_fee_paid INTEGER -- Actual fee paid
);

-- Points and scoring system
CREATE TABLE point_transactions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    
    points INTEGER NOT NULL, -- Can be negative for penalties
    action_type VARCHAR(50) NOT NULL, -- 'review_added', 'referral_completed', etc.
    description TEXT,
    
    -- Source tracking
    source_type VARCHAR(50), -- 'review', 'referral', 'profile', 'platform_connection'
    source_id INTEGER, -- ID of the review, referral, etc. that generated points
    
    -- Multipliers and bonuses
    base_points INTEGER, -- Points before any multipliers
    multiplier DECIMAL(3,2) DEFAULT 1.0,
    bonus_reason VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM created_at)) STORED
);

-- Platform API connections
CREATE TABLE platform_connections (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    
    platform VARCHAR(50) NOT NULL, -- 'google', 'rew', 'ratemyagent', etc.
    platform_account_id VARCHAR(200), -- Their account ID on that platform
    
    -- API credentials (encrypted)
    api_credentials JSONB, -- Encrypted tokens, refresh tokens, etc.
    
    -- Sync status
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, ERROR, DISABLED
    sync_error_message TEXT,
    total_synced_reviews INTEGER DEFAULT 0,
    
    UNIQUE(agent_id, platform)
);

-- Lead capture and routing
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    
    -- Lead source
    source VARCHAR(50) NOT NULL, -- 'topagents_search', 'agent_profile', 'city_page'
    source_url VARCHAR(500),
    
    -- Lead contact info
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    message TEXT,
    
    -- Lead details
    looking_for VARCHAR(20), -- 'buy', 'sell', 'rent', 'invest'
    property_type VARCHAR(50),
    budget_min INTEGER,
    budget_max INTEGER,
    location VARCHAR(200),
    timeline VARCHAR(100),
    
    -- Status and response
    status VARCHAR(20) DEFAULT 'NEW', -- NEW, CONTACTED, QUALIFIED, CONVERTED, CLOSED
    agent_response_time INTEGER, -- Minutes to first response
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contacted_at TIMESTAMP NULL,
    qualified_at TIMESTAMP NULL
);

-- Tier definitions and thresholds
CREATE TABLE tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(20) UNIQUE NOT NULL,
    min_points INTEGER NOT NULL,
    max_points INTEGER,
    tier_order INTEGER NOT NULL,
    
    -- Requirements beyond points
    min_reviews INTEGER DEFAULT 0,
    min_avg_rating DECIMAL(3,2) DEFAULT 0.0,
    min_platforms_connected INTEGER DEFAULT 0,
    min_referrals_completed INTEGER DEFAULT 0,
    
    -- Visual branding
    color_hex VARCHAR(7),
    badge_icon VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier structure
INSERT INTO tiers (tier_name, min_points, max_points, tier_order, min_reviews, min_avg_rating, min_platforms_connected, color_hex) VALUES
('BRONZE', 0, 249, 1, 1, 0.0, 0, '#CD7F32'),
('SILVER', 250, 599, 2, 5, 4.0, 1, '#C0C0C0'),
('GOLD', 600, 1199, 3, 15, 4.3, 2, '#FFD700'),
('PLATINUM', 1200, 2499, 4, 30, 4.5, 3, '#E5E4E2'),
('DIAMOND', 2500, 4999, 5, 50, 4.7, 3, '#B9F2FF'),
('LUMINARY', 5000, NULL, 6, 100, 4.8, 3, '#9966CC');

-- BC cities and regions
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    province VARCHAR(20) DEFAULT 'BC',
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly version
    
    -- SEO and content
    population INTEGER,
    avg_home_price INTEGER,
    total_agents INTEGER DEFAULT 0,
    seo_title VARCHAR(200),
    seo_description TEXT,
    content TEXT, -- City description for landing pages
    
    -- Geography
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Career badges (never reset)
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    badge_name VARCHAR(100) UNIQUE NOT NULL,
    badge_description TEXT,
    requirements JSONB, -- Complex requirements stored as JSON
    badge_icon VARCHAR(50),
    badge_color VARCHAR(7),
    is_career_badge BOOLEAN DEFAULT false -- true = never resets, false = annual
);

-- Agent badge achievements
CREATE TABLE agent_badges (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
    
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    year_earned INTEGER,
    requirements_met JSONB, -- Snapshot of what they achieved
    
    UNIQUE(agent_id, badge_id, year_earned)
);

-- Subscription and billing (post Year 1)
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    
    plan_type VARCHAR(20) NOT NULL, -- 'ESSENTIAL', 'PRO', 'FEATURED'
    price_monthly INTEGER NOT NULL, -- Cents (e.g., 1000 = $10.00)
    
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, CANCELLED, PAST_DUE, SUSPENDED
    
    -- Billing cycle
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_billing_date DATE,
    cancelled_at TIMESTAMP NULL,
    
    -- Payment tracking
    stripe_subscription_id VARCHAR(100),
    last_payment_at TIMESTAMP NULL,
    payment_failed_count INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX idx_agents_license ON agents(license_number);
CREATE INDEX idx_agents_claimed ON agents(claimed_at) WHERE claimed_at IS NOT NULL;
CREATE INDEX idx_agents_tier_points ON agents(current_tier, total_points);
CREATE INDEX idx_agents_location ON agents USING GIN(areas_served);

CREATE INDEX idx_reviews_agent_platform ON reviews(agent_id, platform);
CREATE INDEX idx_reviews_rating_date ON reviews(rating, review_date);
CREATE INDEX idx_reviews_verified ON reviews(verified) WHERE verified = true;

CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_agents ON referrals(sender_id, receiver_id);
CREATE INDEX idx_referrals_location ON referrals(location);

CREATE INDEX idx_points_agent_year ON point_transactions(agent_id, year);
CREATE INDEX idx_points_action_type ON point_transactions(action_type);

CREATE INDEX idx_leads_agent_status ON leads(agent_id, status);
CREATE INDEX idx_leads_created ON leads(created_at);

-- Views for common queries
CREATE VIEW agent_summary AS
SELECT 
    a.id,
    a.first_name,
    a.last_name,
    a.current_tier,
    a.total_points,
    a.avg_rating,
    a.total_reviews,
    a.brokerage,
    COUNT(DISTINCT pc.platform) as connected_platforms,
    COUNT(DISTINCT CASE WHEN r.status = 'COMPLETED' THEN r.id END) as completed_referrals
FROM agents a
LEFT JOIN platform_connections pc ON a.id = pc.agent_id AND pc.sync_status = 'ACTIVE'
LEFT JOIN referrals r ON (a.id = r.sender_id OR a.id = r.receiver_id)
WHERE a.claimed_at IS NOT NULL
GROUP BY a.id;

-- Function to update agent scoring (called nightly)
CREATE OR REPLACE FUNCTION update_agent_scores()
RETURNS void AS $$
BEGIN
    -- Update review counts and averages
    UPDATE agents SET
        total_reviews = review_counts.total,
        avg_rating = review_counts.avg_rating
    FROM (
        SELECT 
            agent_id,
            COUNT(*) as total,
            ROUND(AVG(rating::numeric), 2) as avg_rating
        FROM reviews 
        WHERE verified = true
        GROUP BY agent_id
    ) review_counts
    WHERE agents.id = review_counts.agent_id;
    
    -- Update tier based on current points and requirements
    UPDATE agents SET current_tier = (
        SELECT tier_name 
        FROM tiers t
        WHERE agents.year_points >= t.min_points
            AND (t.max_points IS NULL OR agents.year_points <= t.max_points)
            AND agents.total_reviews >= t.min_reviews
            AND agents.avg_rating >= t.min_avg_rating
        ORDER BY t.tier_order DESC
        LIMIT 1
    );
    
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent points when point_transactions are added
CREATE OR REPLACE FUNCTION update_agent_points()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE agents SET
        total_points = total_points + NEW.points,
        year_points = year_points + NEW.points,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.agent_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_points
    AFTER INSERT ON point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_points();