package models

import (
	"time"
	"gorm.io/gorm"
)

type InventoryItem struct {
	gorm.Model
	Name         string    `json:"name" binding:"required"`
	Category     string    `json:"category" binding:"required"` // fertilizers, pesticides, biological, irrigation, tools
	Quantity     float64   `json:"quantity" binding:"required,gte=0"`
	Unit         string    `json:"unit" binding:"required"` // kg, L, units, etc.
	MinimumStock float64   `json:"minimum_stock" binding:"gte=0"`
	CostPerUnit  float64   `json:"cost_per_unit" binding:"gte=0"`
	Supplier     string    `json:"supplier"`
	ExpiryDate   *time.Time `json:"expiry_date"` // pointer to allow null
	FarmID       uint      `json:"farm_id"`
}

