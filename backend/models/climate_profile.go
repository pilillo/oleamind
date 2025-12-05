package models

import (
	"time"

	"gorm.io/gorm"
)

// ClimateProfile stores climate characteristics for a parcel
// Learned from weather history, historical climate data, or estimated from location
type ClimateProfile struct {
	ID       uint `gorm:"primaryKey" json:"id"`
	ParcelID uint `gorm:"uniqueIndex;not null" json:"parcel_id"`

	// =========================================
	// LOCATION DATA (extracted from parcel geometry)
	// =========================================
	Latitude      float64 `json:"latitude"`                                // Decimal degrees
	Longitude     float64 `json:"longitude"`                               // Decimal degrees
	Altitude      float64 `json:"altitude"`                                // Meters above sea level (from DEM or manual)
	DistanceToSea float64 `json:"distance_to_sea"`                         // km (estimated from coordinates)
	ClimateType   string  `gorm:"size:50" json:"climate_type"`             // Köppen-like: "Csa", "Csb", "BSk", etc.
	IsCoastal     bool    `json:"is_coastal"`                              // < 50km from sea
	IsMountainous bool    `json:"is_mountainous"`                          // Altitude > 400m

	// =========================================
	// TEMPERATURE CHARACTERISTICS
	// =========================================
	AvgAnnualTemp        *float64 `json:"avg_annual_temp,omitempty"`          // °C
	AvgJanTemp           *float64 `json:"avg_jan_temp,omitempty"`             // °C - coldest month (N. hemisphere)
	AvgJulTemp           *float64 `json:"avg_jul_temp,omitempty"`             // °C - warmest month (N. hemisphere)
	AvgColdDaysPerYear   *int     `json:"avg_cold_days_per_year,omitempty"`   // Days < 10°C
	AvgFrostDaysPerYear  *int     `json:"avg_frost_days_per_year,omitempty"`  // Days < 0°C
	AvgHotDaysPerYear    *int     `json:"avg_hot_days_per_year,omitempty"`    // Days > 35°C
	LastSpringFrostDay   *int     `json:"last_spring_frost_day,omitempty"`    // Day of year (1-365)
	FirstAutumnFrostDay  *int     `json:"first_autumn_frost_day,omitempty"`   // Day of year (1-365)
	DiurnalTempRange     *float64 `json:"diurnal_temp_range,omitempty"`       // °C difference day/night

	// =========================================
	// GROWING DEGREE DAYS (base 10°C for olives)
	// =========================================
	AnnualGDD            *int `json:"annual_gdd,omitempty"`                  // Growing Degree Days per year
	GDDToFlowering       *int `json:"gdd_to_flowering,omitempty"`            // GDD needed to reach flowering
	GDDToHarvest         *int `json:"gdd_to_harvest,omitempty"`              // GDD needed to reach harvest

	// =========================================
	// PRECIPITATION & MOISTURE
	// =========================================
	AnnualRainfall       *float64 `json:"annual_rainfall,omitempty"`         // mm/year
	WinterRainfallAvg    *float64 `json:"winter_rainfall_avg,omitempty"`     // mm/month (Nov-Feb N., May-Aug S.)
	SummerRainfallAvg    *float64 `json:"summer_rainfall_avg,omitempty"`     // mm/month (Jun-Aug N., Dec-Feb S.)
	DryMonthsPerYear     *int     `json:"dry_months_per_year,omitempty"`     // Months with < 30mm rain
	AvgHumidity          *int     `json:"avg_humidity,omitempty"`            // % annual average

	// =========================================
	// EVAPOTRANSPIRATION
	// =========================================
	SummerET0Avg         *float64 `json:"summer_et0_avg,omitempty"`          // mm/day
	AnnualET0            *float64 `json:"annual_et0,omitempty"`              // mm/year
	WaterDeficitRisk     *float64 `json:"water_deficit_risk,omitempty"`      // 0-1 (ET0 - rainfall in summer)

	// =========================================
	// DORMANCY PERIOD
	// =========================================
	DormancyStartMonth   *int `json:"dormancy_start_month,omitempty"`        // Month 1-12
	DormancyEndMonth     *int `json:"dormancy_end_month,omitempty"`          // Month 1-12
	ChillingHours        *int `json:"chilling_hours,omitempty"`              // Hours < 7°C (needed for flowering)

	// =========================================
	// ADJUSTMENT FACTORS (derived from climate data)
	// =========================================
	IrrigationFactor     float64 `gorm:"default:1.0" json:"irrigation_factor"`  // 0.8-1.2
	ETcMultiplier        float64 `gorm:"default:1.0" json:"etc_multiplier"`     // 0.9-1.2
	PestPressureFactor   float64 `gorm:"default:1.0" json:"pest_pressure_factor"` // 0.8-1.2 (higher = more pest risk)
	FrostRiskFactor      float64 `gorm:"default:1.0" json:"frost_risk_factor"`    // 0.5-2.0

	// =========================================
	// OLIVE SUITABILITY
	// =========================================
	OliveSuitabilityScore float64 `gorm:"default:0.0" json:"olive_suitability_score"` // 0-100
	SuitabilityNotes      string  `gorm:"type:text" json:"suitability_notes,omitempty"`

	// =========================================
	// METADATA
	// =========================================
	DataSource           string     `gorm:"size:50" json:"data_source"`       // 'location_estimate', 'weather_history', 'historical_api'
	DataPoints           int        `gorm:"default:0" json:"data_points"`     // Number of weather records used
	FirstWeatherDate     *time.Time `json:"first_weather_date,omitempty"`
	LastCalculated       *time.Time `json:"last_calculated,omitempty"`
	ConfidenceScore      float64    `gorm:"default:0.0" json:"confidence_score"` // 0-1

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for GORM
func (ClimateProfile) TableName() string {
	return "climate_profiles"
}
