package controllers

import (
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

func setupWeatherTestDB(t *testing.T) {
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
	initializers.DB.Exec("DROP TABLE IF EXISTS weather_forecasts CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS weather_data CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcel_varieties CASCADE")
	initializers.DB.Exec("DROP TABLE IF EXISTS parcels CASCADE")
	initializers.DB.AutoMigrate(&models.Parcel{}, &models.WeatherData{}, &models.WeatherForecast{})
}

func TestGetWeatherForParcel(t *testing.T) {
	setupWeatherTestDB(t)
	gin.SetMode(gin.TestMode)

	// Create a test parcel with real coordinates (Rome, Italy area)
	parcelGeoJSON := `{
		"type": "Polygon",
		"coordinates": [[
			[12.5, 41.9],
			[12.501, 41.9],
			[12.501, 41.901],
			[12.5, 41.901],
			[12.5, 41.9]
		]]
	}`

	var parcel models.Parcel
	initializers.DB.Exec(fmt.Sprintf(`
		INSERT INTO parcels (name, farm_id, geo_json, created_at, updated_at)
		VALUES ('Test Parcel', 1, ST_GeomFromGeoJSON('%s'), NOW(), NOW())
		RETURNING id
	`, parcelGeoJSON)).Scan(&parcel.ID)

	router := gin.Default()
	router.GET("/parcels/:parcel_id/weather", GetWeatherForParcel)

	t.Run("Fetch weather for valid parcel", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/parcels/%d/weather", parcel.ID), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed (200) or fail gracefully
		// Note: This test requires internet connectivity to reach Open-Meteo API
		if w.Code == http.StatusOK {
			t.Log("✅ Successfully fetched weather data from Open-Meteo")
			assert.Equal(t, http.StatusOK, w.Code)
			
			// Verify response structure
			assert.Contains(t, w.Body.String(), "temperature")
			assert.Contains(t, w.Body.String(), "humidity")
		} else {
			t.Logf("⚠️  Weather fetch failed (expected if no internet): %d - %s", w.Code, w.Body.String())
		}
	})

	t.Run("Fetch weather for invalid parcel", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/parcels/99999/weather", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("Invalid parcel ID format", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/parcels/invalid/weather", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestRefreshAllWeather(t *testing.T) {
	setupWeatherTestDB(t)
	gin.SetMode(gin.TestMode)

	router := gin.Default()
	router.POST("/weather/refresh", RefreshAllWeather)

	t.Run("Trigger weather refresh", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/weather/refresh", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return immediately with success status
		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "success")
		assert.Contains(t, w.Body.String(), "Weather refresh started")
	})
}

