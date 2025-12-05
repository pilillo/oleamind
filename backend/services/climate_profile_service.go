package services

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

type ClimateProfileService struct {
	DB *gorm.DB
}

func NewClimateProfileService() *ClimateProfileService {
	return &ClimateProfileService{DB: initializers.DB}
}

// GetOrCreateProfile returns existing profile or creates one using latitude fallback
func (s *ClimateProfileService) GetOrCreateProfile(parcelID uint) (*models.ClimateProfile, error) {
	var profile models.ClimateProfile

	// Try to get existing profile
	err := s.DB.Where("parcel_id = ?", parcelID).First(&profile).Error
	if err == nil {
		return &profile, nil
	}

	// Profile doesn't exist  create using latitude fallback
	slog.Info("Creating new climate profile from latitude", "parcel_id", parcelID)
	return s.createFromLatitude(parcelID)
}

// createFromLatitude creates profile using geographic location estimate
func (s *ClimateProfileService) createFromLatitude(parcelID uint) (*models.ClimateProfile, error) {
	// Get parcel to extract latitude from geometry
	var parcel models.Parcel
	if err := s.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch parcel: %w", err)
	}

	latitude := extractLatitudeFromGeometry(parcel.GeoJSON)
	zone := getGlobalClimateZone(latitude)

	now := time.Now()
	profile := &models.ClimateProfile{
		ParcelID:           parcelID,
		DormancyStartMonth: &zone.DormancyStartMonth,
		DormancyEndMonth:   &zone.DormancyEndMonth,
		IrrigationFactor:   zone.IrrigationFactor,
		ETcMultiplier:      zone.ETcMultiplier,
		DataSource:         "latitude_fallback",
		DataPoints:         0,
		LastCalculated:     &now,
		ConfidenceScore:    0.3, // Low confidence for latitude-based
	}

	if err := s.DB.Create(profile).Error; err != nil {
		return nil, fmt.Errorf("failed to create climate profile: %w", err)
	}

	slog.Info("Created latitude-based climate profile",
		"parcel_id", parcelID,
		"latitude", latitude,
		"zone", zone.Name,
	)

	return profile, nil
}

// UpdateFromWeatherHistory learns climate profile from actual weather data
func (s *ClimateProfileService) UpdateFromWeatherHistory(parcelID uint) error {
	// Get existing profile
	var profile models.ClimateProfile
	if err := s.DB.Where("parcel_id = ?", parcelID).First(&profile).Error; err != nil {
		return fmt.Errorf("profile not found: %w", err)
	}

	// Get weather data for at least last 30 days (preferably 365)
	var weatherData []models.WeatherData
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	err := s.DB.Where("parcel_id = ? AND fetched_at >= ?", parcelID, thirtyDaysAgo).
		Order("fetched_at ASC").
		Find(&weatherData).Error

	if err != nil {
		return fmt.Errorf("failed to fetch weather data: %w", err)
	}

	if len(weatherData) < 30 {
		slog.Info("Insufficient weather data for profile update",
			"parcel_id", parcelID,
			"data_points", len(weatherData),
		)
		return nil // Not enough data yet, keep using fallback
	}

	// Get parcel to extract latitude for hemisphere detection
	var parcel models.Parcel
	if err := s.DB.First(&parcel, parcelID).Error; err != nil {
		return fmt.Errorf("failed to fetch parcel: %w", err)
	}
	latitude := extractLatitudeFromGeometry(parcel.Geometry)

	// Analyze weather patterns
	characteristics := analyzeWeatherPatterns(weatherData, latitude)

	// Update profile with learned characteristics
	firstDate := weatherData[0].FetchedAt
	now := time.Now()

	profile.WinterRainfallAvg = &characteristics.WinterRainfall
	profile.SummerET0Avg = &characteristics.SummerET0
	profile.AvgColdDaysPerYear = &characteristics.ColdDaysPerYear
	profile.DormancyStartMonth = &characteristics.DormancyStart
	profile.DormancyEndMonth = &characteristics.DormancyEnd
	profile.IrrigationFactor = characteristics.IrrigationFactor
	profile.ETcMultiplier = characteristics.ETcMultiplier
	profile.DataSource = "weather_history"
	profile.DataPoints = len(weatherData)
	profile.FirstWeatherDate = &firstDate
	profile.LastCalculated = &now
	profile.ConfidenceScore = calculateConfidence(len(weatherData))

	if err := s.DB.Save(&profile).Error; err != nil {
		return fmt.Errorf("failed to update profile: %w", err)
	}

	slog.Info("Updated climate profile from weather history",
		"parcel_id", parcelID,
		"data_points", len(weatherData),
		"confidence", profile.ConfidenceScore,
	)

	return nil
}

