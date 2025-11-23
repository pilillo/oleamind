package controllers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/utils"
	"gorm.io/gorm"
)

func CreateParcel(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	var parcel models.Parcel
	if err := c.BindJSON(&parcel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// FarmID is required
	if parcel.FarmID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "FarmID is required"})
		return
	}

	// Verify user has access to this farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == parcel.FarmID {
			hasAccess = true
			break
		}
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this farm"})
		return
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
			slog.Warn("Failed to calculate area for parcel",
				"parcel_id", parcel.ID,
				"error", err,
			)
		}
	}

	// Reload parcel with varieties and GeoJSON for response
	initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, parcel.ID)

	c.JSON(http.StatusOK, parcel)
}

func GetParcels(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	// Get user's accessible farms
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)

	if len(accessibleFarms) == 0 {
		c.JSON(http.StatusOK, []models.Parcel{}) // Empty array
		return
	}

	var parcels []models.Parcel
	// Filter parcels by user's accessible farms
	result := initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("id, created_at, updated_at, deleted_at, name, farm_id, area, trees_count, ST_AsGeoJSON(geo_json) as geo_json").
		Where("farm_id IN ?", accessibleFarms).Find(&parcels)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, parcels)
}

func UpdateParcel(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	id := c.Param("id")
	var parcel models.Parcel

	// Use Select to correctly load GeoJSON
	if err := initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	// Verify user has access to this parcel's farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == parcel.FarmID {
			hasAccess = true
			break
		}
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this parcel"})
		return
	}

	var input models.Parcel
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Debug logging
	slog.Info("UpdateParcel received varieties", "count", len(input.Varieties))
	for i, v := range input.Varieties {
		slog.Info("Variety details",
			"index", i,
			"cultivar", v.Cultivar,
			"tree_count", v.TreeCount,
			"geojson_len", len(v.GeoJSON),
		)
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
			slog.Info("Calculated area from geometry", "area_ha", areaInHectares)
		} else {
			slog.Warn("Failed to calculate area for parcel",
				"parcel_id", id,
				"error", err,
			)
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
			slog.Error("Error saving variety",
				"variety_id", v.ID,
				"error", err,
			)
		}
	}

	// Reload to get fresh data
	initializers.DB.Preload("Varieties", func(db *gorm.DB) *gorm.DB {
		return db.Select("*, ST_AsGeoJSON(geo_json) as geo_json")
	}).Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, id)

	c.JSON(http.StatusOK, parcel)
}

func DeleteParcel(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	id := c.Param("id")
	var parcel models.Parcel

	if err := initializers.DB.Select("id, farm_id").First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	// Verify user has access to this parcel's farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == parcel.FarmID {
			hasAccess = true
			break
		}
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this parcel"})
		return
	}

	initializers.DB.Delete(&parcel)
	c.JSON(http.StatusOK, gin.H{"message": "Parcel deleted"})
}
