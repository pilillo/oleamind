package models

import (
	"gorm.io/gorm"
)

// OperationLog represents a work log entry for compliance and tracking
type OperationLog struct {
	gorm.Model
	Type         string     `json:"type" binding:"required"` // pruning, fertilization, irrigation, pest_control, harvest, other
	Category     string     `json:"category"`                // phytosanitary, fertilization, maintenance, harvest
	Date         DateOnly   `json:"date" binding:"required"`
	Description  string     `json:"description"`
	ParcelID     uint       `json:"parcel_id" binding:"required"`
	Parcel       Parcel     `json:"parcel" gorm:"foreignKey:ParcelID"`
	
	// Compliance fields for phytosanitary register
	ProductName  string     `json:"product_name"`  // Name of chemical/product used
	ActiveAgent  string     `json:"active_agent"`  // Active ingredient
	Quantity     float64    `json:"quantity"`      // Amount used
	Unit         string     `json:"unit"`          // kg, L, units
	
	// Labor tracking
	LaborHours   float64    `json:"labor_hours"`   // Hours spent
	Workers      int        `json:"workers"`       // Number of workers
	
	// Equipment used
	Equipment    string     `json:"equipment"`     // Tractor, sprayer, etc.
	
	// Cost tracking
	Cost         float64    `json:"cost"`          // Total cost
	
	// Status
	Status       string     `json:"status"`        // planned, completed, cancelled
	Notes        string     `json:"notes"`         // Additional notes
	
	FarmID       uint       `json:"farm_id"`
}

