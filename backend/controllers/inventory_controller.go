package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

func CreateInventoryItem(c *gin.Context) {
	var item models.InventoryItem
	if err := c.BindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Hardcoded FarmID for MVP
	if item.FarmID == 0 {
		item.FarmID = 1
	}

	if result := initializers.DB.Create(&item); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func GetInventory(c *gin.Context) {
	var items []models.InventoryItem
	initializers.DB.Order("created_at DESC").Find(&items)
	c.JSON(http.StatusOK, items)
}

func UpdateInventoryItem(c *gin.Context) {
	id := c.Param("id")
	var item models.InventoryItem

	if err := initializers.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	var input models.InventoryItem
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	updates := map[string]interface{}{
		"name":          input.Name,
		"category":      input.Category,
		"quantity":      input.Quantity,
		"unit":          input.Unit,
		"minimum_stock": input.MinimumStock,
		"cost_per_unit": input.CostPerUnit,
		"supplier":      input.Supplier,
		"expiry_date":   input.ExpiryDate,
	}

	if err := initializers.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload to get updated data
	initializers.DB.First(&item, id)
	c.JSON(http.StatusOK, item)
}

func DeleteInventoryItem(c *gin.Context) {
	id := c.Param("id")
	var item models.InventoryItem

	if err := initializers.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	initializers.DB.Delete(&item)
	c.JSON(http.StatusOK, gin.H{"message": "Item deleted successfully"})
}

func GetLowStock(c *gin.Context) {
	var items []models.InventoryItem
	// Find items where quantity is less than minimum_stock
	initializers.DB.Where("quantity < minimum_stock").Order("quantity ASC").Find(&items)
	c.JSON(http.StatusOK, items)
}

