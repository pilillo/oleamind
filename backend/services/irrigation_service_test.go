package services

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// setupTestDB initializes a test database connection
func setupTestDB(t *testing.T) {
	// Skip if no test database configured
	if os.Getenv("TEST_DB_HOST") == "" {
		t.Skip("Skipping test: TEST_DB_HOST not set")
	}

	// Initialize DB
	initializers.ConnectToDB()
	
	// Auto-migrate required tables
	initializers.DB.AutoMigrate(
		&models.User{},
		&models.Farm{},
		&models.Parcel{},
		&models.WeatherData{},
		&models.IrrigationRecommendation{},
		&models.IrrigationEvent{},
		&models.SoilProfile{},
		&models.IrrigationSystem{},
	)

	// Clean up test data
	initializers.DB.Exec("DELETE FROM irrigation_recommendations")
	initializers.DB.Exec("DELETE FROM irrigation_events")
	initializers.DB.Exec("DELETE FROM soil_profiles")
	initializers.DB.Exec("DELETE FROM irrigation_systems")
	initializers.DB.Exec("DELETE FROM weather_data")
	initializers.DB.Exec("DELETE FROM parcels")
	initializers.DB.Exec("DELETE FROM farms")
	initializers.DB.Exec("DELETE FROM users")
}

func TestCalculateRecommendation_Integration(t *testing.T) {
	setupTestDB(t)

	// Create test farm (no need for user in this context)
	farm := models.Farm{Name: "Test Farm", Address: "Test Address"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	// Create test parcel
	parcel := models.Parcel{
		Name:       "Test Orchard",
		FarmID:     farm.ID,
		Area:       2.5,
		TreesCount: 250,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Create weather data for the parcel
	weather := models.WeatherData{
		ParcelID:     parcel.ID,
		Temperature:  25.0,
		Humidity:     60.0,
		WindSpeed:    5.0,
		Precipitation: 0.0,
		ET0:          5.5,
		RainNext24h:  0.0,
		FetchedAt:    time.Now(),
	}
	require.NoError(t, initializers.DB.Create(&weather).Error)

	// Test the recommendation calculation
	service := NewIrrigationService()
	recommendation, err := service.CalculateRecommendation(parcel.ID)

	require.NoError(t, err, "Should calculate recommendation successfully")
	assert.NotNil(t, recommendation, "Recommendation should not be nil")
	assert.Equal(t, parcel.ID, recommendation.ParcelID, "ParcelID should match")
	assert.NotEmpty(t, recommendation.GrowthStage, "Growth stage should be determined")
	assert.NotEmpty(t, recommendation.StressLevel, "Stress level should be determined")
	assert.NotEmpty(t, recommendation.UrgencyLevel, "Urgency level should be determined")
	assert.GreaterOrEqual(t, recommendation.SoilMoistureEstimate, 0.0, "Soil moisture should be non-negative")
	assert.LessOrEqual(t, recommendation.SoilMoistureEstimate, 100.0, "Soil moisture should not exceed 100%")

	t.Logf("Recommendation: should_irrigate=%v, amount=%.1fmm, liters/tree=%.1f, urgency=%s, stress=%s",
		recommendation.ShouldIrrigate,
		recommendation.RecommendedAmount,
		recommendation.RecommendedLitersTree,
		recommendation.UrgencyLevel,
		recommendation.StressLevel,
	)
}

func TestLogIrrigationEvent(t *testing.T) {
	setupTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 2", Address: "Test Address 2"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 2",
		FarmID:     farm.ID,
		Area:       1.0,
		TreesCount: 100,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Log an irrigation event
	service := NewIrrigationService()
	event := &models.IrrigationEvent{
		ParcelID:    parcel.ID,
		Date:        time.Now(),
		WaterAmount: 25.0,
		Method:      "drip",
		Duration:    120,
		Notes:       "Regular scheduled irrigation",
	}

	err := service.LogIrrigationEvent(event)
	require.NoError(t, err, "Should log irrigation event successfully")
	assert.NotZero(t, event.ID, "Event ID should be set after creation")
}

func TestGetIrrigationHistory(t *testing.T) {
	setupTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 3", Address: "Test Address 3"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 3",
		FarmID:     farm.ID,
		Area:       2.0,
		TreesCount: 200,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Log multiple irrigation events
	service := NewIrrigationService()
	now := time.Now()
	
	events := []models.IrrigationEvent{
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -7), WaterAmount: 20.0, Method: "drip"},
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -3), WaterAmount: 25.0, Method: "drip"},
		{ParcelID: parcel.ID, Date: now, WaterAmount: 30.0, Method: "drip"},
	}

	for _, event := range events {
		e := event // Create a copy to avoid pointer issues
		require.NoError(t, service.LogIrrigationEvent(&e))
	}

	// Retrieve history
	startDate := now.AddDate(0, 0, -10)
	endDate := now.AddDate(0, 0, 1)
	history, err := service.GetIrrigationHistory(parcel.ID, startDate, endDate)

	require.NoError(t, err, "Should retrieve history successfully")
	assert.Len(t, history, 3, "Should retrieve all 3 events")
	
	// Verify events are ordered by date (most recent first)
	assert.True(t, history[0].Date.After(history[1].Date) || history[0].Date.Equal(history[1].Date))
	assert.True(t, history[1].Date.After(history[2].Date) || history[1].Date.Equal(history[2].Date))
}

