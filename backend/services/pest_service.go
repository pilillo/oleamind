package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

type PestControlService struct{}

func NewPestControlService() *PestControlService {
	return &PestControlService{}
}

// CalculateRiskForParcel calculates pest/disease risk for a specific parcel
func (s *PestControlService) CalculateRiskForParcel(parcelID uint) ([]models.PestRiskAssessment, error) {
	// Get the latest weather data for the parcel
	var weather models.WeatherData
	err := initializers.DB.Where("parcel_id = ?", parcelID).
		Order("fetched_at DESC").
		First(&weather).Error

	if err != nil {
		// Return empty assessments with a message instead of error
		// This allows the frontend to display a helpful message
		return []models.PestRiskAssessment{}, nil
	}

	// Get the parcel to retrieve tree count
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("parcel not found: %w", err)
	}

	// Calculate risk for each pest/disease type
	assessments := []models.PestRiskAssessment{}

	// 1. Olive Fruit Fly (Bactrocera oleae)
	flyRisk := s.calculateOliveFlyRisk(&weather, &parcel)
	assessments = append(assessments, flyRisk)

	// 2. Peacock Spot (Spilocaea oleagina)
	spotRisk := s.calculatePeacockSpotRisk(&weather, &parcel)
	assessments = append(assessments, spotRisk)

	// Save assessments to database
	for i := range assessments {
		// Check if assessment already exists for today
		var existing models.PestRiskAssessment
		today := time.Now().Truncate(24 * time.Hour)
		err := initializers.DB.Where(
			"parcel_id = ? AND DATE(date) = DATE(?) AND pest_type = ?",
			parcelID, today, assessments[i].PestType,
		).First(&existing).Error

		if err == nil {
			// Update existing
			assessments[i].ID = existing.ID
			initializers.DB.Save(&assessments[i])
		} else {
			// Create new
			initializers.DB.Create(&assessments[i])
		}
	}

	return assessments, nil
}

// calculateOliveFlyRisk calculates risk for Bactrocera oleae
// Risk factors:
// - Temperature: Optimum 20-30°C, low activity <15°C or >32°C
// - Humidity: High humidity (>60%) favors development
// - Precipitation: Recent rain can reduce adult population
// NOTE: Only relevant during fruiting period (June-October)
func (s *PestControlService) calculateOliveFlyRisk(weather *models.WeatherData, parcel *models.Parcel) models.PestRiskAssessment {
	assessment := models.PestRiskAssessment{
		ParcelID:      weather.ParcelID,
		Date:          models.DateOnly{Time: time.Now()},
		PestType:      models.PestTypeOliveFly,
		Temperature:   weather.Temperature,
		Humidity:      float64(weather.Humidity),
		Precipitation: weather.Precipitation,
	}

	// Check if we're in fruiting period - olive fruit fly only attacks fruit!
	month := time.Now().Month()
	isFruitingPeriod := month >= time.May && month <= time.October

	// If no fruit present, pest is not relevant
	if !isFruitingPeriod {
		assessment.RiskScore = 0
		assessment.RiskLevel = models.RiskLevelNone
		assessment.AlertMessage = "Not applicable - no fruit present (dormant/post-harvest period)."
		assessment.Recommendations = "{}"
		return assessment
	}

	riskScore := 0.0

	// Temperature factor (0-40 points)
	temp := weather.Temperature
	if temp >= 20 && temp <= 30 {
		// Optimal range - highest risk
		riskScore += 40
	} else if temp >= 15 && temp < 20 {
		// Suboptimal but still active
		riskScore += 25
	} else if temp > 30 && temp <= 35 {
		// Hot - reduced activity
		riskScore += 15
	} else {
		// Too cold or too hot - minimal risk
		riskScore += 5
	}

	// Humidity factor (0-30 points)
	humidity := weather.Humidity
	if humidity > 70 {
		riskScore += 30
	} else if humidity > 60 {
		riskScore += 20
	} else if humidity > 50 {
		riskScore += 10
	} else {
		riskScore += 5
	}

	// Precipitation factor (0-20 points)
	// Recent heavy rain reduces fly population
	if weather.Precipitation > 20 {
		riskScore += 5 // Heavy rain disrupts activity
	} else if weather.Precipitation > 5 {
		riskScore += 10 // Light rain
	} else {
		riskScore += 20 // Dry conditions favor flies
	}

	// Growth stage factor (0-10 points)
	// Peak risk varies within fruiting period
	if month >= time.July && month <= time.September {
		riskScore += 10 // Peak fruiting - highest risk
	} else {
		riskScore += 5 // Early fruit set or late season
	}

	assessment.RiskScore = riskScore

	// Determine risk level
	if riskScore >= 80 {
		assessment.RiskLevel = models.RiskLevelCritical
		assessment.AlertMessage = "Critical risk: Immediate intervention required. Monitor traps daily."
		assessment.Recommendations = s.getOliveFlyRecommendations("critical")
	} else if riskScore >= 60 {
		assessment.RiskLevel = models.RiskLevelHigh
		assessment.AlertMessage = "High risk: Plan treatment within 2-3 days. Increase trap monitoring."
		assessment.Recommendations = s.getOliveFlyRecommendations("high")
	} else if riskScore >= 40 {
		assessment.RiskLevel = models.RiskLevelModerate
		assessment.AlertMessage = "Moderate risk: Monitor closely. Check traps weekly."
		assessment.Recommendations = s.getOliveFlyRecommendations("moderate")
	} else if riskScore >= 20 {
		assessment.RiskLevel = models.RiskLevelLow
		assessment.AlertMessage = "Low risk: Continue routine monitoring."
		assessment.Recommendations = s.getOliveFlyRecommendations("low")
	} else {
		assessment.RiskLevel = models.RiskLevelNone
		assessment.AlertMessage = "Minimal risk: Weather conditions unfavorable for fly activity."
		assessment.Recommendations = "{}"
	}

	return assessment
}

