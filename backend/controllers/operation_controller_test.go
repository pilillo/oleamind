package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupOperationTestDB(t *testing.T) {
	if os.Getenv("DB_HOST") == "" {
		os.Setenv("DB_HOST", "localhost")
		os.Setenv("DB_USER", "user")
		os.Setenv("DB_PASSWORD", "password")
		os.Setenv("DB_NAME", "oleamind")
		os.Setenv("DB_PORT", "5432")
	}

	defer func() {
		if r := recover(); r != nil {
			t.Skip("Skipping tests: Database not available. Run docker-compose up -d db to enable database tests.")
		}
	}()

	initializers.ConnectToDB()
	initializers.DB.Exec("CREATE EXTENSION IF NOT EXISTS postgis")
	initializers.DB.Exec("DROP TABLE IF EXISTS operation_logs CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcel_varieties CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcels CASCADE")
	initializers.DB.AutoMigrate(&models.Parcel{}, &models.ParcelVariety{}, &models.OperationLog{})
}

func TestCreateOperation(t *testing.T) {
	setupOperationTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create a test parcel first
	parcel := models.Parcel{
		Name:   "Test Parcel",
		FarmID: 1,
	}
	initializers.DB.Create(&parcel)

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.POST("/operations", CreateOperation)

	t.Run("Create valid operation", func(t *testing.T) {
		operation := models.OperationLog{
			Type:        "pruning",
			Category:    "maintenance",
			Date:        models.DateOnly{Time: time.Now()},
			Description: "Winter pruning",
			ParcelID:    parcel.ID,
			LaborHours:  8.5,
			Workers:     2,
			Cost:        150.00,
			Status:      "completed",
		}

		jsonData, _ := json.Marshal(operation)
		req, _ := http.NewRequest("POST", "/operations", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "pruning", response.Type)
		assert.Equal(t, "maintenance", response.Category)
		assert.Equal(t, 8.5, response.LaborHours)
		assert.Equal(t, parcel.ID, response.ParcelID)
	})

	t.Run("Create phytosanitary operation", func(t *testing.T) {
		operation := models.OperationLog{
			Type:        "pest_control",
			Category:    "phytosanitary",
			Date:        models.DateOnly{Time: time.Now()},
			Description: "Olive fly treatment",
			ParcelID:    parcel.ID,
			ProductName: "Organic Spray X",
			ActiveAgent: "Spinosad",
			Quantity:    2.5,
			Unit:        "L",
			Status:      "completed",
		}

		jsonData, _ := json.Marshal(operation)
		req, _ := http.NewRequest("POST", "/operations", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "pest_control", response.Type)
		assert.Equal(t, "phytosanitary", response.Category)
		assert.Equal(t, "Organic Spray X", response.ProductName)
		assert.Equal(t, "Spinosad", response.ActiveAgent)
		assert.Equal(t, 2.5, response.Quantity)
	})

	t.Run("Create operation with missing required fields", func(t *testing.T) {
		operation := map[string]interface{}{
			"description": "Test operation",
			// Missing type, date, parcel_id
		}

		jsonData, _ := json.Marshal(operation)
		req, _ := http.NewRequest("POST", "/operations", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestGetOperations(t *testing.T) {
	setupOperationTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create test parcel and operations
	parcel := models.Parcel{Name: "Test Parcel", FarmID: 1}
	initializers.DB.Create(&parcel)

	op1 := models.OperationLog{
		Type:     "pruning",
		Category: "maintenance",
		Date:     models.DateOnly{Time: time.Now()},
		ParcelID: parcel.ID,
		Status:   "completed",
		FarmID:   1,
	}
	op2 := models.OperationLog{
		Type:     "fertilization",
		Category: "fertilization",
		Date:     models.DateOnly{Time: time.Now().AddDate(0, 0, -1)},
		ParcelID: parcel.ID,
		Status:   "completed",
		FarmID:   1,
	}
	initializers.DB.Create(&op1)
	initializers.DB.Create(&op2)

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.GET("/operations", GetOperations)

	t.Run("Get all operations", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/operations", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var operations []models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &operations)
		assert.GreaterOrEqual(t, len(operations), 2)
	})

	t.Run("Filter operations by type", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/operations?type=pruning", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var operations []models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &operations)

		for _, op := range operations {
			assert.Equal(t, "pruning", op.Type)
		}
	})

	t.Run("Filter operations by parcel", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/operations?parcel_id=%d", parcel.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var operations []models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &operations)
		assert.GreaterOrEqual(t, len(operations), 2)
	})
}

func TestUpdateOperation(t *testing.T) {
	setupOperationTestDB(t)
	gin.SetMode(gin.TestMode)

	parcel := models.Parcel{Name: "Test Parcel", FarmID: 1}
	initializers.DB.Create(&parcel)

	operation := models.OperationLog{
		Type:     "pruning",
		Category: "maintenance",
		Date:     models.DateOnly{Time: time.Now()},
		ParcelID: parcel.ID,
		Status:   "planned",
		FarmID:   1,
	}
	initializers.DB.Create(&operation)

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.PUT("/operations/:id", UpdateOperation)

	t.Run("Update operation status", func(t *testing.T) {
		updates := map[string]interface{}{
			"type":      "pruning",
			"category":  "maintenance",
			"date":      time.Now(),
			"parcel_id": parcel.ID,
			"status":    "completed",
			"cost":      200.50,
		}

		jsonData, _ := json.Marshal(updates)
		req, _ := http.NewRequest("PUT", fmt.Sprintf("/operations/%d", operation.ID), bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "completed", response.Status)
		assert.Equal(t, 200.50, response.Cost)
	})
}

func TestDeleteOperation(t *testing.T) {
	setupOperationTestDB(t)
	gin.SetMode(gin.TestMode)

	parcel := models.Parcel{Name: "Test Parcel", FarmID: 1}
	initializers.DB.Create(&parcel)

	operation := models.OperationLog{
		Type:     "irrigation",
		Category: "maintenance",
		Date:     models.DateOnly{Time: time.Now()},
		ParcelID: parcel.ID,
		FarmID:   1,
	}
	initializers.DB.Create(&operation)

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.DELETE("/operations/:id", DeleteOperation)

	t.Run("Delete operation", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", fmt.Sprintf("/operations/%d", operation.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// Verify deletion
		var count int64
		initializers.DB.Model(&models.OperationLog{}).Where("id = ?", operation.ID).Count(&count)
		assert.Equal(t, int64(0), count)
	})
}

