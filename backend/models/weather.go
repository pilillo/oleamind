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

// IsStale checks if weather data needs refreshing (older than 1 hour)
func (w *WeatherData) IsStale() bool {
	return time.Since(w.FetchedAt) > time.Hour
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