// calculatePeacockSpotRisk calculates risk for Spilocaea oleagina
// Risk factors:
// - Temperature: Optimum 10-25°C for spore germination
// - Humidity: Requires free moisture (rain, dew, humidity >85%)
// - Wetness duration: 6-12 hours with favorable temperature
func (s *PestControlService) calculatePeacockSpotRisk(weather *models.WeatherData, parcel *models.Parcel) models.PestRiskAssessment {
	assessment := models.PestRiskAssessment{
		ParcelID:      weather.ParcelID,
		Date:          models.DateOnly{Time: time.Now()},
		PestType:      models.PestTypePeacockSpot,
		Temperature:   weather.Temperature,
		Humidity:      float64(weather.Humidity),
		Precipitation: weather.Precipitation,
	}

	riskScore := 0.0

	// Temperature factor (0-35 points)
	temp := weather.Temperature
	if temp >= 10 && temp <= 20 {
		// Optimal for infection
		riskScore += 35
	} else if temp > 20 && temp <= 25 {
		// Still favorable
		riskScore += 25
	} else if temp > 5 && temp < 10 {
		// Marginal
		riskScore += 15
	} else {
		// Unfavorable
		riskScore += 5
	}

	// Wetness/humidity factor (0-40 points)
	humidity := weather.Humidity
	precipitation := weather.Precipitation

	if precipitation > 5 || humidity > 90 {
		// Free moisture present - highest risk
		riskScore += 40
	} else if precipitation > 1 || humidity > 80 {
		// High moisture
		riskScore += 30
	} else if humidity > 70 {
		// Moderate moisture
		riskScore += 20
	} else {
		// Dry conditions
		riskScore += 5
	}

	// Season factor (0-15 points)
	// Autumn and spring are critical infection periods
	month := time.Now().Month()
	if month >= time.September && month <= time.November {
		riskScore += 15 // Autumn - peak infection period
	} else if month >= time.March && month <= time.May {
		riskScore += 12 // Spring - secondary infection period
	} else if month >= time.December || month <= time.February {
		riskScore += 8 // Winter - slower but still active
	} else {
		riskScore += 3 // Summer - less favorable
	}

	// Forecast factor (0-10 points)
	// Check if rain is expected in next 24h
	if weather.RainNext24h > 5 {
		riskScore += 10 // Rain forecast increases risk
	} else if weather.RainNext24h > 0 {
		riskScore += 5
	}

	assessment.RiskScore = riskScore

	// Determine risk level
	if riskScore >= 75 {
		assessment.RiskLevel = models.RiskLevelCritical
		assessment.AlertMessage = "Critical infection risk: Apply preventive treatment immediately."
		assessment.Recommendations = s.getPeacockSpotRecommendations("critical")
	} else if riskScore >= 55 {
		assessment.RiskLevel = models.RiskLevelHigh
		assessment.AlertMessage = "High infection risk: Plan preventive treatment within 24-48 hours."
		assessment.Recommendations = s.getPeacockSpotRecommendations("high")
	} else if riskScore >= 35 {
		assessment.RiskLevel = models.RiskLevelModerate
		assessment.AlertMessage = "Moderate risk: Monitor weather closely and prepare for treatment."
		assessment.Recommendations = s.getPeacockSpotRecommendations("moderate")
	} else if riskScore >= 15 {
		assessment.RiskLevel = models.RiskLevelLow
		assessment.AlertMessage = "Low risk: Continue routine monitoring."
		assessment.Recommendations = s.getPeacockSpotRecommendations("low")
	} else {
		assessment.RiskLevel = models.RiskLevelNone
		assessment.AlertMessage = "Minimal risk: Weather conditions unfavorable for infection."
		assessment.Recommendations = "{}"
	}

	return assessment
}

