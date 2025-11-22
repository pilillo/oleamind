package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

func CreateOperation(c *gin.Context) {
	var operation models.OperationLog
	if err := c.BindJSON(&operation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure FarmID is set
	if operation.FarmID == 0 {
		operation.FarmID = 1 // Default farm for MVP
	}

	if result := initializers.DB.Create(&operation); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Reload with parcel data
	initializers.DB.Preload("Parcel").First(&operation, operation.ID)
	c.JSON(http.StatusOK, operation)
}

func GetOperations(c *gin.Context) {
	var operations []models.OperationLog
	
	query := initializers.DB.Preload("Parcel", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, name, area, trees_count, farm_id, created_at, updated_at")
	}).Order("date DESC")
	
	// Optional filters
	if parcelID := c.Query("parcel_id"); parcelID != "" {
		query = query.Where("parcel_id = ?", parcelID)
	}
	
	if opType := c.Query("type"); opType != "" {
		query = query.Where("type = ?", opType)
	}
	
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	
	if result := query.Find(&operations); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, operations)
}

func GetOperation(c *gin.Context) {
	id := c.Param("id")
	var operation models.OperationLog

	if err := initializers.DB.Preload("Parcel").First(&operation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Operation not found"})
		return
	}

	c.JSON(http.StatusOK, operation)
}

func UpdateOperation(c *gin.Context) {
	id := c.Param("id")
	var operation models.OperationLog

	if err := initializers.DB.First(&operation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Operation not found"})
		return
	}

	var input models.OperationLog
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	updates := map[string]interface{}{
		"type":         input.Type,
		"category":     input.Category,
		"date":         input.Date,
		"description":  input.Description,
		"parcel_id":    input.ParcelID,
		"product_name": input.ProductName,
		"active_agent": input.ActiveAgent,
		"quantity":     input.Quantity,
		"unit":         input.Unit,
		"labor_hours":  input.LaborHours,
		"workers":      input.Workers,
		"equipment":    input.Equipment,
		"cost":         input.Cost,
		"status":       input.Status,
		"notes":        input.Notes,
	}

	if err := initializers.DB.Model(&operation).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload with parcel data
	initializers.DB.Preload("Parcel").First(&operation, id)
	c.JSON(http.StatusOK, operation)
}

func DeleteOperation(c *gin.Context) {
	id := c.Param("id")
	var operation models.OperationLog

	if err := initializers.DB.First(&operation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Operation not found"})
		return
	}

	initializers.DB.Delete(&operation)
	c.JSON(http.StatusOK, gin.H{"message": "Operation deleted successfully"})
}

// GetOperationsByParcel returns all operations for a specific parcel
func GetOperationsByParcel(c *gin.Context) {
	parcelID := c.Param("parcel_id")
	var operations []models.OperationLog

	if result := initializers.DB.Where("parcel_id = ?", parcelID).Order("date DESC").Find(&operations); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, operations)
}

// GetPhytosanitaryRegister returns filtered operations for compliance (pest_control, fertilization)
func GetPhytosanitaryRegister(c *gin.Context) {
	var operations []models.OperationLog

	query := initializers.DB.Preload("Parcel", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, name, area, trees_count, farm_id, created_at, updated_at")
	}).Where("category IN ?", []string{"phytosanitary", "fertilization"}).
		Order("date DESC")

	// Optional date range filter
	if startDate := c.Query("start_date"); startDate != "" {
		query = query.Where("date >= ?", startDate)
	}
	if endDate := c.Query("end_date"); endDate != "" {
		query = query.Where("date <= ?", endDate)
	}

	if result := query.Find(&operations); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, operations)
}

