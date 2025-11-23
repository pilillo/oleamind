package controllers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/services"
)

// GetYieldTrends returns multi-year yield trends for a parcel
func GetYieldTrends(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	// Get number of years (default to 5)
	yearsStr := c.DefaultQuery("years", "5")
	years, err := strconv.Atoi(yearsStr)
	if err != nil || years < 1 || years > 20 {
		years = 5
	}

	analyticsService := services.NewAnalyticsService()
	trends, err := analyticsService.GetYieldTrends(uint(parcelID), years)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trends)
}

// GetCostEfficiency returns cost per liter efficiency metrics
func GetCostEfficiency(c *gin.Context) {
	// Parse date range (default to current year)
	now := time.Now()
	startDateStr := c.DefaultQuery("start_date", time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02"))
	endDateStr := c.DefaultQuery("end_date", now.Format("2006-01-02"))

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

	analyticsService := services.NewAnalyticsService()
	efficiency, err := analyticsService.GetCostEfficiency(startDate, endDate, parcelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, efficiency)
}

// GetParcelComparison returns comparison metrics for selected parcels
func GetParcelComparison(c *gin.Context) {
	// Parse parcel IDs
	parcelIDsStr := c.Query("parcel_ids")
	if parcelIDsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parcel_ids parameter required"})
		return
	}

	// Split and parse parcel IDs
	parcelIDStrs := strings.Split(parcelIDsStr, ",")
	var parcelIDs []uint
	for _, idStr := range parcelIDStrs {
		id, err := strconv.ParseUint(strings.TrimSpace(idStr), 10, 32)
		if err == nil {
			parcelIDs = append(parcelIDs, uint(id))
		}
	}

	if len(parcelIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid parcel IDs provided"})
		return
	}

	// Parse year (default to current year)
	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year format"})
		return
	}

	analyticsService := services.NewAnalyticsService()
	comparison, err := analyticsService.GetParcelComparison(parcelIDs, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, comparison)
}

// ExportParcelReportPDF generates and returns a PDF report for a parcel
func ExportParcelReportPDF(c *gin.Context) {
	parcelIDStr := c.Param("parcel_id")
	parcelID, err := strconv.ParseUint(parcelIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parcel ID"})
		return
	}

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year format"})
		return
	}

	pdfService := services.NewPDFService()
	pdf, err := pdfService.GenerateParcelReport(uint(parcelID), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set headers for PDF download
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=parcel_%d_report_%d.pdf", parcelID, year))

	// Output PDF to response
	err = pdf.Output(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}
}

// ExportComparisonReportPDF generates and returns a comparison PDF report
func ExportComparisonReportPDF(c *gin.Context) {
	parcelIDsStr := c.Query("parcel_ids")
	if parcelIDsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parcel_ids parameter required"})
		return
	}

	parcelIDStrs := strings.Split(parcelIDsStr, ",")
	var parcelIDs []uint
	for _, idStr := range parcelIDStrs {
		id, err := strconv.ParseUint(strings.TrimSpace(idStr), 10, 32)
		if err == nil {
			parcelIDs = append(parcelIDs, uint(id))
		}
	}

	if len(parcelIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid parcel IDs provided"})
		return
	}

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year format"})
		return
	}

	pdfService := services.NewPDFService()
	pdf, err := pdfService.GenerateComparisonReport(parcelIDs, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=parcel_comparison_%d.pdf", year))

	err = pdf.Output(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}
}
