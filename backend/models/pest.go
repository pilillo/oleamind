package models

import (
	"gorm.io/gorm"
)

// PestType represents the type of pest or disease
type PestType string

const (
	PestTypeOliveFly     PestType = "olive_fly"     // Bactrocera oleae
	PestTypePeacockSpot  PestType = "peacock_spot"  // Spilocaea oleagina
	PestTypeVerticillium PestType = "verticillium"  // Verticillium wilt
	PestTypeOliveKnot    PestType = "olive_knot"    // Pseudomonas savastanoi
	PestTypeAnthracnose  PestType = "anthracnose"   // Colletotrichum spp.
)

// RiskLevel represents the severity of pest/disease risk
type RiskLevel string

const (
	RiskLevelNone     RiskLevel = "none"
	RiskLevelLow      RiskLevel = "low"
	RiskLevelModerate RiskLevel = "moderate"
	RiskLevelHigh     RiskLevel = "high"
	RiskLevelCritical RiskLevel = "critical"
)

// PestRiskAssessment stores daily pest/disease risk calculations for a parcel
type PestRiskAssessment struct {
	gorm.Model
	ParcelID          uint      `json:"parcel_id" binding:"required"`
	Date              DateOnly  `json:"date" binding:"required"`
	PestType          PestType  `json:"pest_type" binding:"required"`
	RiskLevel         RiskLevel `json:"risk_level" binding:"required"`
	RiskScore         float64   `json:"risk_score"`         // 0-100 numerical score
	Temperature       float64   `json:"temperature"`        // Average temperature (°C)
	Humidity          float64   `json:"humidity"`           // Average humidity (%)
	Precipitation     float64   `json:"precipitation"`      // Total precipitation (mm)
	FavorableCondDays int       `json:"favorable_cond_days"` // Consecutive days with favorable conditions
	AlertMessage      string    `json:"alert_message"`      // Human-readable alert
	Recommendations   string    `json:"recommendations"`    // Treatment recommendations (JSON or text)
	
	// Foreign keys
	Parcel Parcel `gorm:"foreignKey:ParcelID" json:"-"`
}

// TreatmentThreshold defines the intervention thresholds for each pest/disease
type TreatmentThreshold struct {
	gorm.Model
	PestType              PestType  `json:"pest_type" binding:"required"`
	Region                string    `json:"region"` // Optional: geographic-specific thresholds
	InterventionThreshold float64   `json:"intervention_threshold" binding:"required,min=0,max=100"` // Risk score threshold
	Description           string    `json:"description"`
	RecommendedActions    string    `json:"recommended_actions"` // JSON array of treatment options
	ChemicalOptions       string    `json:"chemical_options"`    // JSON array
	BiologicalOptions     string    `json:"biological_options"`  // JSON array
	CulturalPractices     string    `json:"cultural_practices"`  // JSON array
}

// TreatmentLog records actual pest control treatments applied
type TreatmentLog struct {
	gorm.Model
	ParcelID      uint      `json:"parcel_id" binding:"required"`
	Date          DateOnly  `json:"date" binding:"required"`
	PestType      PestType  `json:"pest_type" binding:"required"`
	TreatmentType string    `json:"treatment_type"` // chemical, biological, cultural, trap
	ProductName   string    `json:"product_name"`
	ActiveAgent   string    `json:"active_agent"`
	DoseRate      string    `json:"dose_rate"`
	ApplicationMethod string `json:"application_method"` // spray, drench, bait, etc.
	TargetArea    float64   `json:"target_area"` // hectares treated
	Cost          float64   `json:"cost" binding:"min=0"`
	Efficacy      string    `json:"efficacy"` // observed effectiveness
	Notes         string    `json:"notes"`
	
	// Foreign keys
	Parcel Parcel `gorm:"foreignKey:ParcelID" json:"-"`
}

// PestMonitoring records manual pest monitoring observations
type PestMonitoring struct {
	gorm.Model
	ParcelID        uint      `json:"parcel_id" binding:"required"`
	Date            DateOnly  `json:"date" binding:"required"`
	PestType        PestType  `json:"pest_type" binding:"required"`
	MonitoringMethod string   `json:"monitoring_method"` // trap, visual, etc.
	Count           int       `json:"count"`             // e.g., flies caught
	InfectionRate   float64   `json:"infection_rate"`    // % of affected trees/fruits
	Severity        string    `json:"severity"`          // low, moderate, high
	Location        string    `json:"location"`          // within the parcel
	Notes           string    `json:"notes"`
	Photos          string    `json:"photos"` // JSON array of photo URLs
	
	// Foreign keys
	Parcel Parcel `gorm:"foreignKey:ParcelID" json:"-"`
}

