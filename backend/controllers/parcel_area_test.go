package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupParcelTestDB(t *testing.T) {
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
	initializers.DB.Exec("CREATE EXTENSION IF NOT EXISTS postgis")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcel_varieties CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcels CASCADE")
	initializers.DB.AutoMigrate(&models.Parcel{}, &models.ParcelVariety{})
}

func TestParcelAreaCalculation(t *testing.T) {
	setupParcelTestDB(t)
	gin.SetMode(gin.TestMode)

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Set("user", models.User{Model: gorm.Model{ID: 1}, FirstName: "Test", LastName: "User"})
		c.Next()
	})
	router.POST("/parcels", CreateParcel)

	t.Run("Calculate area from polygon geometry", func(t *testing.T) {
		// Create a small square polygon (approximately 100m x 100m = 1 hectare)
		// Coordinates around Rome, Italy (41.9, 12.5)
		parcelData := map[string]interface{}{
			"name":    "Test Parcel with Auto-Area",
			"farm_id": 1,
			"geojson": map[string]interface{}{
				"type": "Polygon",
				"coordinates": []interface{}{
					[]interface{}{
						[]float64{12.5, 41.9},     // Southwest corner
						[]float64{12.501, 41.9},   // Southeast corner
						[]float64{12.501, 41.901}, // Northeast corner
						[]float64{12.5, 41.901},   // Northwest corner
						[]float64{12.5, 41.9},     // Close the polygon
					},
				},
			},
		}

		jsonData, _ := json.Marshal(parcelData)
		req, _ := http.NewRequest("POST", "/parcels", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response models.Parcel
		json.Unmarshal(w.Body.Bytes(), &response)

		// Verify parcel was created
		assert.Equal(t, "Test Parcel with Auto-Area", response.Name)
		assert.Greater(t, response.ID, uint(0))

		// Verify area was automatically calculated
		// The polygon above is roughly 1 hectare
		assert.Greater(t, response.Area, 0.0, "Area should be calculated automatically")
		assert.InDelta(t, 1.0, response.Area, 0.5, "Area should be approximately 1 hectare")

		t.Logf("Created parcel with auto-calculated area: %.4f ha", response.Area)
	})

	t.Run("Create larger parcel with known area", func(t *testing.T) {
		// Create a larger rectangular polygon (approximately 200m x 500m = 10 hectares)
		parcelData := map[string]interface{}{
			"name":    "Large Test Parcel",
			"farm_id": 1,
			"geojson": map[string]interface{}{
				"type": "Polygon",
				"coordinates": []interface{}{
					[]interface{}{
						[]float64{12.5, 41.9},
						[]float64{12.502, 41.9},   // ~200m east
						[]float64{12.502, 41.905}, // ~500m north
						[]float64{12.5, 41.905},
						[]float64{12.5, 41.9},
					},
				},
			},
		}

		jsonData, _ := json.Marshal(parcelData)
		req, _ := http.NewRequest("POST", "/parcels", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response models.Parcel
		json.Unmarshal(w.Body.Bytes(), &response)

		// Verify area was automatically calculated
		assert.Greater(t, response.Area, 5.0, "Area should be at least 5 hectares")
		assert.Less(t, response.Area, 20.0, "Area should be less than 20 hectares")

		t.Logf("Created large parcel with auto-calculated area: %.4f ha", response.Area)
	})
}

func TestParcelAreaPrecision(t *testing.T) {
	setupParcelTestDB(t)
	gin.SetMode(gin.TestMode)

	t.Run("Verify PostGIS geography-based calculation", func(t *testing.T) {
		// Test with a simple polygon to verify PostGIS is calculating correctly
		// The area will depend on the actual geographic coordinates
		var areaHectares float64
		err := initializers.DB.Raw(`
			SELECT ST_Area(
				ST_GeographyFromText(
					'POLYGON((12.5 41.9, 12.501 41.9, 12.501 41.901, 12.5 41.901, 12.5 41.9))'
				)
			) / 10000.0 as area
		`).Scan(&areaHectares).Error

		assert.NoError(t, err)
		assert.Greater(t, areaHectares, 0.0, "Area should be greater than 0")
		assert.Less(t, areaHectares, 2.0, "Area should be reasonable (less than 2 ha for this small polygon)")

		t.Logf("📐 PostGIS calculated area using geography type: %.6f ha", areaHectares)
		t.Logf("   (This is the accurate real-world area accounting for Earth's curvature)")
	})
}
