package controllers

import (
	"net/http"
	"strconv"
	"time"

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

// GetLatestSatelliteData returns the most recent satellite data for a parcel with all indices
func GetLatestSatelliteData(c *gin.Context) {
	parcelIDStr := c.Param("id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	var data models.SatelliteData
	result := initializers.DB.Where("parcel_id = ?", parcelID).
		Order("product_date DESC").
		First(&data)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No satellite data found for this parcel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     data,
		"age_days": int(time.Since(data.ProductDate).Hours() / 24),
	})
}

// GetSatelliteHistory returns historical satellite data for a parcel
func GetSatelliteHistory(c *gin.Context) {
	parcelIDStr := c.Param("id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Parse query parameters
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 || days > 365 {
		days = 30
	}

	// Calculate date threshold
	threshold := time.Now().AddDate(0, 0, -days)

	var history []models.SatelliteData
	result := initializers.DB.Where("parcel_id = ? AND product_date >= ?", parcelID, threshold).
		Order("product_date DESC").
		Find(&history)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch satellite history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  history,
		"count": len(history),
		"days":  days,
	})
}

// GetSatelliteIndexHistory returns time-series data for a specific index
func GetSatelliteIndexHistory(c *gin.Context) {
	parcelIDStr := c.Param("id")
	indexName := c.Param("index")

	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Validate index name
	validIndices := map[string]bool{
		"ndvi": true,
		"evi":  true,
		"savi": true,
		"ndwi": true,
		"ndmi": true,
	}
	if !validIndices[indexName] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid index name. Valid: ndvi, evi, savi, ndwi, ndmi"})
		return
	}

	daysStr := c.DefaultQuery("days", "90")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 || days > 365 {
		days = 90
	}

	threshold := time.Now().AddDate(0, 0, -days)

	var history []models.SatelliteData
	initializers.DB.Where("parcel_id = ? AND product_date >= ?", parcelID, threshold).
		Order("product_date ASC").
		Find(&history)

	// Extract time series for the requested index
	type DataPoint struct {
		Date  string   `json:"date"`
		Value *float64 `json:"value"`
	}

	var timeSeries []DataPoint
	for _, data := range history {
		var value *float64
		switch indexName {
		case "ndvi":
			v := data.NDVIMean
			value = &v
		case "evi":
			value = data.EVI
		case "savi":
			value = data.SAVI
		case "ndwi":
			value = data.NDWI
		case "ndmi":
			value = data.NDMI
		}

		timeSeries = append(timeSeries, DataPoint{
			Date:  data.ProductDate.Format("2006-01-02"),
			Value: value,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"index": indexName,
		"data":  timeSeries,
		"count": len(timeSeries),
		"days":  days,
	})
}