func TestGetPhytosanitaryRegister(t *testing.T) {
	setupOperationTestDB(t)
	gin.SetMode(gin.TestMode)

	parcel := models.Parcel{Name: "Test Parcel", FarmID: 1}
	initializers.DB.Create(&parcel)

	// Create various operations
	ops := []models.OperationLog{
		{Type: "pest_control", Category: "phytosanitary", Date: models.DateOnly{Time: time.Now()}, ParcelID: parcel.ID, ProductName: "Spray A", FarmID: 1},
		{Type: "fertilization", Category: "fertilization", Date: models.DateOnly{Time: time.Now()}, ParcelID: parcel.ID, ProductName: "Fertilizer B", FarmID: 1},
		{Type: "pruning", Category: "maintenance", Date: models.DateOnly{Time: time.Now()}, ParcelID: parcel.ID, FarmID: 1},
	}

	for _, op := range ops {
		initializers.DB.Create(&op)
	}

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.GET("/operations/phytosanitary", GetPhytosanitaryRegister)

	t.Run("Get phytosanitary register", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/operations/phytosanitary", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var operations []models.OperationLog
		json.Unmarshal(w.Body.Bytes(), &operations)

		// Should only include phytosanitary and fertilization, not maintenance
		assert.GreaterOrEqual(t, len(operations), 2)

		for _, op := range operations {
			assert.Contains(t, []string{"phytosanitary", "fertilization"}, op.Category)
		}
	})
}
