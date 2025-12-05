package models

import (
	"time"

	"gorm.io/gorm"
)

// WeatherData stores weather information for parcels
type WeatherData struct {
	gorm.Model
	ParcelID         uint      `json:"parcel_id" gorm:"index"`
	Parcel           Parcel    `json:"parcel,omitempty" gorm:"foreignKey:ParcelID"`
	
	// Location
	Latitude         float64   `json:"latitude"`
	Longitude        float64   `json:"longitude"`
	
	// Current conditions
	Temperature      float64   `json:"temperature"`       // °C
	Humidity         int       `json:"humidity"`          // %
	Precipitation    float64   `json:"precipitation"`     // mm
	WindSpeed        float64   `json:"wind_speed"`        // km/h
	WindDirection    int       `json:"wind_direction"`    // degrees
	CloudCover       int       `json:"cloud_cover"`       // %
	Pressure         float64   `json:"pressure"`          // hPa
	
	// Calculated values
	ET0              float64   `json:"et0"`               // Reference evapotranspiration mm/day
	SoilMoisture     float64   `json:"soil_moisture"`     // % (0-100)
	
	// Forecast indicators
	RainNext24h      float64   `json:"rain_next_24h"`     // mm expected
	TempMin24h       float64   `json:"temp_min_24h"`      // °C
	TempMax24h       float64   `json:"temp_max_24h"`      // °C
	
	// Timestamps
	DataTimestamp    time.Time `json:"data_timestamp"`    // When the weather data is for
	FetchedAt        time.Time `json:"fetched_at"`        // When we fetched this data
	
	// Cache control
	FarmID           uint      `json:"farm_id"`
}

// WeatherForecast stores hourly forecast data
type WeatherForecast struct {
	gorm.Model
	ParcelID         uint      `json:"parcel_id" gorm:"index"`
	
	// Time
	ForecastTime     time.Time `json:"forecast_time"`
	
	// Forecasted values
	Temperature      float64   `json:"temperature"`       // °C
	Humidity         int       `json:"humidity"`          // %
	Precipitation    float64   `json:"precipitation"`     // mm
	WindSpeed        float64   `json:"wind_speed"`        // km/h
	CloudCover       int       `json:"cloud_cover"`       // %
	ET0              float64   `json:"et0"`               // mm/hour
	
	// Metadata
	FetchedAt        time.Time `json:"fetched_at"`
	FarmID           uint      `json:"farm_id"`
}

// DailyForecast stores daily forecast data for 7-day predictions
// This is the foundation for all DSS (pest, irrigation, treatment planning)
type DailyForecast struct {
	gorm.Model
	ParcelID uint `json:"parcel_id" gorm:"index;not null"`

	// Forecast date (the day this forecast is for)
	ForecastDate DateOnly `json:"forecast_date" gorm:"index;not null"`

	// Temperature range
	TempMin float64 `json:"temp_min"` // °C minimum
	TempMax float64 `json:"temp_max"` // °C maximum
	TempAvg float64 `json:"temp_avg"` // °C average (calculated)

	// Precipitation
	PrecipitationSum  float64 `json:"precipitation_sum"`  // mm total for the day
	PrecipitationProb int     `json:"precipitation_prob"` // % probability of rain

	// Humidity
	HumidityMin int `json:"humidity_min"` // % minimum
	HumidityMax int `json:"humidity_max"` // % maximum
	HumidityAvg int `json:"humidity_avg"` // % average

	// Wind
	WindSpeedMax float64 `json:"wind_speed_max"` // km/h maximum
	WindSpeedAvg float64 `json:"wind_speed_avg"` // km/h average
	WindGustMax  float64 `json:"wind_gust_max"`  // km/h maximum gust

	// Solar and evapotranspiration
	ET0          float64 `json:"et0"`           // mm/day reference evapotranspiration
	SunshineDur  float64 `json:"sunshine_dur"`  // hours of sunshine
	UVIndexMax   float64 `json:"uv_index_max"`  // UV index maximum

	// Cloud cover
	CloudCoverAvg int `json:"cloud_cover_avg"` // % average

	// Metadata
	DaysAhead int       `json:"days_ahead"` // 0 = today, 1 = tomorrow, etc.
	FetchedAt time.Time `json:"fetched_at"` // When this forecast was fetched
	FarmID    uint      `json:"farm_id"`
}

// ForecastRiskPrediction stores predicted pest/disease risk for future days
type ForecastRiskPrediction struct {
	gorm.Model
	ParcelID uint `json:"parcel_id" gorm:"index;not null"`

	// Forecast date
	ForecastDate DateOnly `json:"forecast_date" gorm:"index;not null"`
	DaysAhead    int      `json:"days_ahead"` // 0 = today, 1 = tomorrow, etc.

	// Pest/Disease type
	PestType PestType `json:"pest_type" gorm:"size:50;index"`

	// Risk prediction
	RiskScore   float64   `json:"risk_score"`   // 0-100
	RiskLevel   RiskLevel `json:"risk_level"`   // none, low, moderate, high, critical
	RiskTrend   string    `json:"risk_trend"`   // increasing, stable, decreasing
	Confidence  float64   `json:"confidence"`   // 0-100 (higher for nearer days)

	// Weather factors used
	TempAvg         float64 `json:"temp_avg"`
	HumidityAvg     int     `json:"humidity_avg"`
	PrecipitationMm float64 `json:"precipitation_mm"`

	// Alert and recommendations
	AlertMessage    string `json:"alert_message"`
	Recommendations string `json:"recommendations" gorm:"type:text"`

	// Metadata
	FetchedAt time.Time `json:"fetched_at"`
}

// IsStale checks if weather data needs refreshing (older than 1 hour)
func (w *WeatherData) IsStale() bool {
	return time.Since(w.FetchedAt) > time.Hour
}

// IsForecastStale checks if forecast data needs refreshing (older than 6 hours)
func (f *DailyForecast) IsForecastStale() bool {
	return time.Since(f.FetchedAt) > 6*time.Hour
}

// GetWeatherConditionEmoji returns an emoji based on conditions
func (w *WeatherData) GetWeatherConditionEmoji() string {
	if w.Precipitation > 0 {
		return "🌧️"
	}
	if w.CloudCover > 80 {
		return "☁️"
	}
	if w.CloudCover > 40 {
		return "⛅"
	}
	return "☀️"
}

