package controllers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

func CreateParcel(c *gin.Context) {
	var parcel models.Parcel
	if err := c.BindJSON(&parcel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure FarmID is set (omitted auth check for brevity, but should come from token)
	// For MVP, we assume FarmID is passed in body or we set it to 1
	if parcel.FarmID == 0 {
		parcel.FarmID = 1 // Default farm
	}

	result := initializers.DB.Create(&parcel)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Calculate area from geometry using PostGIS if geometry exists
	if len(parcel.GeoJSON) > 0 {
		var areaInHectares float64
		// ST_Area with geography type returns square meters, convert to hectares
		err := initializers.DB.Raw(`
			SELECT ST_Area(ST_GeomFromGeoJSON(?::text)::geography) / 10000.0 as area
		`, string(parcel.GeoJSON)).Scan(&areaInHectares).Error
		
		if err == nil {
			parcel.Area = areaInHectares
			initializers.DB.Model(&parcel).Update("area", areaInHectares)
		} else {
			log.Printf("⚠️  Failed to calculate area for parcel %d: %v", parcel.ID, err)
		}
	}

	// Reload parcel with varieties and GeoJSON for response
	initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, parcel.ID)

	c.JSON(http.StatusOK, parcel)
}

func GetParcels(c *gin.Context) {
	var parcels []models.Parcel
	// We must select geo_json as GeoJSON string for our custom scanner to work with ST_AsGeoJSON
	// Note: GORM default column name for GeoJSON field is 'geo_json' (snake_case)
	// Preload Varieties with their GeoJSON converted
	result := initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("id, created_at, updated_at, deleted_at, name, farm_id, area, trees_count, ST_AsGeoJSON(geo_json) as geo_json").Find(&parcels)
	
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, parcels)
}

func UpdateParcel(c *gin.Context) {
	id := c.Param("id")
	var parcel models.Parcel

	// Use Select to correctly load GeoJSON
	if err := initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	var input models.Parcel
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Debug logging
	log.Printf("📥 UpdateParcel received %d varieties", len(input.Varieties))
	for i, v := range input.Varieties {
		log.Printf("  Variety %d: %s, TreeCount: %d, GeoJSON length: %d", i, v.Cultivar, v.TreeCount, len(v.GeoJSON))
	}

	// Recalculate area from geometry if geometry was updated
	if len(input.GeoJSON) > 0 {
		var areaInHectares float64
		// ST_Area with geography type returns square meters, convert to hectares
		err := initializers.DB.Raw(`
			SELECT ST_Area(ST_GeomFromGeoJSON(?::text)::geography) / 10000.0 as area
		`, string(input.GeoJSON)).Scan(&areaInHectares).Error
		
		if err == nil {
			input.Area = areaInHectares
			log.Printf("📐 Calculated area from geometry: %.2f ha", areaInHectares)
		} else {
			log.Printf("⚠️  Failed to calculate area for parcel %s: %v", id, err)
		}
	}

	// Update main fields
	if err := initializers.DB.Model(&parcel).Updates(models.Parcel{
		Name:       input.Name,
		Area:       input.Area,
		TreesCount: input.TreesCount,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update parcel fields"})
		return
	}

	// Update Varieties (Replace all)
	// Replace handles adding new ones and removing deleted ones from the association
	if err := initializers.DB.Model(&parcel).Association("Varieties").Replace(input.Varieties); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update varieties"})
		return
	}

	// Explicitly save each variety to ensure content (fields) are updated
	// Replace() sometimes skips updates for existing associated records
	for _, v := range input.Varieties {
		// Ensure ParcelID is set (Replace does this, but good to be sure for Save)
		v.ParcelID = parcel.ID
		if err := initializers.DB.Save(&v).Error; err != nil {
			log.Printf("Error saving variety %d: %v", v.ID, err)
		}
	}

	// Reload to get fresh data
	initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, id)

	c.JSON(http.StatusOK, parcel)
}

func DeleteParcel(c *gin.Context) {
	id := c.Param("id")
	var parcel models.Parcel

	// We don't strictly need GeoJSON for delete, but consistent loading is good
	if err := initializers.DB.Select("id").First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	initializers.DB.Delete(&parcel)
	c.JSON(http.StatusOK, gin.H{"message": "Parcel deleted"})
}

