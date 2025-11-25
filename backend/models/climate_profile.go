package models

import (
	"time"

	"gorm.io/gorm"
)

// ClimateProfile stores climate characteristics for a parcel
// Learned from weather history or estimated from latitude
type ClimateProfile struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	ParcelID uint `gorm:"uniqueIndex;not null" json:"parcel_id"`

	// Learned characteristics (NULL when using latitude fallback)
	WinterRainfallAvg  *float64 `json:"winter_rainfall_avg,omitempty"`    // mm/month
	SummerET0Avg       *float64 `json:"summer_et0_avg,omitempty"`         // mm/day
	AvgColdDaysPerYear *int     `json:"avg_cold_days_per_year,omitempty"` // Days < 10°C

	// Derived dormancy period (month numbers 1-12)
	DormancyStartMonth *int `json:"dormancy_start_month,omitempty"`
	DormancyEndMonth   *int `json:"dormancy_end_month,omitempty"`

	// Irrigation adjustments
	IrrigationFactor float64 `gorm:"default:1.0" json:"irrigation_factor"` // 0.8-1.2
	ETcMultiplier    float64 `gorm:"default:1.0" json:"etc_multiplier"`    // 0.9-1.2

	// Metadata
	DataSource       string     `gorm:"size:50" json:"data_source"`   // 'latitude_fallback' or 'weather_history'
	DataPoints       int        `gorm:"default:0" json:"data_points"` // Number of weather records
	FirstWeatherDate *time.Time `json:"first_weather_date,omitempty"`
	LastCalculated   *time.Time `json:"last_calculated,omitempty"`
	ConfidenceScore  float64    `gorm:"default:0.0" json:"confidence_score"` // 0-1

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM
func (ClimateProfile) TableName() string {
	return "climate_profiles"
}