func TestGetWaterUsageStats(t *testing.T) {
	setupTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 4", Address: "Test Address 4"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 4",
		FarmID:     farm.ID,
		Area:       1.5,
		TreesCount: 150,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Log irrigation events
	service := NewIrrigationService()
	now := time.Now()
	
	events := []models.IrrigationEvent{
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -5), WaterAmount: 20.0, Method: "drip", Duration: 100},
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -3), WaterAmount: 25.0, Method: "drip", Duration: 120},
		{ParcelID: parcel.ID, Date: now, WaterAmount: 30.0, Method: "drip", Duration: 150},
	}

	for _, event := range events {
		e := event
		require.NoError(t, service.LogIrrigationEvent(&e))
	}

	// Get stats
	startDate := now.AddDate(0, 0, -7)
	endDate := now.AddDate(0, 0, 1)
	stats, err := service.GetWaterUsageStats(parcel.ID, startDate, endDate)

	require.NoError(t, err, "Should calculate stats successfully")
	assert.NotNil(t, stats, "Stats should not be nil")
	assert.Equal(t, 3, stats.TotalEvents, "Should count 3 events")
	assert.InDelta(t, 75.0, stats.TotalAmountMM, 0.1, "Total amount should be 75mm")
	assert.InDelta(t, 25.0, stats.AverageAmountMM, 0.1, "Average amount should be 25mm")
	assert.InDelta(t, 370.0, stats.TotalDurationMin, 0.1, "Total duration should be 370 minutes")

	// Calculate expected total volume: 75mm * 1.5 ha * 10000 m²/ha = 1,125,000 L = 1,125 m³
	assert.InDelta(t, 1125.0, stats.TotalVolumeCubicMeters, 1.0, "Total volume should be ~1125 m³")

	t.Logf("Water usage stats: events=%d, total=%.1fmm, avg=%.1fmm, volume=%.1fm³",
		stats.TotalEvents, stats.TotalAmountMM, stats.AverageAmountMM, stats.TotalVolumeCubicMeters)
}

func TestCalculateRecommendation_NoWeatherData(t *testing.T) {
	setupTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 5", Address: "Test Address 5"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 5",
		FarmID:     farm.ID,
		Area:       1.0,
		TreesCount: 100,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Try to calculate recommendation without weather data
	service := NewIrrigationService()
	_, err := service.CalculateRecommendation(parcel.ID)

	// Should handle gracefully (might return error or use defaults)
	// The exact behavior depends on implementation
	if err != nil {
		t.Logf("Expected error when no weather data: %v", err)
	}
}
