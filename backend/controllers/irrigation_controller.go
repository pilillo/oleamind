package controllers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/services"
)

// GetIrrigationRecommendation calculates and returns irrigation recommendation for a parcel
func GetIrrigationRecommendation(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID format"})
		return
	}

	irrigationService := services.NewIrrigationService()
	recommendation, err := irrigationService.CalculateRecommendation(uint(parcelID))
	if err != nil {
		slog.Error("Failed to calculate irrigation recommendation",
			"parcel_id", parcelID,
			"error", err,
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Enrich response with climate profile metadata for UI transparency
	climateService := services.NewClimateProfileService()
	profile, err := climateService.GetOrCreateProfile(uint(parcelID))

	// Get parcel for latitude extraction
	var parcel models.Parcel
	var latitude float64
	if err := irrigationService.DB.First(&parcel, parcelID).Error; err == nil {
		// Extract latitude from GeoJSON
		latitude = extractLatitudeForResponse(parcel.GeoJSON)
	}

	// Build enriched response
	response := map[string]interface{}{
		// Include all recommendation fields
		"id":                      recommendation.ID,
		"parcel_id":               recommendation.ParcelID,
		"calculation_date":        recommendation.CalculationDate,
		"should_irrigate":         recommendation.ShouldIrrigate,
		"urgency_level":           recommendation.UrgencyLevel,
		"recommended_amount":      recommendation.RecommendedAmount,
		"recommended_liters_tree": recommendation.RecommendedLitersTree,
		"next_irrigation_date":    recommendation.NextIrrigationDate,
		"et0":                     recommendation.ET0,
		"kc":                      recommendation.Kc,
		"etc":                     recommendation.ETc,
		"rainfall":                recommendation.Rainfall,
		"effective_rainfall":      recommendation.EffectiveRainfall,
		"irrigation_applied":      recommendation.IrrigationApplied,
		"water_balance":           recommendation.WaterBalance,
		"cumulative_deficit":      recommendation.CumulativeDeficit,
		"soil_moisture_estimate":  recommendation.SoilMoistureEstimate,
		"stress_level":            recommendation.StressLevel,
		"growth_stage":            recommendation.GrowthStage,
		"weather_forecast":        recommendation.WeatherForecast,
		"deficit_strategy":        recommendation.DeficitStrategy,
		"deficit_reduction":       recommendation.DeficitReduction,
	}

	// Add climate profile metadata if available
	if err == nil && profile != nil {
		response["climate_profile"] = map[string]interface{}{
			"data_source":          profile.DataSource,
			"data_points":          profile.DataPoints,
			"confidence_score":     profile.ConfidenceScore,
			"latitude":             latitude,
			"dormancy_start_month": profile.DormancyStartMonth,
			"dormancy_end_month":   profile.DormancyEndMonth,
			"last_calculated":      profile.LastCalculated,
		}
	}

	c.JSON(http.StatusOK, response)
}

// extractLatitudeForResponse extracts latitude from PostGISGeoJSON for API response
func extractLatitudeForResponse(geojson models.PostGISGeoJSON) float64 {
	if len(geojson) == 0 {
		return 0
	}

	var data map[string]interface{}
	if err := json.Unmarshal(geojson, &data); err != nil {
		return 0
	}

	if coords, ok := data["coordinates"].([]interface{}); ok && len(coords) > 0 {
		if ring, ok := coords[0].([]interface{}); ok && len(ring) > 0 {
			if point, ok := ring[0].([]interface{}); ok && len(point) >= 2 {
				if lat, ok := point[1].(float64); ok {
					return lat
				}
			}
		}
	}

	return 0
}

// LogIrrigationEvent logs a new irrigation event
func LogIrrigationEvent(c *gin.Context) {
	var event models.IrrigationEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	irrigationService := services.NewIrrigationService()
	if err := irrigationService.LogIrrigationEvent(&event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, event)
}

// GetIrrigationHistory returns irrigation events for a parcel
func GetIrrigationHistory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID format"})
		return
	}

	// Parse date range (default to last 30 days)
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed
		}
	}

	irrigationService := services.NewIrrigationService()
	events, err := irrigationService.GetIrrigationHistory(uint(parcelID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, events)
}

// GetWaterUsageStats returns water usage statistics for a parcel
func GetWaterUsageStats(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID format"})
		return
	}

	// Parse date range (default to current year)
	now := time.Now()
	startDate := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	endDate := now

	if startStr := c.Query("start_date"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		}
	}

	if endStr := c.Query("end_date"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed
		}
	}

	irrigationService := services.NewIrrigationService()
	stats, err := irrigationService.GetWaterUsageStats(uint(parcelID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// UpdateSoilProfile updates soil characteristics for a parcel
func UpdateSoilProfile(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID format"})
		return
	}

	var profile models.SoilProfile
	if err := c.ShouldBindJSON(&profile); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile.ParcelID = uint(parcelID)

	irrigationService := services.NewIrrigationService()
	if err := irrigationService.DB.Save(&profile).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateIrrigationSystem updates irrigation system info for a parcel
func UpdateIrrigationSystem(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID format"})
		return
	}

	var system models.IrrigationSystem
	if err := c.ShouldBindJSON(&system); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	system.ParcelID = uint(parcelID)

	irrigationService := services.NewIrrigationService()
	if err := irrigationService.DB.Save(&system).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, system)
}
