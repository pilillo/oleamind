package models

import (
	"time"

	"gorm.io/gorm"
)

// IrrigationEvent represents a single irrigation event for a parcel
type IrrigationEvent struct {
	gorm.Model
	ParcelID       uint      `json:"parcel_id" binding:"required"`
	Date           DateOnly  `json:"date" binding:"required"`
	WaterAmount    float64   `json:"water_amount" binding:"required,min=0"` // mm or L/m²
	Duration       float64   `json:"duration"`                               // minutes
	Method         string    `json:"method"`                                 // drip, sprinkler, flood
	Notes          string    `json:"notes"`
	Cost           float64   `json:"cost" binding:"min=0"`
	EnergyUsed     float64   `json:"energy_used"` // kWh
	WaterSource    string    `json:"water_source"` // well, river, municipal, etc.
	FlowRate       float64   `json:"flow_rate"`    // L/hour
}

// IrrigationRecommendation represents calculated irrigation advice for a parcel
type IrrigationRecommendation struct {
	gorm.Model
	ParcelID              uint      `json:"parcel_id" gorm:"uniqueIndex:idx_parcel_date"`
	CalculationDate       time.Time `json:"calculation_date" gorm:"uniqueIndex:idx_parcel_date"`
	
	// Water balance components
	ET0                   float64   `json:"et0"`                     // Reference evapotranspiration (mm/day)
	Kc                    float64   `json:"kc"`                      // Crop coefficient for olive trees
	ETc                   float64   `json:"etc"`                     // Crop evapotranspiration (mm/day)
	Rainfall              float64   `json:"rainfall"`                // mm
	EffectiveRainfall     float64   `json:"effective_rainfall"`      // mm (adjusted for runoff)
	IrrigationApplied     float64   `json:"irrigation_applied"`      // mm
	
	// Water balance
	WaterBalance          float64   `json:"water_balance"`           // mm (positive = surplus, negative = deficit)
	CumulativeDeficit     float64   `json:"cumulative_deficit"`      // mm
	SoilMoistureEstimate  float64   `json:"soil_moisture_estimate"`  // % (0-100)
	
	// Recommendation
	ShouldIrrigate        bool      `json:"should_irrigate"`
	RecommendedAmount     float64   `json:"recommended_amount"`      // mm
	RecommendedLitersTree float64   `json:"recommended_liters_tree"` // L/tree
	UrgencyLevel          string    `json:"urgency_level"`           // low, medium, high, critical
	NextIrrigationDate    time.Time `json:"next_irrigation_date"`
	
	// Additional factors
	GrowthStage           string    `json:"growth_stage"`            // dormant, flowering, fruit_set, fruit_development, harvest, post_harvest
	StressLevel           string    `json:"stress_level"`            // none, mild, moderate, severe
	WeatherForecast       string    `json:"weather_forecast"`        // summary of next 7 days
	
	// Deficit irrigation strategy
	DeficitStrategy       string    `json:"deficit_strategy"`        // none, regulated, sustained
	DeficitReduction      float64   `json:"deficit_reduction"`       // % reduction from full ET
}

// SoilProfile represents soil characteristics for a parcel (affects water holding capacity)
type SoilProfile struct {
	gorm.Model
	ParcelID                uint    `json:"parcel_id" gorm:"uniqueIndex"`
	SoilType                string  `json:"soil_type"`                  // clay, loam, sand, etc.
	FieldCapacity           float64 `json:"field_capacity"`             // % (water content at field capacity)
	WiltingPoint            float64 `json:"wilting_point"`              // % (permanent wilting point)
	AvailableWaterCapacity  float64 `json:"available_water_capacity"`   // mm (total available water in root zone)
	RootDepth               float64 `json:"root_depth"`                 // cm
	InfiltrationRate        float64 `json:"infiltration_rate"`          // mm/hour
	Slope                   float64 `json:"slope"`                      // % (affects runoff)
	OrganicMatter           float64 `json:"organic_matter"`             // %
	Notes                   string  `json:"notes"`
}

// IrrigationSystem represents the irrigation infrastructure for a parcel
type IrrigationSystem struct {
	gorm.Model
	ParcelID       uint    `json:"parcel_id" gorm:"uniqueIndex"`
	SystemType     string  `json:"system_type"`      // drip, sprinkler, micro_sprinkler, subsurface
	Efficiency     float64 `json:"efficiency"`       // % (0-100, typical drip = 90%)
	FlowRate       float64 `json:"flow_rate"`        // L/hour per tree or per m²
	EmitterSpacing float64 `json:"emitter_spacing"`  // cm
	TreeSpacing    float64 `json:"tree_spacing"`     // meters between trees
	InstallDate    *time.Time `json:"install_date"`
	LastMaintenance *time.Time `json:"last_maintenance"`
	Notes          string  `json:"notes"`
}

// WaterUsageStats represents aggregated water usage statistics
type WaterUsageStats struct {
	ParcelID           uint      `json:"parcel_id"`
	StartDate          time.Time `json:"start_date"`
	EndDate            time.Time `json:"end_date"`
	TotalWaterApplied  float64   `json:"total_water_applied"`   // mm
	TotalRainfall      float64   `json:"total_rainfall"`        // mm
	TotalET0           float64   `json:"total_et0"`             // mm
	IrrigationEvents   int       `json:"irrigation_events"`
	AverageWaterPerEvent float64 `json:"average_water_per_event"` // mm
	TotalCost          float64   `json:"total_cost"`            // €
	WaterUseEfficiency float64   `json:"water_use_efficiency"`  // %
}

