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
func setupPestTestDB(t *testing.T) {
	// Skip if no test database configured
	if os.Getenv("TEST_DB_HOST") == "" {
		t.Skip("Skipping test: TEST_DB_HOST not set")
	}

	// Initialize DB
	initializers.ConnectToDB()
	
	// Auto-migrate required tables
	initializers.DB.AutoMigrate(
		&models.Farm{},
		&models.Parcel{},
		&models.WeatherData{},
		&models.PestRiskAssessment{},
		&models.TreatmentLog{},
		&models.PestMonitoring{},
	)

	// Clean up test data
	initializers.DB.Exec("DELETE FROM pest_risk_assessments")
	initializers.DB.Exec("DELETE FROM treatment_logs")
	initializers.DB.Exec("DELETE FROM pest_monitorings")
	initializers.DB.Exec("DELETE FROM weather_data")
	initializers.DB.Exec("DELETE FROM parcels")
	initializers.DB.Exec("DELETE FROM farms")
}

func TestCalculateOliveFlyRisk(t *testing.T) {
	setupPestTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm", Address: "Test Address"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard",
		FarmID:     farm.ID,
		Area:       1.0,
		TreesCount: 100,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Test different scenarios
	scenarios := []struct {
		name          string
		temperature   float64
		humidity      int
		precipitation float64
		expectedLevel models.RiskLevel
	}{
		{
			name:          "Critical risk - optimal conditions",
			temperature:   25.0,
			humidity:      75,
			precipitation: 0.0,
			expectedLevel: models.RiskLevelCritical,
		},
		{
			name:          "High risk - good conditions",
			temperature:   22.0,
			humidity:      65,
			precipitation: 2.0,
			expectedLevel: models.RiskLevelHigh,
		},
		{
			name:          "Low risk - cold temperature",
			temperature:   10.0,
			humidity:      50,
			precipitation: 0.0,
			expectedLevel: models.RiskLevelLow,
		},
		{
			name:          "Minimal risk - very hot",
			temperature:   38.0,
			humidity:      40,
			precipitation: 0.0,
			expectedLevel: models.RiskLevelNone,
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			// Create weather data
			weather := models.WeatherData{
				ParcelID:      parcel.ID,
				Temperature:   scenario.temperature,
				Humidity:      scenario.humidity,
				Precipitation: scenario.precipitation,
				WindSpeed:     5.0,
				ET0:           3.0,
				RainNext24h:   0.0,
				FetchedAt:     time.Now(),
			}
			require.NoError(t, initializers.DB.Create(&weather).Error)

			// Calculate risk
			service := NewPestControlService()
			assessments, err := service.CalculateRiskForParcel(parcel.ID)

			require.NoError(t, err)
			assert.NotEmpty(t, assessments)

			// Find olive fly assessment
			var flyAssessment *models.PestRiskAssessment
			for i := range assessments {
				if assessments[i].PestType == models.PestTypeOliveFly {
					flyAssessment = &assessments[i]
					break
				}
			}

			require.NotNil(t, flyAssessment, "Olive fly assessment should be present")
			assert.Equal(t, scenario.expectedLevel, flyAssessment.RiskLevel, 
				"Expected %s risk level, got %s (score: %.0f)", 
				scenario.expectedLevel, flyAssessment.RiskLevel, flyAssessment.RiskScore)
			assert.NotEmpty(t, flyAssessment.AlertMessage)
			assert.NotEmpty(t, flyAssessment.Recommendations)

			// Clean up for next iteration
			initializers.DB.Delete(&weather)
			initializers.DB.Exec("DELETE FROM pest_risk_assessments")
		})
	}
}

