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

	// Get user tier (TODO: Get from authenticated user context)
	// For now, default to "free" - should be extracted from JWT or session
	userTier := "free"

	// Use satellite service for caching logic
	satelliteService := services.NewSatelliteService()
	response, err := satelliteService.GetOrFetchNDVI(uint(parcelID), userTier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to process NDVI: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

