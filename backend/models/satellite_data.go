package models

import (
	"time"

	"gorm.io/gorm"
)

type SatelliteData struct {
	gorm.Model
	ParcelID    uint      `json:"parcel_id" gorm:"index"`
	ProductDate time.Time `json:"product_date"` // Date of the satellite capture
	ProcessedAt time.Time `json:"processed_at"` // When we calculated it
	CloudCover  float64   `json:"cloud_cover"`
	
	// NDVI Statistics
	NDVIMean  float64 `json:"ndvi_mean"`
	NDVIStd   float64 `json:"ndvi_std"`
	NDVIMin   float64 `json:"ndvi_min"`
	NDVIMax   float64 `json:"ndvi_max"`
	PixelCount int    `json:"pixel_count"`
	
	// Image data (Base64 encoded PNG)
	ImageBase64 string `json:"image_base64" gorm:"type:text"`
	
	// Image bounds for precise alignment [min_lon, min_lat, max_lon, max_lat]
	ImageBounds string `json:"image_bounds"` // JSON array stored as string
	
	// Metadata
	ImageDimensions string `json:"image_dimensions"`
	Satellite       string `json:"satellite"`
	
	// Foreign key
	Parcel Parcel `gorm:"foreignKey:ParcelID"`
}