// extractLatitudeFromGeometry extracts latitude from parcel GeoJSON
func extractLatitudeFromGeometry(geojson models.PostGISGeoJSON) float64 {
	if len(geojson) == 0 {
		return 40.0 // Default to Central Mediterranean
	}

	var data map[string]interface{}
	if err := json.Unmarshal(geojson, &data); err != nil {
		return 40.0
	}

	// Extract coordinates from GeoJSON (assuming Polygon or MultiPolygon)
	if coords, ok := data["coordinates"].([]interface{}); ok && len(coords) > 0 {
		// Get first ring of first polygon
		if ring, ok := coords[0].([]interface{}); ok && len(ring) > 0 {
			if point, ok := ring[0].([]interface{}); ok && len(point) >= 2 {
				if lat, ok := point[1].(float64); ok {
					return lat
				}
			}
		}
	}

	return 40.0 // Fallback
}

// ClimateZone represents a latitude-based climate zone
type ClimateZone struct {
	Name               string
	DormancyStartMonth int
	DormancyEndMonth   int
	IrrigationFactor   float64
	ETcMultiplier      float64
}

// getGlobalClimateZone returns climate zone based on latitude
func getGlobalClimateZone(latitude float64) ClimateZone {
	absLat := math.Abs(latitude)
	isNorthern := latitude > 0

	switch {
	case absLat < 30.0:
		// Subtropical (e.g., North Africa coast)
		return ClimateZone{
			Name:               "Subtropical",
			DormancyStartMonth: getDormancyStart(isNorthern, "subtropical"),
			DormancyEndMonth:   getDormancyEnd(isNorthern, "subtropical"),
			IrrigationFactor:   0.80, // Irrigate earlier (hotter, drier)
			ETcMultiplier:      1.20, // Higher evaporation
		}
	case absLat < 38.0:
		// Warm Mediterranean (e.g., Southern Italy, Greece)
		return ClimateZone{
			Name:               "Warm Mediterranean",
			DormancyStartMonth: getDormancyStart(isNorthern, "warm_med"),
			DormancyEndMonth:   getDormancyEnd(isNorthern, "warm_med"),
			IrrigationFactor:   0.85,
			ETcMultiplier:      1.15,
		}
	case absLat < 42.0:
		// Central Mediterranean (e.g., Central Italy)
		return ClimateZone{
			Name:               "Central Mediterranean",
			DormancyStartMonth: getDormancyStart(isNorthern, "central_med"),
			DormancyEndMonth:   getDormancyEnd(isNorthern, "central_med"),
			IrrigationFactor:   1.0,
			ETcMultiplier:      1.0,
		}
	default:
		// Cool Mediterranean (e.g., Northern Italy)
		return ClimateZone{
			Name:               "Cool Mediterranean",
			DormancyStartMonth: getDormancyStart(isNorthern, "cool_med"),
			DormancyEndMonth:   getDormancyEnd(isNorthern, "cool_med"),
			IrrigationFactor:   1.10, // Can tolerate more depletion
			ETcMultiplier:      0.90, // Lower evaporation
		}
	}
}

// getDormancyStart returns dormancy start month based on hemisphere and climate
func getDormancyStart(isNorthern bool, climateType string) int {
	if isNorthern {
		// Northern Hemisphere: Winter (Nov-Dec start)
		switch climateType {
		case "subtropical":
			return 12 // December
		case "warm_med":
			return 12 // December
		case "central_med":
			return 11 // November
		default: // cool_med
			return 11 // November
		}
	} else {
		// Southern Hemisphere: Winter (May-Jun start)
		switch climateType {
		case "subtropical":
			return 6 // June
		case "warm_med":
			return 6 // June
		case "central_med":
			return 5 // May
		default: // cool_med
			return 5 // May
		}
	}
}

