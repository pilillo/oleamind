package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/services"
)

func ProcessSatellite(c *gin.Context) {
	// Get Parcel ID
	idStr := c.Param("id")
	parcelID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Verify parcel exists
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	// Verify user has access to this parcel's farm
	user, _ := c.Get("user")
	u := user.(models.User)

	// Check if user has access to this farm
	var hasAccess bool
	// Check if user is owner
	if parcel.FarmID > 0 {
		var farm models.Farm
		if err := initializers.DB.Where("id = ? AND owner_id = ?", parcel.FarmID, u.ID).First(&farm).Error; err == nil {
			hasAccess = true
		} else {
			// Check UserFarm
			var userFarm models.UserFarm
			if err := initializers.DB.Where("user_id = ? AND farm_id = ?", u.ID, parcel.FarmID).First(&userFarm).Error; err == nil {
				hasAccess = true
			}
		}
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this parcel"})
		return
	}

	// Get farm tier (default to "free" if not set)
	farmTier := "free"
	if parcel.FarmID > 0 {
		var farm models.Farm
		if err := initializers.DB.Select("tier").First(&farm, parcel.FarmID).Error; err == nil {
			if farm.Tier != "" {
				farmTier = farm.Tier
			}
		}
	}

	// Use satellite service for caching logic
	satelliteService := services.NewSatelliteService()
	response, err := satelliteService.GetOrFetchNDVI(uint(parcelID), farmTier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to process NDVI: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}
