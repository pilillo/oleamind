package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/utils"
)

func CreateInventoryItem(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)
	
	var item models.InventoryItem
	if err := c.BindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// FarmID is required
	if item.FarmID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "FarmID is required"})
		return
	}

	// Verify user has access to this farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == item.FarmID {
			hasAccess = true
			break
		}
	}
	
	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this farm"})
		return
	}

	if result := initializers.DB.Create(&item); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func GetInventory(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)
	
	// Get user's accessible farms
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	
	if len(accessibleFarms) == 0 {
		c.JSON(http.StatusOK, []models.InventoryItem{}) // Empty array
		return
	}
	
	var items []models.InventoryItem
	initializers.DB.Where("farm_id IN ?", accessibleFarms).Order("created_at DESC").Find(&items)
	c.JSON(http.StatusOK, items)
}

func UpdateInventoryItem(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)
	
	id := c.Param("id")
	var item models.InventoryItem

	if err := initializers.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	// Verify user has access to this item's farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == item.FarmID {
			hasAccess = true
			break
		}
	}
	
	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this item"})
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
	user, _ := c.Get("user")
	u := user.(models.User)
	
	id := c.Param("id")
	var item models.InventoryItem

	if err := initializers.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	// Verify user has access to this item's farm
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	hasAccess := false
	for _, fid := range accessibleFarms {
		if fid == item.FarmID {
			hasAccess = true
			break
		}
	}
	
	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this item"})
		return
	}

	initializers.DB.Delete(&item)
	c.JSON(http.StatusOK, gin.H{"message": "Item deleted successfully"})
}

func GetLowStock(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)
	
	// Get user's accessible farms
	accessibleFarms := utils.GetUserAccessibleFarms(u.ID)
	
	if len(accessibleFarms) == 0 {
		c.JSON(http.StatusOK, []models.InventoryItem{}) // Empty array
		return
	}
	
	var items []models.InventoryItem
	// Find items where quantity is less than minimum_stock, filtered by accessible farms
	initializers.DB.Where("quantity < minimum_stock AND farm_id IN ?", accessibleFarms).
		Order("quantity ASC").Find(&items)
	c.JSON(http.StatusOK, items)
}

