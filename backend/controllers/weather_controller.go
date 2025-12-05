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

// GetWeatherAdvisory returns unified weather-based advice for a parcel
// This endpoint provides consistent recommendations across pest, irrigation, and treatment decisions
func GetWeatherAdvisory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	advisoryService := services.NewWeatherAdvisoryService()
	advisory, err := advisoryService.GenerateAdvisory(uint(parcelID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, advisory)
}

// Get7DayConditions returns weather conditions analysis for next 7 days
func Get7DayConditions(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	advisoryService := services.NewWeatherAdvisoryService()
	conditions, err := advisoryService.Get7DayConditions(uint(parcelID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"parcel_id":  parcelID,
		"conditions": conditions,
	})
}

// CheckSprayWindow checks if today is suitable for spray application
func CheckSprayWindow(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	advisoryService := services.NewWeatherAdvisoryService()
	canSpray, reason, nextGoodDay := advisoryService.ShouldSpray(uint(parcelID))

	response := gin.H{
		"parcel_id":  parcelID,
		"can_spray":  canSpray,
		"reason":     reason,
	}
	if nextGoodDay >= 0 {
		response["next_good_day"] = nextGoodDay
	}

	c.JSON(http.StatusOK, response)
}

// CheckIrrigationWindow checks if irrigation is advisable today
func CheckIrrigationWindow(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	advisoryService := services.NewWeatherAdvisoryService()
	shouldIrrigate, reason := advisoryService.ShouldIrrigate(uint(parcelID))

	c.JSON(http.StatusOK, gin.H{
		"parcel_id":        parcelID,
		"should_irrigate":  shouldIrrigate,
		"reason":           reason,
	})
}

