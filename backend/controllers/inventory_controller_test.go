package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/stretchr/testify/assert"
)

func setupTestDB(t *testing.T) {
	// Set test database environment variables if not already set
	if os.Getenv("DB_HOST") == "" {
		os.Setenv("DB_HOST", "localhost")
		os.Setenv("DB_USER", "user")
		os.Setenv("DB_PASSWORD", "password")
		os.Setenv("DB_NAME", "oleamind")
		os.Setenv("DB_PORT", "5432")
	}

	// Try to connect to database
	defer func() {
		if r := recover(); r != nil {
			t.Skip("Skipping tests: Database not available. Run docker-compose up -d db to enable database tests.")
		}
	}()

	initializers.ConnectToDB()
	initializers.DB.Exec("DROP TABLE IF EXISTS inventory_items CASCADE")
	initializers.DB.AutoMigrate(&models.InventoryItem{})
}

func TestCreateInventoryItem(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	router := gin.Default()
	router.POST("/inventory", CreateInventoryItem)

	t.Run("Create valid inventory item", func(t *testing.T) {
		item := models.InventoryItem{
			Name:         "Organic Fertilizer",
			Category:     "fertilizers",
			Quantity:     100.5,
			Unit:         "kg",
			MinimumStock: 20.0,
			CostPerUnit:  5.50,
			Supplier:     "EcoFarm Ltd",
		}

		jsonData, _ := json.Marshal(item)
		req, _ := http.NewRequest("POST", "/inventory", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		
		var response models.InventoryItem
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "Organic Fertilizer", response.Name)
		assert.Equal(t, "fertilizers", response.Category)
		assert.Equal(t, 100.5, response.Quantity)
	})

	t.Run("Create item with missing required fields", func(t *testing.T) {
		item := map[string]interface{}{
			"name": "Test Item",
			// missing category, quantity, unit
		}

		jsonData, _ := json.Marshal(item)
		req, _ := http.NewRequest("POST", "/inventory", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Create item with negative quantity", func(t *testing.T) {
		item := models.InventoryItem{
			Name:     "Test Item",
			Category: "fertilizers",
			Quantity: -10,
			Unit:     "kg",
		}

		jsonData, _ := json.Marshal(item)
		req, _ := http.NewRequest("POST", "/inventory", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestGetInventory(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create test items
	initializers.DB.Create(&models.InventoryItem{
		Name:     "Item 1",
		Category: "fertilizers",
		Quantity: 50,
		Unit:     "kg",
		FarmID:   1,
	})
	initializers.DB.Create(&models.InventoryItem{
		Name:     "Item 2",
		Category: "pesticides",
		Quantity: 10,
		Unit:     "L",
		FarmID:   1,
	})

	router := gin.Default()
	router.GET("/inventory", GetInventory)

	req, _ := http.NewRequest("GET", "/inventory", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	
	var items []models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &items)
	assert.Equal(t, 2, len(items))
}

func TestUpdateInventoryItem(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create test item
	item := models.InventoryItem{
		Name:         "Test Item",
		Category:     "fertilizers",
		Quantity:     50,
		Unit:         "kg",
		MinimumStock: 10,
		FarmID:       1,
	}
	initializers.DB.Create(&item)

	router := gin.Default()
	router.PUT("/inventory/:id", UpdateInventoryItem)

	t.Run("Update existing item", func(t *testing.T) {
		updates := map[string]interface{}{
			"name":     "Updated Item",
			"quantity": 75.5,
			"category": "fertilizers",
			"unit":     "kg",
		}

		jsonData, _ := json.Marshal(updates)
		req, _ := http.NewRequest("PUT", fmt.Sprintf("/inventory/%d", item.ID), bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		
		var response models.InventoryItem
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "Updated Item", response.Name)
		assert.Equal(t, 75.5, response.Quantity)
	})

	t.Run("Update non-existent item", func(t *testing.T) {
		updates := map[string]interface{}{
			"name": "Doesn't exist",
		}

		jsonData, _ := json.Marshal(updates)
		req, _ := http.NewRequest("PUT", "/inventory/99999", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestDeleteInventoryItem(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create test item
	item := models.InventoryItem{
		Name:     "Item to Delete",
		Category: "tools",
		Quantity: 5,
		Unit:     "units",
		FarmID:   1,
	}
	initializers.DB.Create(&item)

	router := gin.Default()
	router.DELETE("/inventory/:id", DeleteInventoryItem)

	t.Run("Delete existing item", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", fmt.Sprintf("/inventory/%d", item.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// Verify deletion
		var count int64
		initializers.DB.Model(&models.InventoryItem{}).Where("id = ?", item.ID).Count(&count)
		assert.Equal(t, int64(0), count)
	})
}

func TestGetLowStock(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create items with varying stock levels
	initializers.DB.Create(&models.InventoryItem{
		Name:         "Low Stock Item",
		Category:     "fertilizers",
		Quantity:     5,
		Unit:         "kg",
		MinimumStock: 20,
		FarmID:       1,
	})
	initializers.DB.Create(&models.InventoryItem{
		Name:         "Good Stock Item",
		Category:     "pesticides",
		Quantity:     50,
		Unit:         "L",
		MinimumStock: 10,
		FarmID:       1,
	})
	initializers.DB.Create(&models.InventoryItem{
		Name:         "Critical Stock Item",
		Category:     "irrigation",
		Quantity:     2,
		Unit:         "units",
		MinimumStock: 15,
		FarmID:       1,
	})

	router := gin.Default()
	router.GET("/inventory/low-stock", GetLowStock)

	req, _ := http.NewRequest("GET", "/inventory/low-stock", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	
	var items []models.InventoryItem
	json.Unmarshal(w.Body.Bytes(), &items)
	
	// Should return 2 items (Low Stock and Critical Stock)
	assert.Equal(t, 2, len(items))
	
	// Verify they're sorted by quantity ASC (Critical first)
	assert.Equal(t, "Critical Stock Item", items[0].Name)
	assert.Equal(t, "Low Stock Item", items[1].Name)
}

