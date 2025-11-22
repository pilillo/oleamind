package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/services"
)

// GetWeatherForParcel returns current weather data for a specific parcel
func GetWeatherForParcel(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	weatherService := services.NewWeatherService()
	weatherData, err := weatherService.GetWeatherForParcel(uint(parcelID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, weatherData)
}

// RefreshAllWeather triggers a refresh of weather data for all parcels
func RefreshAllWeather(c *gin.Context) {
	weatherService := services.NewWeatherService()
	
	// Run in background
	go func() {
		if err := weatherService.GetWeatherForAllParcels(); err != nil {
			// Log error but don't fail the request
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Weather refresh started for all parcels",
	})
}

