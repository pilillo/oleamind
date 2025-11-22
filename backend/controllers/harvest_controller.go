package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/services"
)

// LogHarvest records a harvest event
func LogHarvest(c *gin.Context) {
	var harvest models.HarvestLog
	if err := c.ShouldBindJSON(&harvest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewHarvestService()
	if err := service.LogHarvest(&harvest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, harvest)
}

// GetHarvestHistory retrieves harvest logs for a parcel
func GetHarvestHistory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Date range parameters
	startDateStr := c.DefaultQuery("start_date", time.Now().AddDate(-1, 0, 0).Format("2006-01-02"))
	endDateStr := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
		return
	}

	service := services.NewHarvestService()
	harvests, err := service.GetHarvestHistory(uint(parcelID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, harvests)
}

// GetAllHarvests retrieves all harvest logs with optional filters
func GetAllHarvests(c *gin.Context) {
	// Date range parameters
	startDateStr := c.DefaultQuery("start_date", time.Now().AddDate(-1, 0, 0).Format("2006-01-02"))
	endDateStr := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
		return
	}

	// Optional parcel filter
	var parcelID *uint
	if parcelIDStr := c.Query("parcel_id"); parcelIDStr != "" {
		id, err := strconv.ParseUint(parcelIDStr, 10, 32)
		if err == nil {
			pid := uint(id)
			parcelID = &pid
		}
	}

	service := services.NewHarvestService()
	harvests, err := service.GetAllHarvests(startDate, endDate, parcelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, harvests)
}

// UpdateHarvest updates a harvest log
func UpdateHarvest(c *gin.Context) {
	harvestIDStr := c.Param("id")
	harvestID, err := strconv.ParseUint(harvestIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid harvest ID"})
		return
	}

	var updates models.HarvestLog
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewHarvestService()
	if err := service.UpdateHarvest(uint(harvestID), &updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Harvest updated successfully"})
}

// DeleteHarvest removes a harvest log
func DeleteHarvest(c *gin.Context) {
	harvestIDStr := c.Param("id")
	harvestID, err := strconv.ParseUint(harvestIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid harvest ID"})
		return
	}

	service := services.NewHarvestService()
	if err := service.DeleteHarvest(uint(harvestID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Harvest deleted successfully"})
}

// GetYieldStats retrieves yield statistics for a parcel and year
func GetYieldStats(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year"})
		return
	}

	service := services.NewHarvestService()
	stats, err := service.GetYieldStats(uint(parcelID), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetCostSummary retrieves cost summary for a parcel
func GetCostSummary(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Date range parameters
	startDateStr := c.DefaultQuery("start_date", time.Now().AddDate(-1, 0, 0).Format("2006-01-02"))
	endDateStr := c.DefaultQuery("end_date", time.Now().Format("2006-01-02"))

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
		return
	}

	service := services.NewHarvestService()
	summary, err := service.GetCostSummary(uint(parcelID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// CreateYieldPrediction creates a yield prediction
func CreateYieldPrediction(c *gin.Context) {
	var prediction models.YieldPrediction
	if err := c.ShouldBindJSON(&prediction); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewHarvestService()
	if err := service.CreateYieldPrediction(&prediction); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, prediction)
}

// GetYieldPredictions retrieves yield predictions for a parcel
func GetYieldPredictions(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	var year *int
	if yearStr := c.Query("year"); yearStr != "" {
		y, err := strconv.Atoi(yearStr)
		if err == nil {
			year = &y
		}
	}

	service := services.NewHarvestService()
	predictions, err := service.GetYieldPredictions(uint(parcelID), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, predictions)
}

// PredictYield generates a yield prediction based on historical data
func PredictYield(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()+1))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year"})
		return
	}

	yearsBackStr := c.DefaultQuery("years_back", "5")
	yearsBack, err := strconv.Atoi(yearsBackStr)
	if err != nil || yearsBack < 1 || yearsBack > 20 {
		yearsBack = 5
	}

	service := services.NewHarvestService()
	prediction, err := service.PredictYieldFromHistory(uint(parcelID), year, yearsBack)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Save the prediction
	if err := service.CreateYieldPrediction(prediction); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prediction)
}