// getDormancyEnd returns dormancy end month based on hemisphere and climate
func getDormancyEnd(isNorthern bool, climateType string) int {
	if isNorthern {
		// Northern Hemisphere: Spring (Feb-Apr end)
		switch climateType {
		case "subtropical":
			return 2 // February
		case "warm_med":
			return 2 // February
		case "central_med":
			return 3 // March
		default: // cool_med
			return 4 // April
		}
	} else {
		// Southern Hemisphere: Spring (Aug-Oct end)
		switch climateType {
		case "subtropical":
			return 8 // August
		case "warm_med":
			return 8 // August
		case "central_med":
			return 9 // September
		default: // cool_med
			return 10 // October
		}
	}
}

// ClimateCharacteristics represents learned patterns from weather data
type ClimateCharacteristics struct {
	WinterRainfall   float64 // mm/month
	SummerET0        float64 // mm/day
	ColdDaysPerYear  int
	DormancyStart    int
	DormancyEnd      int
	IrrigationFactor float64
	ETcMultiplier    float64
}

// analyzeWeatherPatterns extracts climate characteristics from weather history
func analyzeWeatherPatterns(data []models.WeatherData, latitude float64) ClimateCharacteristics {
	if len(data) == 0 {
		return ClimateCharacteristics{
			IrrigationFactor: 1.0,
			ETcMultiplier:    1.0,
		}
	}

	var winterRain, summerET float64
	var winterCount, summerCount, coldDays int

	// Detect hemisphere from latitude
	isNorthern := latitude >= 0

	for _, d := range data {
		month := d.FetchedAt.Month()

		// Season detection based on hemisphere
		var isWinter, isSummer bool
		if isNorthern {
			// Northern Hemisphere: Winter (Nov-Feb), Summer (Jun-Aug)
			isWinter = month >= 11 || month <= 2
			isSummer = month >= 6 && month <= 8
		} else {
			// Southern Hemisphere: Winter (May-Aug), Summer (Dec-Feb)
			isWinter = month >= 5 && month <= 8
			isSummer = month >= 12 || month <= 2
		}

		if isWinter {
			winterRain += d.RainNext24h
			winterCount++
		}
		if isSummer {
			summerET += d.ET0
			summerCount++
		}

		// Count cold days
		if d.Temperature < 10.0 {
			coldDays++
		}
	}

	// Calculate averages
	avgWinterRain := 0.0
	if winterCount > 0 {
		avgWinterRain = (winterRain / float64(winterCount)) * 30 // Convert to monthly
	}

	avgSummerET := 5.0 // Default
	if summerCount > 0 {
		avgSummerET = summerET / float64(summerCount)
	}

	// Derive adjustments based on observed climate
	irrigationFactor := 1.0
	if avgSummerET > 6.0 {
		irrigationFactor = 0.85 // Hot, dry → irrigate earlier
	} else if avgSummerET < 4.0 {
		irrigationFactor = 1.10 // Cooler → can wait longer
	}

	etcMultiplier := 1.0
	if avgSummerET > 6.0 {
		etcMultiplier = 1.15
	} else if avgSummerET < 4.0 {
		etcMultiplier = 0.90
	}

	// Determine dormancy from cold days
	coldDaysPerYear := int(float64(coldDays) / float64(len(data)) * 365)
	dormancyStart := 11 // Default November
	dormancyEnd := 3    // Default March

	if coldDaysPerYear < 60 {
		// Warm climate - shorter dormancy
		dormancyStart = 12
		dormancyEnd = 2
	} else if coldDaysPerYear > 120 {
		// Cool climate - longer dormancy
		dormancyStart = 11
		dormancyEnd = 4
	}

	return ClimateCharacteristics{
		WinterRainfall:   avgWinterRain,
		SummerET0:        avgSummerET,
		ColdDaysPerYear:  coldDaysPerYear,
		DormancyStart:    dormancyStart,
		DormancyEnd:      dormancyEnd,
		IrrigationFactor: irrigationFactor,
		ETcMultiplier:    etcMultiplier,
	}
}

// calculateConfidence returns confidence score (0-1) based on data quantity
func calculateConfidence(dataPoints int) float64 {
	switch {
	case dataPoints >= 365:
		return 1.0 // Full year+
	case dataPoints >= 180:
		return 0.9 // 6+ months
	case dataPoints >= 90:
		return 0.7 // 3+ months
	case dataPoints >= 30:
		return 0.5 // 1+ month
	default:
		return 0.3 // Less than 1 month
	}
}
