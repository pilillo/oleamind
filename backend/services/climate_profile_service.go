package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

// =========================================
// CONSTANTS FOR CLIMATE ANALYSIS
// =========================================

const (
	// Mediterranean olive growing thresholds
	OliveMinWinterTemp       = -10.0  // °C - absolute minimum
	OliveOptMinWinterTemp    = 0.0    // °C - optimal minimum
	OliveOptMaxSummerTemp    = 35.0   // °C - optimal maximum
	OliveMaxSummerTemp       = 45.0   // °C - absolute maximum
	OliveMinAnnualRainfall   = 200.0  // mm - absolute minimum (with irrigation)
	OliveOptMinRainfall      = 400.0  // mm - optimal with some irrigation
	OliveOptMaxRainfall      = 800.0  // mm - optimal range
	OliveMinChillingHours    = 200    // hours < 7°C needed for flowering
	OliveOptChillingHours    = 400    // hours < 7°C optimal
	OliveGDDBase             = 10.0   // °C - base for Growing Degree Days
	OliveGDDFlowering        = 1000   // GDD to reach flowering (approximate)
	OliveGDDHarvest          = 2500   // GDD to reach harvest (approximate)

	// Distance thresholds
	CoastalDistanceKm        = 50.0   // km from sea = coastal climate
	MountainousAltitude      = 400.0  // m altitude = mountainous

	// Open-Meteo historical climate API
	OpenMeteoHistoricalURL   = "https://archive-api.open-meteo.com/v1/archive"
)

type ClimateProfileService struct {
	DB *gorm.DB
}

func NewClimateProfileService() *ClimateProfileService {
	return &ClimateProfileService{DB: initializers.DB}
}

// GetOrCreateProfile returns existing profile or creates one using location analysis
func (s *ClimateProfileService) GetOrCreateProfile(parcelID uint) (*models.ClimateProfile, error) {
	var profile models.ClimateProfile

	// Try to get existing profile
	err := s.DB.Where("parcel_id = ?", parcelID).First(&profile).Error
	if err == nil {
		// Check if profile needs updating (low confidence or stale)
		if profile.ConfidenceScore < 0.5 || (profile.LastCalculated != nil && time.Since(*profile.LastCalculated) > 30*24*time.Hour) {
			// Try to improve profile in background
			go func() {
				if err := s.EnhanceProfileFromHistoricalData(parcelID); err != nil {
					slog.Warn("Failed to enhance climate profile", "parcel_id", parcelID, "error", err)
				}
			}()
		}
		return &profile, nil
	}

	// Profile doesn't exist - create using comprehensive location analysis
	slog.Info("Creating new climate profile from location", "parcel_id", parcelID)
	return s.createFromLocation(parcelID)
}

