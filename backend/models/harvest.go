package models

import (
	"time"

	"gorm.io/gorm"
)

// HarvestLog records olive harvest data per parcel
type HarvestLog struct {
	gorm.Model
	ParcelID       uint     `json:"parcel_id" binding:"required"`
	Date           DateOnly `json:"date" binding:"required"`
	Cultivar       string    `json:"cultivar"`                             // Optional: specific variety harvested
	QuantityKg     float64   `json:"quantity_kg" binding:"required,min=0"` // Kilograms harvested
	Quality        string    `json:"quality"`                              // excellent, good, fair, poor
	Destination    string    `json:"destination"`                          // mill name or storage location
	LotNumber      string    `json:"lot_number"`                           // For traceability
	LaborHours     float64   `json:"labor_hours" binding:"min=0"`
	Workers        int       `json:"workers" binding:"min=0"`
	HarvestMethod  string    `json:"harvest_method"` // manual, mechanical, mixed
	Cost           float64   `json:"cost" binding:"min=0"`
	PricePerKg     float64   `json:"price_per_kg" binding:"min=0"` // Sale price if sold
	Revenue        float64   `json:"revenue" binding:"min=0"`      // Total revenue from this harvest
	MaturityIndex  float64   `json:"maturity_index"`               // 0-7 scale (Jaén index)
	Notes          string    `json:"notes"`
	WeatherAtHarvest string  `json:"weather_at_harvest"` // JSON: temp, humidity, etc.
	
	// Foreign keys
	Parcel Parcel `gorm:"foreignKey:ParcelID" json:"-"`
}

// YieldPrediction stores yield forecasts for parcels
type YieldPrediction struct {
	gorm.Model
	ParcelID           uint      `json:"parcel_id" binding:"required"`
	Year               int       `json:"year" binding:"required"`
	PredictionDate     time.Time `json:"prediction_date"`
	PredictedYieldKg   float64   `json:"predicted_yield_kg" binding:"min=0"`
	PredictedYieldPerTree float64 `json:"predicted_yield_per_tree"` // kg/tree
	ConfidenceLevel    string    `json:"confidence_level"`          // low, medium, high
	Method             string    `json:"method"`                    // manual, historical_average, model
	ActualYieldKg      float64   `json:"actual_yield_kg"`           // Filled after harvest
	Accuracy           float64   `json:"accuracy"`                  // % accuracy after harvest
	Notes              string    `json:"notes"`
	Factors            string    `json:"factors"` // JSON: weather, ndvi, pest, etc.
	
	// Foreign keys
	Parcel Parcel `gorm:"foreignKey:ParcelID" json:"-"`
}

// CostSummary aggregates costs by parcel for a time period
type CostSummary struct {
	ParcelID       uint    `json:"parcel_id"`
	ParcelName     string  `json:"parcel_name"`
	StartDate      string  `json:"start_date"`
	EndDate        string  `json:"end_date"`
	OperationsCost float64 `json:"operations_cost"` // From OperationLog
	HarvestCost    float64 `json:"harvest_cost"`    // From HarvestLog
	TreatmentCost  float64 `json:"treatment_cost"`  // From TreatmentLog
	IrrigationCost float64 `json:"irrigation_cost"` // From IrrigationEvent
	TotalCost      float64 `json:"total_cost"`
	TotalRevenue   float64 `json:"total_revenue"` // From HarvestLog
	NetProfit      float64 `json:"net_profit"`
	ROI            float64 `json:"roi"` // Return on Investment %
}

// YieldStats aggregates yield statistics for reporting
type YieldStats struct {
	ParcelID          uint    `json:"parcel_id"`
	ParcelName        string  `json:"parcel_name"`
	Year              int     `json:"year"`
	TotalYieldKg      float64 `json:"total_yield_kg"`
	YieldPerHectare   float64 `json:"yield_per_hectare"` // kg/ha
	YieldPerTree      float64 `json:"yield_per_tree"`    // kg/tree
	HarvestCount      int     `json:"harvest_count"`     // Number of harvest events
	AverageQuality    string  `json:"average_quality"`
	TotalRevenue      float64 `json:"total_revenue"`
	AveragePricePerKg float64 `json:"average_price_per_kg"`
}

