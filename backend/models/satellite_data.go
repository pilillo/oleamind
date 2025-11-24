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
	NDVIMean float64 `json:"ndvi_mean"`
	NDVIStd  float64 `json:"ndvi_std"`
	NDVIMin  float64 `json:"ndvi_min"`
	NDVIMax  float64 `json:"ndvi_max"`

	// Enhanced Vegetation Indices
	EVI  *float64 `json:"evi"`  // Enhanced Vegetation Index
	SAVI *float64 `json:"savi"` // Soil Adjusted Vegetation Index

	// Water Stress Indices
	NDWI *float64 `json:"ndwi"` // Normalized Difference Water Index
	NDMI *float64 `json:"ndmi"` // Normalized Difference Moisture Index

	PixelCount int `json:"pixel_count"`

	// Image data (Base64 encoded PNG) - one image per index
	ImageBase64 string `json:"image_base64" gorm:"type:text"` // NDVI image (legacy)
	NDWIImage   string `json:"ndwi_image" gorm:"type:text"`   // NDWI overlay image
	NDMIImage   string `json:"ndmi_image" gorm:"type:text"`   // NDMI overlay image
	EVIImage    string `json:"evi_image" gorm:"type:text"`    // EVI overlay image

	// Image bounds for precise alignment [min_lon, min_lat, max_lon, max_lat]
	ImageBounds string `json:"image_bounds"` // JSON array stored as string

	// Metadata
	ImageDimensions string `json:"image_dimensions"`
	Satellite       string `json:"satellite"`

	// Foreign key
	Parcel Parcel `gorm:"foreignKey:ParcelID"`
}