// createFromLocation creates profile using comprehensive geographic analysis
func (s *ClimateProfileService) createFromLocation(parcelID uint) (*models.ClimateProfile, error) {
	// Get parcel to extract coordinates from geometry
	var parcel models.Parcel
	if err := s.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("failed to fetch parcel: %w", err)
	}

	// Extract full location data
	location := extractLocationFromGeometry(parcel.GeoJSON)

	// Analyze climate based on location
	climate := analyzeClimateFromLocation(location)

	now := time.Now()
	profile := &models.ClimateProfile{
		ParcelID:              parcelID,
		Latitude:              location.Latitude,
		Longitude:             location.Longitude,
		Altitude:              location.Altitude,
		DistanceToSea:         location.DistanceToSea,
		ClimateType:           climate.KoppenCode,
		IsCoastal:             location.DistanceToSea < CoastalDistanceKm,
		IsMountainous:         location.Altitude > MountainousAltitude,

		// Estimated temperature characteristics
		AvgAnnualTemp:         &climate.EstAvgAnnualTemp,
		AvgJanTemp:            &climate.EstAvgJanTemp,
		AvgJulTemp:            &climate.EstAvgJulTemp,
		AvgFrostDaysPerYear:   &climate.EstFrostDays,
		AvgHotDaysPerYear:     &climate.EstHotDays,

		// Estimated GDD
		AnnualGDD:             &climate.EstAnnualGDD,

		// Estimated precipitation
		AnnualRainfall:        &climate.EstAnnualRainfall,
		DryMonthsPerYear:      &climate.EstDryMonths,

		// Dormancy period
		DormancyStartMonth:    &climate.DormancyStart,
		DormancyEndMonth:      &climate.DormancyEnd,
		ChillingHours:         &climate.EstChillingHours,

		// Adjustment factors
		IrrigationFactor:      climate.IrrigationFactor,
		ETcMultiplier:         climate.ETcMultiplier,
		PestPressureFactor:    climate.PestPressureFactor,
		FrostRiskFactor:       climate.FrostRiskFactor,

		// Olive suitability
		OliveSuitabilityScore: climate.OliveSuitability,
		SuitabilityNotes:      climate.SuitabilityNotes,

		// Metadata
		DataSource:            "location_estimate",
		DataPoints:            0,
		LastCalculated:        &now,
		ConfidenceScore:       0.4, // Location-based estimate has moderate confidence
	}

	if err := s.DB.Create(profile).Error; err != nil {
		return nil, fmt.Errorf("failed to create climate profile: %w", err)
	}

	slog.Info("Created location-based climate profile",
		"parcel_id", parcelID,
		"lat", location.Latitude,
		"lon", location.Longitude,
		"climate_type", climate.KoppenCode,
		"suitability", climate.OliveSuitability,
	)

	// Try to enhance with historical data in background
	go func() {
		if err := s.EnhanceProfileFromHistoricalData(parcelID); err != nil {
			slog.Warn("Failed to fetch historical climate data", "parcel_id", parcelID, "error", err)
		}
	}()

	return profile, nil
}

// =========================================
// LOCATION EXTRACTION
// =========================================

// LocationData holds extracted geographic information
type LocationData struct {
	Latitude      float64
	Longitude     float64
	Altitude      float64 // Estimated from coordinates if not available
	DistanceToSea float64 // Estimated from coordinates
	IsNorthern    bool
}

// extractLocationFromGeometry extracts full location data from parcel GeoJSON
func extractLocationFromGeometry(geojson models.PostGISGeoJSON) LocationData {
	location := LocationData{
		Latitude:  40.0,  // Default to Central Mediterranean
		Longitude: 15.0,
		Altitude:  100.0,
	}

	if len(geojson) == 0 {
		location.IsNorthern = true
		location.DistanceToSea = estimateDistanceToSea(location.Latitude, location.Longitude)
		return location
	}

	var data map[string]interface{}
	if err := json.Unmarshal(geojson, &data); err != nil {
		location.IsNorthern = true
		location.DistanceToSea = estimateDistanceToSea(location.Latitude, location.Longitude)
		return location
	}

	// Extract coordinates from GeoJSON (Polygon or MultiPolygon)
	// Calculate centroid for better representation
	if coords, ok := data["coordinates"].([]interface{}); ok && len(coords) > 0 {
		var sumLat, sumLon float64
		var count int

		// Iterate through all points to find centroid
		if ring, ok := coords[0].([]interface{}); ok {
			for _, p := range ring {
				if point, ok := p.([]interface{}); ok && len(point) >= 2 {
					if lon, ok := point[0].(float64); ok {
						sumLon += lon
					}
					if lat, ok := point[1].(float64); ok {
						sumLat += lat
					}
					count++
				}
			}
		}

		if count > 0 {
			location.Latitude = sumLat / float64(count)
			location.Longitude = sumLon / float64(count)
		}
	}

	location.IsNorthern = location.Latitude >= 0
	location.DistanceToSea = estimateDistanceToSea(location.Latitude, location.Longitude)
	location.Altitude = estimateAltitude(location.Latitude, location.Longitude)

	return location
}