// getOliveFlyRecommendations returns treatment recommendations as JSON
func (s *PestControlService) getOliveFlyRecommendations(riskLevel string) string {
	recommendations := map[string]interface{}{}

	switch riskLevel {
	case "critical", "high":
		recommendations["monitoring"] = []string{
			"Check McPhail or Olipe traps daily",
			"Monitor fruit for oviposition punctures",
			"Record fly counts and trends",
		}
		recommendations["chemical"] = []string{
			"Dimethoate or Spinosad bait spray",
			"Attract-and-kill formulations",
			"Follow PHI (pre-harvest interval) strictly",
		}
		recommendations["biological"] = []string{
			"Mass trapping with pheromone traps",
			"Kaolin clay (Surround WP) as repellent",
			"Release of parasitoid wasps (if available)",
		}
		recommendations["cultural"] = []string{
			"Early harvest if possible",
			"Remove fallen and infested fruits",
			"Maintain ground cover to reduce emergence",
		}
	case "moderate":
		recommendations["monitoring"] = []string{
			"Check traps twice weekly",
			"Scout for early signs of infestation",
		}
		recommendations["preventive"] = []string{
			"Prepare spray equipment",
			"Source approved insecticides",
			"Install additional traps if needed",
		}
	case "low":
		recommendations["routine"] = []string{
			"Weekly trap checks",
			"Maintain trap placement",
			"Record weather patterns",
		}
	}

	jsonData, _ := json.Marshal(recommendations)
	return string(jsonData)
}

// getPeacockSpotRecommendations returns treatment recommendations as JSON
func (s *PestControlService) getPeacockSpotRecommendations(riskLevel string) string {
	recommendations := map[string]interface{}{}

	switch riskLevel {
	case "critical", "high":
		recommendations["chemical"] = []string{
			"Copper-based fungicides (Bordeaux mixture, copper hydroxide)",
			"Apply before expected rain if possible",
			"Ensure good coverage of leaves and branches",
		}
		recommendations["timing"] = []string{
			"Pre-infection treatment is most effective",
			"Do not apply if rain is imminent (within 2-4 hours)",
			"Repeat after heavy rain (>20mm)",
		}
		recommendations["monitoring"] = []string{
			"Inspect leaves for circular spots",
			"Check underside of leaves for spores",
			"Focus on shaded, humid areas of orchard",
		}
	case "moderate":
		recommendations["preventive"] = []string{
			"Prepare fungicide if infection period expected",
			"Monitor weather forecast closely",
			"Inspect susceptible trees weekly",
		}
		recommendations["cultural"] = []string{
			"Improve air circulation (pruning)",
			"Avoid overhead irrigation",
			"Remove heavily infected branches",
		}
	case "low":
		recommendations["routine"] = []string{
			"Continue routine scouting",
			"Maintain good orchard hygiene",
			"Plan autumn/spring treatments",
		}
	}

	jsonData, _ := json.Marshal(recommendations)
	return string(jsonData)
}

// GetRiskHistory retrieves historical risk assessments for a parcel
func (s *PestControlService) GetRiskHistory(parcelID uint, pestType models.PestType, days int) ([]models.PestRiskAssessment, error) {
	var assessments []models.PestRiskAssessment
	startDate := time.Now().AddDate(0, 0, -days)

	query := initializers.DB.Where("parcel_id = ? AND date >= ?", parcelID, startDate)

	if pestType != "" {
		query = query.Where("pest_type = ?", pestType)
	}

	err := query.Order("date DESC").Find(&assessments).Error
	return assessments, err
}

// LogTreatment records a pest control treatment
func (s *PestControlService) LogTreatment(treatment *models.TreatmentLog) error {
	return initializers.DB.Create(treatment).Error
}

// GetTreatmentHistory retrieves treatment logs for a parcel
func (s *PestControlService) GetTreatmentHistory(parcelID uint, startDate, endDate time.Time) ([]models.TreatmentLog, error) {
	var treatments []models.TreatmentLog
	err := initializers.DB.Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Order("date DESC").
		Find(&treatments).Error
	return treatments, err
}

// LogMonitoring records a manual pest monitoring observation
func (s *PestControlService) LogMonitoring(monitoring *models.PestMonitoring) error {
	return initializers.DB.Create(monitoring).Error
}

// GetMonitoringHistory retrieves monitoring logs for a parcel
func (s *PestControlService) GetMonitoringHistory(parcelID uint, pestType models.PestType, days int) ([]models.PestMonitoring, error) {
	var monitoring []models.PestMonitoring
	startDate := time.Now().AddDate(0, 0, -days)

	query := initializers.DB.Where("parcel_id = ? AND date >= ?", parcelID, startDate)

	if pestType != "" {
		query = query.Where("pest_type = ?", pestType)
	}

	err := query.Order("date DESC").Find(&monitoring).Error
	return monitoring, err
}
