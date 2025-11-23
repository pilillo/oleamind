package controllers

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/services"
)

// ===== Mill Management =====

func CreateMill(c *gin.Context) {
	var mill models.Mill
	if err := c.ShouldBindJSON(&mill); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.CreateMill(&mill); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, mill)
}

func GetMills(c *gin.Context) {
	activeOnly := c.DefaultQuery("active_only", "false") == "true"

	service := services.NewMillService()
	mills, err := service.GetMills(activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, mills)
}

func GetMill(c *gin.Context) {
	millIDStr := c.Param("id")
	millID, err := strconv.ParseUint(millIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mill ID"})
		return
	}

	service := services.NewMillService()
	mill, err := service.GetMill(uint(millID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Mill not found"})
		return
	}

	c.JSON(http.StatusOK, mill)
}

func UpdateMill(c *gin.Context) {
	millIDStr := c.Param("id")
	millID, err := strconv.ParseUint(millIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mill ID"})
		return
	}

	var updates models.Mill
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.UpdateMill(uint(millID), &updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mill updated successfully"})
}

func DeleteMill(c *gin.Context) {
	millIDStr := c.Param("id")
	millID, err := strconv.ParseUint(millIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mill ID"})
		return
	}

	service := services.NewMillService()
	if err := service.DeleteMill(uint(millID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mill deleted successfully"})
}

// ===== Delivery Management =====

func CreateDelivery(c *gin.Context) {
	var delivery models.OliveDelivery
	if err := c.ShouldBindJSON(&delivery); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.CreateDelivery(&delivery); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, delivery)
}

func GetDeliveries(c *gin.Context) {
	var millID, parcelID *uint

	if millIDStr := c.Query("mill_id"); millIDStr != "" {
		id, err := strconv.ParseUint(millIDStr, 10, 32)
		if err == nil {
			mid := uint(id)
			millID = &mid
		}
	}

	if parcelIDStr := c.Query("parcel_id"); parcelIDStr != "" {
		id, err := strconv.ParseUint(parcelIDStr, 10, 32)
		if err == nil {
			pid := uint(id)
			parcelID = &pid
		}
	}

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

	service := services.NewMillService()
	deliveries, err := service.GetDeliveries(millID, parcelID, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deliveries)
}

func UpdateDelivery(c *gin.Context) {
	deliveryIDStr := c.Param("id")
	deliveryID, err := strconv.ParseUint(deliveryIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid delivery ID"})
		return
	}

	var updates models.OliveDelivery
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.UpdateDelivery(uint(deliveryID), &updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Delivery updated successfully"})
}

func DeleteDelivery(c *gin.Context) {
	deliveryIDStr := c.Param("id")
	deliveryID, err := strconv.ParseUint(deliveryIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid delivery ID"})
		return
	}

	service := services.NewMillService()
	if err := service.DeleteDelivery(uint(deliveryID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Delivery deleted successfully"})
}

// ===== Oil Batch Management =====

func CreateOilBatch(c *gin.Context) {
	var payload struct {
		Batch             models.OilBatch `json:"batch"`
		SourceDeliveryIDs []uint          `json:"source_delivery_ids"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		slog.Warn("CreateOilBatch validation error", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slog.Info("CreateOilBatch request",
		"mill_id", payload.Batch.MillID,
		"batch_number", payload.Batch.BatchNumber,
		"production_date", payload.Batch.ProductionDate,
		"quantity_liters", payload.Batch.QuantityLiters,
	)

	// Validate required fields
	if payload.Batch.MillID == 0 {
		slog.Warn("CreateOilBatch: mill_id is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "mill_id is required"})
		return
	}
	if payload.Batch.BatchNumber == "" {
		slog.Warn("CreateOilBatch: batch_number is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "batch_number is required"})
		return
	}
	if payload.Batch.QuantityLiters <= 0 {
		slog.Warn("CreateOilBatch: quantity_liters must be greater than 0")
		c.JSON(http.StatusBadRequest, gin.H{"error": "quantity_liters must be greater than 0"})
		return
	}

	service := services.NewMillService()
	if err := service.CreateOilBatch(&payload.Batch, payload.SourceDeliveryIDs); err != nil {
		slog.Error("Failed to create oil batch", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, payload.Batch)
}

func GetOilBatches(c *gin.Context) {
	var millID *uint
	if millIDStr := c.Query("mill_id"); millIDStr != "" {
		id, err := strconv.ParseUint(millIDStr, 10, 32)
		if err == nil {
			mid := uint(id)
			millID = &mid
		}
	}

	status := c.Query("status")

	service := services.NewMillService()
	batches, err := service.GetOilBatches(millID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, batches)
}

func GetOilBatch(c *gin.Context) {
	batchIDStr := c.Param("id")
	batchID, err := strconv.ParseUint(batchIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid batch ID"})
		return
	}

	service := services.NewMillService()
	batch, err := service.GetOilBatch(uint(batchID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	c.JSON(http.StatusOK, batch)
}

func UpdateOilBatch(c *gin.Context) {
	batchIDStr := c.Param("id")
	batchID, err := strconv.ParseUint(batchIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid batch ID"})
		return
	}

	var updates models.OilBatch
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.UpdateOilBatch(uint(batchID), &updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Batch updated successfully"})
}

// ===== Traceability =====

func GetBatchTraceability(c *gin.Context) {
	batchIDStr := c.Param("batch_id")
	batchID, err := strconv.ParseUint(batchIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid batch ID"})
		return
	}

	service := services.NewMillService()
	traceability, err := service.GetBatchTraceability(uint(batchID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, traceability)
}

// ===== Quality Analysis =====

func CreateQualityAnalysis(c *gin.Context) {
	var analysis models.OilQualityAnalysis
	if err := c.ShouldBindJSON(&analysis); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.CreateQualityAnalysis(&analysis); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, analysis)
}

func GetQualityAnalyses(c *gin.Context) {
	batchIDStr := c.Param("batch_id")
	batchID, err := strconv.ParseUint(batchIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid batch ID"})
		return
	}

	service := services.NewMillService()
	analyses, err := service.GetQualityAnalyses(uint(batchID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, analyses)
}

// ===== Bottling =====

func CreateBottling(c *gin.Context) {
	var bottling models.OilBottling
	if err := c.ShouldBindJSON(&bottling); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.CreateBottling(&bottling); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, bottling)
}

func GetBottlings(c *gin.Context) {
	batchIDStr := c.DefaultQuery("batch_id", "0")
	batchID, _ := strconv.ParseUint(batchIDStr, 10, 32)

	service := services.NewMillService()
	bottlings, err := service.GetBottlings(uint(batchID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, bottlings)
}

// ===== Sales =====

func CreateSale(c *gin.Context) {
	var sale models.OilSale
	if err := c.ShouldBindJSON(&sale); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.CreateSale(&sale); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, sale)
}

func GetSales(c *gin.Context) {
	var batchID *uint
	if batchIDStr := c.Query("batch_id"); batchIDStr != "" {
		id, err := strconv.ParseUint(batchIDStr, 10, 32)
		if err == nil {
			bid := uint(id)
			batchID = &bid
		}
	}

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

	service := services.NewMillService()
	sales, err := service.GetSales(startDate, endDate, batchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, sales)
}

func UpdateSale(c *gin.Context) {
	saleIDStr := c.Param("id")
	saleID, err := strconv.ParseUint(saleIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sale ID"})
		return
	}

	var updates models.OilSale
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.NewMillService()
	if err := service.UpdateSale(uint(saleID), &updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sale updated successfully"})
}

// ===== Statistics =====

func GetProductionStats(c *gin.Context) {
	millIDStr := c.DefaultQuery("mill_id", "0")
	millID, _ := strconv.ParseUint(millIDStr, 10, 32)

	yearStr := c.DefaultQuery("year", strconv.Itoa(time.Now().Year()))
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year"})
		return
	}

	service := services.NewMillService()
	stats, err := service.GetProductionStats(uint(millID), year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