// estimateDistanceToSea estimates distance to nearest sea based on coordinates
// This is a simplified estimation for Mediterranean region
func estimateDistanceToSea(lat, lon float64) float64 {
	// Mediterranean coastline approximations (simplified)
	// Italy: west coast ~10-15°E, east coast ~14-18°E
	// Greece: varies widely
	// This is a rough estimate - real implementation would use a coastline database

	absLat := math.Abs(lat)

	// Mediterranean zone (30-45°N)
	if absLat >= 30 && absLat <= 45 {
		// Italy estimation
		if lon >= 7 && lon <= 19 {
			// Western Italy coast (Tyrrhenian)
			distWest := math.Abs(lon-10.5) * 80 // ~80km per degree at this latitude
			// Eastern Italy coast (Adriatic)
			distEast := math.Abs(lon-16) * 80
			return math.Min(distWest, distEast)
		}
		// Greece/Eastern Mediterranean
		if lon >= 19 && lon <= 30 {
			return math.Abs(lon-24) * 50 // Closer to coast on average
		}
		// Spain
		if lon >= -10 && lon <= 3 {
			return math.Min(math.Abs(lon-(-5))*80, math.Abs(lat-40)*100)
		}
	}

	// Default: assume 100km from coast
	return 100.0
}

// estimateAltitude estimates altitude based on coordinates
// This is a rough estimate - real implementation would use a DEM API
func estimateAltitude(lat, lon float64) float64 {
	// Simple heuristic for Mediterranean region:
	// - Coastal areas (near sea): ~50m
	// - Inland plains: ~100-200m
	// - Hilly areas: ~300-600m
	// - Mountains: >600m

	distToSea := estimateDistanceToSea(lat, lon)

	// Base altitude from distance to sea
	baseAlt := 50.0 + (distToSea * 2.0)

	// Regional adjustments (very simplified)
	// Central Italy Apennines
	if lon >= 11 && lon <= 15 && lat >= 41 && lat <= 44 {
		baseAlt += 200.0
	}
	// Alps
	if lat >= 45 && lat <= 47 && lon >= 6 && lon <= 14 {
		baseAlt += 500.0
	}
	// Greek mountains
	if lon >= 20 && lon <= 26 && lat >= 38 && lat <= 41 {
		baseAlt += 150.0
	}

	return math.Min(baseAlt, 1200.0) // Cap at 1200m (unlikely for olives above this)
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
	latitude := extractLatitudeFromGeometry(parcel.GeoJSON)

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

// extractLatitudeFromGeometry extracts latitude from parcel GeoJSON (legacy compatibility)
func extractLatitudeFromGeometry(geojson models.PostGISGeoJSON) float64 {
	loc := extractLocationFromGeometry(geojson)
	return loc.Latitude
}

// =========================================
// CLIMATE ANALYSIS FROM LOCATION
// =========================================

// ClimateAnalysis holds climate estimates derived from location
type ClimateAnalysis struct {
	KoppenCode         string  // Köppen climate classification
	KoppenName         string  // Human-readable name

	// Temperature estimates
	EstAvgAnnualTemp   float64
	EstAvgJanTemp      float64
	EstAvgJulTemp      float64
	EstFrostDays       int
	EstHotDays         int
	EstChillingHours   int

	// Precipitation estimates
	EstAnnualRainfall  float64
	EstDryMonths       int

	// Growing conditions
	EstAnnualGDD       int

	// Dormancy
	DormancyStart      int
	DormancyEnd        int

	// Adjustment factors
	IrrigationFactor   float64
	ETcMultiplier      float64
	PestPressureFactor float64
	FrostRiskFactor    float64

	// Suitability
	OliveSuitability   float64
	SuitabilityNotes   string
}

// analyzeClimateFromLocation estimates climate characteristics from coordinates
func analyzeClimateFromLocation(loc LocationData) ClimateAnalysis {
	absLat := math.Abs(loc.Latitude)

	// Start with base estimates
	climate := ClimateAnalysis{}

	// =========================================
	// KÖPPEN CLASSIFICATION
	// =========================================
	climate.KoppenCode, climate.KoppenName = classifyKoppen(loc)

	// =========================================
	// TEMPERATURE ESTIMATES
	// =========================================
	// Base temperature from latitude (simplified lapse rate model)
	// Equator ~27°C, drops ~0.6°C per degree latitude
	baseTemp := 27.0 - (absLat * 0.55)

	// Altitude adjustment (-6.5°C per 1000m)
	altitudeAdj := loc.Altitude * 0.0065
	baseTemp -= altitudeAdj

	// Maritime vs continental adjustment
	if loc.DistanceToSea < CoastalDistanceKm {
		// Coastal: smaller seasonal variation
		climate.EstAvgAnnualTemp = baseTemp
		climate.EstAvgJanTemp = baseTemp - 8.0  // Milder winter
		climate.EstAvgJulTemp = baseTemp + 8.0  // Cooler summer
	} else {
		// Continental: larger seasonal variation
		continentalFactor := math.Min(loc.DistanceToSea/100.0, 1.5)
		climate.EstAvgAnnualTemp = baseTemp
		climate.EstAvgJanTemp = baseTemp - (10.0 * continentalFactor)
		climate.EstAvgJulTemp = baseTemp + (10.0 * continentalFactor)
	}

	// Adjust for hemisphere (Jan/Jul swap for southern)
	if !loc.IsNorthern {
		climate.EstAvgJanTemp, climate.EstAvgJulTemp = climate.EstAvgJulTemp, climate.EstAvgJanTemp
	}

	// Frost and hot days
	if climate.EstAvgJanTemp < 5 {
		climate.EstFrostDays = int(30 * (5 - climate.EstAvgJanTemp) / 5)
	}
	if climate.EstAvgJulTemp > 30 {
		climate.EstHotDays = int(30 * (climate.EstAvgJulTemp - 30) / 5)
	}

	// Chilling hours (simplified: hours below 7°C in winter)
	if climate.EstAvgJanTemp < 7 {
		avgWinterTemp := (climate.EstAvgJanTemp + 5) / 2 // Approximate Dec-Feb average
		if avgWinterTemp < 7 {
			// More chilling hours when colder
			climate.EstChillingHours = int((7 - avgWinterTemp) * 150)
		}
	}

	// =========================================
	// PRECIPITATION ESTIMATES
	// =========================================
	// Mediterranean pattern: wet winter, dry summer
	if absLat >= 30 && absLat <= 45 {
		// Classic Mediterranean
		climate.EstAnnualRainfall = 600.0 // Base
		// Adjust for longitude (wetter in west Mediterranean)
		if loc.Longitude < 10 {
			climate.EstAnnualRainfall += 100
		}
		// Adjust for altitude (wetter at higher elevations)
		climate.EstAnnualRainfall += loc.Altitude * 0.3
		// Coastal areas can be wetter
		if loc.DistanceToSea < 20 {
			climate.EstAnnualRainfall += 100
		}
		climate.EstDryMonths = 4 // Jun-Sep typically dry
	} else if absLat < 30 {
		// Subtropical/arid
		climate.EstAnnualRainfall = 300.0
		climate.EstDryMonths = 7
	} else {
		// Temperate
		climate.EstAnnualRainfall = 800.0
		climate.EstDryMonths = 2
	}

	// =========================================
	// GROWING DEGREE DAYS
	// =========================================
	// Simplified: (avg temp - base) × 365 for temps above base
	if climate.EstAvgAnnualTemp > OliveGDDBase {
		climate.EstAnnualGDD = int((climate.EstAvgAnnualTemp - OliveGDDBase) * 365 * 0.7) // 0.7 factor for seasonal variation
	}

	// =========================================
	// DORMANCY PERIOD
	// =========================================
	climate.DormancyStart, climate.DormancyEnd = calculateDormancy(loc, climate)

	// =========================================
	// ADJUSTMENT FACTORS
	// =========================================
	// Irrigation factor: lower = irrigate earlier/more often
	climate.IrrigationFactor = 1.0
	if climate.EstAvgJulTemp > 28 {
		climate.IrrigationFactor -= 0.1 * ((climate.EstAvgJulTemp - 28) / 5)
	}
	if climate.EstAnnualRainfall < 500 {
		climate.IrrigationFactor -= 0.1 * ((500 - climate.EstAnnualRainfall) / 200)
	}
	climate.IrrigationFactor = math.Max(0.7, math.Min(1.2, climate.IrrigationFactor))

	// ETc multiplier: higher = more evapotranspiration
	climate.ETcMultiplier = 1.0
	if climate.EstAvgJulTemp > 25 {
		climate.ETcMultiplier += 0.05 * ((climate.EstAvgJulTemp - 25) / 5)
	}
	if loc.DistanceToSea > 100 {
		climate.ETcMultiplier += 0.05 // Continental = drier air
	}
	climate.ETcMultiplier = math.Max(0.8, math.Min(1.3, climate.ETcMultiplier))

	// Pest pressure: higher in warm, humid areas
	climate.PestPressureFactor = 1.0
	if climate.EstAvgJulTemp > 25 && climate.EstAnnualRainfall > 500 {
		climate.PestPressureFactor += 0.2
	}
	if climate.EstDryMonths < 3 {
		climate.PestPressureFactor += 0.1 // More humidity = more disease
	}

	// Frost risk
	climate.FrostRiskFactor = 1.0
	if climate.EstFrostDays > 30 {
		climate.FrostRiskFactor = 1.5
	} else if climate.EstFrostDays > 60 {
		climate.FrostRiskFactor = 2.0
	} else if climate.EstFrostDays < 10 {
		climate.FrostRiskFactor = 0.5
	}

	// =========================================
	// OLIVE SUITABILITY SCORE
	// =========================================
	climate.OliveSuitability, climate.SuitabilityNotes = calculateOliveSuitability(climate, loc)

	return climate
}

// classifyKoppen determines Köppen climate classification
func classifyKoppen(loc LocationData) (string, string) {
	absLat := math.Abs(loc.Latitude)

	// Simplified Köppen for olive-growing regions
	switch {
	case absLat < 25:
		return "BWh", "Hot Desert" // Too dry for rainfed olives
	case absLat >= 25 && absLat < 30:
		return "BSh", "Hot Semi-Arid" // Marginal, needs irrigation
	case absLat >= 30 && absLat < 40:
		if loc.DistanceToSea < 100 {
			return "Csa", "Hot-Summer Mediterranean" // Classic olive climate
		}
		return "Csa", "Hot-Summer Mediterranean (Continental)"
	case absLat >= 40 && absLat < 45:
		if loc.Altitude > 500 {
			return "Csb", "Warm-Summer Mediterranean" // Cooler, higher
		}
		return "Csa", "Hot-Summer Mediterranean"
	case absLat >= 45 && absLat < 50:
		return "Cfb", "Oceanic" // Marginal for olives
	default:
		return "Dfb", "Warm-Summer Continental" // Too cold for olives
	}
}

// calculateDormancy determines dormancy period based on climate
func calculateDormancy(loc LocationData, climate ClimateAnalysis) (int, int) {
	// Dormancy starts when temps consistently drop and ends when they rise
	if loc.IsNorthern {
		// Northern Hemisphere
		if climate.EstAvgJanTemp < 5 {
			return 11, 3 // Nov-Mar for cold areas
		} else if climate.EstAvgJanTemp < 10 {
			return 12, 2 // Dec-Feb for mild areas
		}
		return 1, 2 // Jan-Feb for warm areas (short dormancy)
	} else {
		// Southern Hemisphere
		if climate.EstAvgJulTemp < 5 { // July is winter
			return 5, 9 // May-Sep for cold areas
		} else if climate.EstAvgJulTemp < 10 {
			return 6, 8 // Jun-Aug for mild areas
		}
		return 7, 8 // Jul-Aug for warm areas
	}
}

// calculateOliveSuitability scores suitability for olive cultivation (0-100)
func calculateOliveSuitability(climate ClimateAnalysis, loc LocationData) (float64, string) {
	score := 100.0
	notes := []string{}

	// Temperature checks
	if climate.EstAvgJanTemp < OliveMinWinterTemp {
		score -= 50
		notes = append(notes, "Winter too cold for olives")
	} else if climate.EstAvgJanTemp < OliveOptMinWinterTemp {
		penalty := (OliveOptMinWinterTemp - climate.EstAvgJanTemp) * 5
		score -= penalty
		notes = append(notes, "Risk of frost damage")
	}

	if climate.EstAvgJulTemp > OliveMaxSummerTemp {
		score -= 30
		notes = append(notes, "Summer heat stress risk")
	} else if climate.EstAvgJulTemp > OliveOptMaxSummerTemp {
		penalty := (climate.EstAvgJulTemp - OliveOptMaxSummerTemp) * 3
		score -= penalty
		notes = append(notes, "Hot summers - ensure adequate irrigation")
	}

	// Rainfall checks
	if climate.EstAnnualRainfall < OliveMinAnnualRainfall {
		score -= 40
		notes = append(notes, "Insufficient rainfall - irrigation essential")
	} else if climate.EstAnnualRainfall < OliveOptMinRainfall {
		score -= 15
		notes = append(notes, "Supplemental irrigation recommended")
	} else if climate.EstAnnualRainfall > 1000 {
		score -= 10
		notes = append(notes, "High rainfall - monitor for fungal diseases")
	}

	// Chilling hours
	if climate.EstChillingHours < OliveMinChillingHours {
		score -= 20
		notes = append(notes, "May have insufficient chilling for good flowering")
	}

	// GDD check
	if climate.EstAnnualGDD < 1500 {
		score -= 25
		notes = append(notes, "Growing season may be too short")
	}

	// Altitude bonus/penalty
	if loc.Altitude > 800 {
		score -= 15
		notes = append(notes, "High altitude - shorter growing season")
	} else if loc.Altitude > 200 && loc.Altitude < 600 {
		score += 5 // Ideal range
		notes = append(notes, "Good elevation for olive cultivation")
	}

	// Coastal bonus
	if loc.DistanceToSea < 30 {
		score += 5
		notes = append(notes, "Maritime influence - milder temperatures")
	}

	// Cap score
	score = math.Max(0, math.Min(100, score))

	// Summary note
	var summary string
	if score >= 80 {
		summary = "Excellent conditions for olive cultivation"
	} else if score >= 60 {
		summary = "Good conditions with some considerations"
	} else if score >= 40 {
		summary = "Marginal conditions - careful variety selection needed"
	} else {
		summary = "Challenging conditions for olive cultivation"
	}

	if len(notes) > 0 {
		summary += ": " + notes[0]
		for _, n := range notes[1:] {
			summary += "; " + n
		}
	}

	return score, summary
}

// ClimateZone represents a latitude-based climate zone (legacy compatibility)
type ClimateZone struct {
	Name               string
	DormancyStartMonth int
	DormancyEndMonth   int
	IrrigationFactor   float64
	ETcMultiplier      float64
}

// getGlobalClimateZone returns climate zone based on latitude (legacy compatibility)
func getGlobalClimateZone(latitude float64) ClimateZone {
	loc := LocationData{Latitude: latitude, Longitude: 15.0, IsNorthern: latitude >= 0}
	loc.DistanceToSea = estimateDistanceToSea(latitude, 15.0)
	loc.Altitude = estimateAltitude(latitude, 15.0)

	climate := analyzeClimateFromLocation(loc)

	return ClimateZone{
		Name:               climate.KoppenName,
		DormancyStartMonth: climate.DormancyStart,
		DormancyEndMonth:   climate.DormancyEnd,
		IrrigationFactor:   climate.IrrigationFactor,
		ETcMultiplier:      climate.ETcMultiplier,
	}
}

// =========================================
// HISTORICAL CLIMATE DATA (Open-Meteo Archive API)
// =========================================

// HistoricalClimateData represents aggregated historical climate data
type HistoricalClimateData struct {
	AvgTemp          float64
	MinTemp          float64
	MaxTemp          float64
	AvgPrecipitation float64
	TotalPrecipitation float64
	FrostDays        int
	HotDays          int
	GDD              int
	ChillingHours    int
	ET0Sum           float64
}

// EnhanceProfileFromHistoricalData fetches 5 years of historical data to improve accuracy
func (s *ClimateProfileService) EnhanceProfileFromHistoricalData(parcelID uint) error {
	var profile models.ClimateProfile
	if err := s.DB.Where("parcel_id = ?", parcelID).First(&profile).Error; err != nil {
		return fmt.Errorf("profile not found: %w", err)
	}

	// Skip if already enhanced recently
	if profile.DataSource == "historical_api" && profile.LastCalculated != nil {
		if time.Since(*profile.LastCalculated) < 30*24*time.Hour {
			return nil // Already enhanced within last 30 days
		}
	}

	// Fetch historical data from Open-Meteo
	historical, err := fetchHistoricalClimate(profile.Latitude, profile.Longitude, 5)
	if err != nil {
		return fmt.Errorf("failed to fetch historical data: %w", err)
	}

	now := time.Now()

	// Update profile with historical data
	profile.AvgAnnualTemp = &historical.AvgTemp
	annualRain := historical.TotalPrecipitation
	profile.AnnualRainfall = &annualRain
	profile.AvgFrostDaysPerYear = &historical.FrostDays
	profile.AvgHotDaysPerYear = &historical.HotDays
	profile.AnnualGDD = &historical.GDD
	profile.ChillingHours = &historical.ChillingHours
	annualET0 := historical.ET0Sum
	profile.AnnualET0 = &annualET0

	// Recalculate adjustment factors based on actual data
	if historical.AvgTemp > 18 {
		profile.IrrigationFactor = 0.85
		profile.ETcMultiplier = 1.15
	} else if historical.AvgTemp < 14 {
		profile.IrrigationFactor = 1.1
		profile.ETcMultiplier = 0.9
	}

	if historical.FrostDays > 60 {
		profile.FrostRiskFactor = 1.8
	} else if historical.FrostDays > 30 {
		profile.FrostRiskFactor = 1.3
	} else {
		profile.FrostRiskFactor = 0.8
	}

	// Recalculate suitability with actual data
	profile.OliveSuitabilityScore = calculateSuitabilityFromHistorical(historical)

	profile.DataSource = "historical_api"
	profile.LastCalculated = &now
	profile.ConfidenceScore = 0.85 // High confidence with 5 years of data

	if err := s.DB.Save(&profile).Error; err != nil {
		return fmt.Errorf("failed to save enhanced profile: %w", err)
	}

	slog.Info("Enhanced climate profile with historical data",
		"parcel_id", parcelID,
		"avg_temp", historical.AvgTemp,
		"annual_rain", historical.TotalPrecipitation,
		"frost_days", historical.FrostDays,
		"gdd", historical.GDD,
	)

	return nil
}

// fetchHistoricalClimate retrieves historical climate data from Open-Meteo Archive API
func fetchHistoricalClimate(lat, lon float64, years int) (*HistoricalClimateData, error) {
	endDate := time.Now().AddDate(0, 0, -1) // Yesterday
	startDate := endDate.AddDate(-years, 0, 0)

	url := fmt.Sprintf(
		"%s?latitude=%.4f&longitude=%.4f&start_date=%s&end_date=%s&"+
			"daily=temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration&"+
			"timezone=auto",
		OpenMeteoHistoricalURL,
		lat, lon,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch historical data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var apiResp struct {
		Daily struct {
			Time           []string  `json:"time"`
			TempMean       []float64 `json:"temperature_2m_mean"`
			TempMin        []float64 `json:"temperature_2m_min"`
			TempMax        []float64 `json:"temperature_2m_max"`
			Precipitation  []float64 `json:"precipitation_sum"`
			ET0            []float64 `json:"et0_fao_evapotranspiration"`
		} `json:"daily"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Aggregate data
	result := &HistoricalClimateData{}
	var tempSum, precipSum, et0Sum float64
	var minTemp, maxTemp float64 = 100, -100

	for i, temp := range apiResp.Daily.TempMean {
		if temp == 0 && i > 0 {
			continue // Skip missing data
		}
		tempSum += temp

		if apiResp.Daily.TempMin[i] < minTemp {
			minTemp = apiResp.Daily.TempMin[i]
		}
		if apiResp.Daily.TempMax[i] > maxTemp {
			maxTemp = apiResp.Daily.TempMax[i]
		}

		// Count frost days (min < 0)
		if apiResp.Daily.TempMin[i] < 0 {
			result.FrostDays++
		}

		// Count hot days (max > 35)
		if apiResp.Daily.TempMax[i] > 35 {
			result.HotDays++
		}

		// Growing Degree Days (base 10°C)
		if temp > OliveGDDBase {
			result.GDD += int(temp - OliveGDDBase)
		}

		// Chilling hours (temp < 7°C, estimate hours from daily mean)
		if temp < 7 {
			result.ChillingHours += int((7 - temp) * 2) // Rough approximation
		}

		// Precipitation
		if i < len(apiResp.Daily.Precipitation) {
			precipSum += apiResp.Daily.Precipitation[i]
		}

		// ET0
		if i < len(apiResp.Daily.ET0) {
			et0Sum += apiResp.Daily.ET0[i]
		}
	}

	days := len(apiResp.Daily.TempMean)
	if days > 0 {
		result.AvgTemp = tempSum / float64(days)
		result.MinTemp = minTemp
		result.MaxTemp = maxTemp
		result.TotalPrecipitation = precipSum / float64(years) // Annual average
		result.ET0Sum = et0Sum / float64(years)                // Annual average
		result.FrostDays = result.FrostDays / years            // Annual average
		result.HotDays = result.HotDays / years
		result.GDD = result.GDD / years
		result.ChillingHours = result.ChillingHours / years
	}

	return result, nil
}

// calculateSuitabilityFromHistorical scores suitability based on actual historical data
func calculateSuitabilityFromHistorical(h *HistoricalClimateData) float64 {
	score := 100.0

	// Temperature checks
	if h.MinTemp < -10 {
		score -= 40 // Severe frost damage risk
	} else if h.MinTemp < -5 {
		score -= 20
	} else if h.MinTemp < 0 {
		score -= 10
	}

	if h.MaxTemp > 45 {
		score -= 25
	} else if h.MaxTemp > 40 {
		score -= 15
	}

	// Precipitation
	if h.TotalPrecipitation < 200 {
		score -= 30
	} else if h.TotalPrecipitation < 400 {
		score -= 15
	} else if h.TotalPrecipitation > 1200 {
		score -= 10
	}

	// GDD
	if h.GDD < 1500 {
		score -= 20
	}

	// Chilling hours
	if h.ChillingHours < 200 {
		score -= 15
	}

	// Frost days penalty
	if h.FrostDays > 60 {
		score -= 15
	}

	return math.Max(0, math.Min(100, score))
}

// getDormancyStart returns dormancy start month based on hemisphere and climate (legacy)
func getDormancyStart(isNorthern bool, climateType string) int {
	if isNorthern {
		switch climateType {
		case "subtropical":
			return 12
		case "warm_med":
			return 12
		case "central_med":
			return 11
		default:
			return 11
		}
	} else {
		switch climateType {
		case "subtropical":
			return 6
		case "warm_med":
			return 6
		case "central_med":
			return 5
		default:
			return 5
		}
	}
}

// getDormancyEnd returns dormancy end month based on hemisphere and climate (legacy)
func getDormancyEnd(isNorthern bool, climateType string) int {
	if isNorthern {
		switch climateType {
		case "subtropical":
			return 2
		case "warm_med":
			return 2
		case "central_med":
			return 3
		default:
			return 4
		}
	} else {
		switch climateType {
		case "subtropical":
			return 8
		case "warm_med":
			return 8
		case "central_med":
			return 9
		default:
			return 10
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
