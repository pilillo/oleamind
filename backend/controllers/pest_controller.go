package controllers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/services"
)

// GetPestRisk calculates and returns current pest/disease risk for a parcel
func GetPestRisk(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	service := services.NewPestControlService()
	assessments, err := service.CalculateRiskForParcel(uint(parcelID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, assessments)
}

// GetPestRiskHistory retrieves historical risk assessments
func GetPestRiskHistory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Optional query parameters
	pestType := models.PestType(c.DefaultQuery("pest_type", ""))
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 || days > 365 {
		days = 30
	}

	service := services.NewPestControlService()
	history, err := service.GetRiskHistory(uint(parcelID), pestType, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

// LogTreatment records a pest control treatment
func LogTreatment(c *gin.Context) {
	var treatment models.TreatmentLog
	if err := c.ShouldBindJSON(&treatment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewPestControlService()
	if err := service.LogTreatment(&treatment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, treatment)
}

// GetTreatmentHistory retrieves treatment logs
func GetTreatmentHistory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Date range parameters
	startDateStr := c.DefaultQuery("start_date", time.Now().AddDate(0, -3, 0).Format("2006-01-02"))
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

	service := services.NewPestControlService()
	treatments, err := service.GetTreatmentHistory(uint(parcelID), startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, treatments)
}

// LogMonitoring records a manual pest monitoring observation
func LogMonitoring(c *gin.Context) {
	var monitoring models.PestMonitoring
	if err := c.ShouldBindJSON(&monitoring); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewPestControlService()
	if err := service.LogMonitoring(&monitoring); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, monitoring)
}

// GetMonitoringHistory retrieves monitoring logs
func GetMonitoringHistory(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Optional query parameters
	pestType := models.PestType(c.DefaultQuery("pest_type", ""))
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 || days > 365 {
		days = 30
	}

	service := services.NewPestControlService()
	monitoring, err := service.GetMonitoringHistory(uint(parcelID), pestType, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, monitoring)
}