func TestCalculatePeacockSpotRisk(t *testing.T) {
	setupPestTestDB(t)

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

	// Test scenarios for Peacock Spot
	scenarios := []struct {
		name          string
		temperature   float64
		humidity      int
		precipitation float64
		rainNext24h   float64
		expectedLevel models.RiskLevel
	}{
		{
			name:          "Critical risk - optimal infection conditions",
			temperature:   15.0,
			humidity:      95,
			precipitation: 10.0,
			rainNext24h:   8.0,
			expectedLevel: models.RiskLevelCritical,
		},
		{
			name:          "High risk - favorable conditions",
			temperature:   18.0,
			humidity:      85,
			precipitation: 3.0,
			rainNext24h:   2.0,
			expectedLevel: models.RiskLevelHigh,
		},
		{
			name:          "Low risk - dry conditions",
			temperature:   20.0,
			humidity:      60,
			precipitation: 0.0,
			rainNext24h:   0.0,
			expectedLevel: models.RiskLevelLow,
		},
		{
			name:          "Minimal risk - hot and dry",
			temperature:   32.0,
			humidity:      40,
			precipitation: 0.0,
			rainNext24h:   0.0,
			expectedLevel: models.RiskLevelNone,
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			// Create weather data
			weather := models.WeatherData{
				ParcelID:      parcel.ID,
				Temperature:   scenario.temperature,
				Humidity:      scenario.humidity,
				Precipitation: scenario.precipitation,
				WindSpeed:     5.0,
				ET0:           3.0,
				RainNext24h:   scenario.rainNext24h,
				FetchedAt:     time.Now(),
			}
			require.NoError(t, initializers.DB.Create(&weather).Error)

			// Calculate risk
			service := NewPestControlService()
			assessments, err := service.CalculateRiskForParcel(parcel.ID)

			require.NoError(t, err)
			assert.NotEmpty(t, assessments)

			// Find peacock spot assessment
			var spotAssessment *models.PestRiskAssessment
			for i := range assessments {
				if assessments[i].PestType == models.PestTypePeacockSpot {
					spotAssessment = &assessments[i]
					break
				}
			}

			require.NotNil(t, spotAssessment, "Peacock spot assessment should be present")
			assert.Equal(t, scenario.expectedLevel, spotAssessment.RiskLevel,
				"Expected %s risk level, got %s (score: %.0f)",
				scenario.expectedLevel, spotAssessment.RiskLevel, spotAssessment.RiskScore)
			assert.NotEmpty(t, spotAssessment.AlertMessage)
			assert.NotEmpty(t, spotAssessment.Recommendations)

			// Clean up for next iteration
			initializers.DB.Delete(&weather)
			initializers.DB.Exec("DELETE FROM pest_risk_assessments")
		})
	}
}

func TestLogTreatment(t *testing.T) {
	setupPestTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 3", Address: "Test Address 3"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 3",
		FarmID:     farm.ID,
		Area:       1.0,
		TreesCount: 100,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Log a treatment
	service := NewPestControlService()
	treatment := &models.TreatmentLog{
		ParcelID:          parcel.ID,
		Date:              time.Now(),
		PestType:          models.PestTypeOliveFly,
		TreatmentType:     "chemical",
		ProductName:       "Spinosad Bait",
		ActiveAgent:       "Spinosad",
		DoseRate:          "0.5 L/ha",
		ApplicationMethod: "spray",
		TargetArea:        1.0,
		Cost:              25.50,
		Notes:             "Preventive treatment based on trap counts",
	}

	err := service.LogTreatment(treatment)
	require.NoError(t, err)
	assert.NotZero(t, treatment.ID)
}

func TestGetTreatmentHistory(t *testing.T) {
	setupPestTestDB(t)

	// Create test farm and parcel
	farm := models.Farm{Name: "Test Farm 4", Address: "Test Address 4"}
	require.NoError(t, initializers.DB.Create(&farm).Error)

	parcel := models.Parcel{
		Name:       "Test Orchard 4",
		FarmID:     farm.ID,
		Area:       1.0,
		TreesCount: 100,
		GeoJSON: models.PostGISGeoJSON(`{
			"type": "Polygon",
			"coordinates": [[[12.0, 43.0], [12.01, 43.0], [12.01, 43.01], [12.0, 43.01], [12.0, 43.0]]]
		}`),
	}
	require.NoError(t, initializers.DB.Create(&parcel).Error)

	// Log multiple treatments
	service := NewPestControlService()
	now := time.Now()

	treatments := []models.TreatmentLog{
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -10), PestType: models.PestTypeOliveFly, TreatmentType: "trap"},
		{ParcelID: parcel.ID, Date: now.AddDate(0, 0, -5), PestType: models.PestTypeOliveFly, TreatmentType: "chemical"},
		{ParcelID: parcel.ID, Date: now, PestType: models.PestTypePeacockSpot, TreatmentType: "chemical"},
	}

	for _, treatment := range treatments {
		t := treatment
		require.NoError(t, service.LogTreatment(&t))
	}

	// Retrieve history
	startDate := now.AddDate(0, 0, -15)
	endDate := now.AddDate(0, 0, 1)
	history, err := service.GetTreatmentHistory(parcel.ID, startDate, endDate)

	require.NoError(t, err)
	assert.Len(t, history, 3)
}

func TestGetRiskHistory(t *testing.T) {
	setupPestTestDB(t)

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

	// Create historical weather and risk data
	service := NewPestControlService()
	now := time.Now()

	for i := 0; i < 5; i++ {
		weather := models.WeatherData{
			ParcelID:      parcel.ID,
			Temperature:   20.0 + float64(i),
			Humidity:      60 + i*5,
			Precipitation: 0.0,
			WindSpeed:     5.0,
			ET0:           3.0,
			RainNext24h:   0.0,
			FetchedAt:     now.AddDate(0, 0, -i),
		}
		require.NoError(t, initializers.DB.Create(&weather).Error)

		// Calculate risk for that day
		_, err := service.CalculateRiskForParcel(parcel.ID)
		require.NoError(t, err)

		// Clean up weather to avoid duplicates
		initializers.DB.Delete(&weather)
	}

	// Retrieve history
	history, err := service.GetRiskHistory(parcel.ID, models.PestTypeOliveFly, 7)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(history), 1, "Should have at least one historical record")
}

