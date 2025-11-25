-- Migration: Add climate_profiles table
-- Purpose: Store learned and latitude-based climate characteristics per parcel

CREATE TABLE IF NOT EXISTS climate_profiles (
    id SERIAL PRIMARY KEY,
    parcel_id INTEGER UNIQUE NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    
    -- Learned climate characteristics (NULL initially, populated from weather data)
    winter_rainfall_avg DOUBLE PRECISION,      -- mm/month (Nov-Feb or May-Aug for Southern Hemisphere)
    summer_et0_avg DOUBLE PRECISION,            -- mm/day (Jun-Aug or Dec-Feb for Southern Hemisphere)
    avg_cold_days_per_year INTEGER,            -- Days with temp < 10°C (for dormancy detection)
    
    -- Derived dormancy period (month numbers 1-12)
    dormancy_start_month INTEGER,              -- When dormancy begins
    dormancy_end_month INTEGER,                -- When growing season starts
    
    -- Derived irrigation adjustments
    irrigation_factor DOUBLE PRECISION DEFAULT 1.0,   -- Multiplier for threshold (0.8-1.2)
    etc_multiplier DOUBLE PRECISION DEFAULT 1.0,      -- Regional ET adjustment (0.9-1.2)
    
    -- Metadata
    data_source VARCHAR(50),                   -- 'latitude_fallback' or 'weather_history'
    data_points INTEGER DEFAULT 0,             -- Number of weather records analyzed
    first_weather_date DATE,                   -- Oldest weather data used in analysis
    last_calculated TIMESTAMP,                 -- When profile was last computed
    confidence_score DOUBLE PRECISION DEFAULT 0.0,  -- 0-1 based on data quantity/quality
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                       -- Soft delete support
);

-- Indexes for performance
CREATE INDEX idx_climate_profiles_parcel ON climate_profiles(parcel_id);
CREATE INDEX idx_climate_profiles_updated ON climate_profiles(last_calculated);
CREATE INDEX idx_climate_profiles_deleted ON climate_profiles(deleted_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_climate_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER climate_profiles_updated_at
    BEFORE UPDATE ON climate_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_climate_profile_updated_at();

-- Comments for documentation
COMMENT ON TABLE climate_profiles IS 'Climate characteristics learned from weather data or estimated from latitude';
COMMENT ON COLUMN climate_profiles.data_source IS 'Indicates if profile is based on actual weather data or latitude estimate';
COMMENT ON COLUMN climate_profiles.confidence_score IS 'Quality indicator: 0 (no data) to 1 (full year+ of weather data)';
