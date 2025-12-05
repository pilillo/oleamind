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

// CalculateRiskForecast calculates pest/disease risk for the next 7 days based on weather forecast
func (s *PestControlService) CalculateRiskForecast(parcelID uint) ([]models.ForecastRiskPrediction, error) {
	// Get the 7-day forecast
	weatherService := NewWeatherService()
	forecasts, err := weatherService.GetDailyForecasts(parcelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get forecasts: %w", err)
	}

	if len(forecasts) == 0 {
		return nil, fmt.Errorf("no forecast data available")
	}

	// Get the parcel
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("parcel not found: %w", err)
	}

	// Delete existing predictions for this parcel
	initializers.DB.Where("parcel_id = ?", parcelID).Delete(&models.ForecastRiskPrediction{})

	var predictions []models.ForecastRiskPrediction
	now := time.Now()

	// Track previous day's risk for trend calculation
	var prevFlyRisk, prevSpotRisk float64

	for i, forecast := range forecasts {
		// Calculate confidence (decreases with days ahead)
		confidence := 100.0 - float64(forecast.DaysAhead)*10
		if confidence < 40 {
			confidence = 40 // Minimum confidence
		}

		// Calculate Olive Fly risk for this day
		flyRisk := s.calculateOliveFlyRiskFromForecast(&forecast, &parcel)
		flyTrend := s.calculateTrend(prevFlyRisk, flyRisk.RiskScore, i)
		flyRisk.Confidence = confidence
		flyRisk.RiskTrend = flyTrend
		flyRisk.ForecastDate = forecast.ForecastDate
		flyRisk.DaysAhead = forecast.DaysAhead
		flyRisk.TempAvg = forecast.TempAvg
		flyRisk.HumidityAvg = forecast.HumidityAvg
		flyRisk.PrecipitationMm = forecast.PrecipitationSum
		flyRisk.FetchedAt = now
		prevFlyRisk = flyRisk.RiskScore

		// Calculate Peacock Spot risk for this day
		spotRisk := s.calculatePeacockSpotRiskFromForecast(&forecast, &parcel)
		spotTrend := s.calculateTrend(prevSpotRisk, spotRisk.RiskScore, i)
		spotRisk.Confidence = confidence
		spotRisk.RiskTrend = spotTrend
		spotRisk.ForecastDate = forecast.ForecastDate
		spotRisk.DaysAhead = forecast.DaysAhead
		spotRisk.TempAvg = forecast.TempAvg
		spotRisk.HumidityAvg = forecast.HumidityAvg
		spotRisk.PrecipitationMm = forecast.PrecipitationSum
		spotRisk.FetchedAt = now
		prevSpotRisk = spotRisk.RiskScore

		// Save predictions to database
		if err := initializers.DB.Create(&flyRisk).Error; err == nil {
			predictions = append(predictions, flyRisk)
		}
		if err := initializers.DB.Create(&spotRisk).Error; err == nil {
			predictions = append(predictions, spotRisk)
		}
	}

	return predictions, nil
}

// calculateOliveFlyRiskFromForecast calculates fly risk from forecast data
func (s *PestControlService) calculateOliveFlyRiskFromForecast(forecast *models.DailyForecast, parcel *models.Parcel) models.ForecastRiskPrediction {
	prediction := models.ForecastRiskPrediction{
		ParcelID: forecast.ParcelID,
		PestType: models.PestTypeOliveFly,
	}

	// Check if we're in fruiting period
	month := forecast.ForecastDate.Time.Month()
	isFruitingPeriod := month >= time.May && month <= time.October

	if !isFruitingPeriod {
		prediction.RiskScore = 0
		prediction.RiskLevel = models.RiskLevelNone
		prediction.AlertMessage = "Not applicable - no fruit present (dormant/post-harvest period)."
		prediction.Recommendations = "{}"
		return prediction
	}

	riskScore := 0.0

	// Temperature factor (0-40 points) - use average temp
	temp := forecast.TempAvg
	if temp >= 20 && temp <= 30 {
		riskScore += 40
	} else if temp >= 15 && temp < 20 {
		riskScore += 25
	} else if temp > 30 && temp <= 35 {
		riskScore += 15
	} else {
		riskScore += 5
	}

	// Humidity factor (0-30 points) - use average humidity
	humidity := forecast.HumidityAvg
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
	precipitation := forecast.PrecipitationSum
	if precipitation > 20 {
		riskScore += 5 // Heavy rain disrupts activity
	} else if precipitation > 5 {
		riskScore += 10 // Light rain
	} else {
		riskScore += 20 // Dry conditions favor flies
	}

	// Growth stage factor (0-10 points)
	if month >= time.July && month <= time.September {
		riskScore += 10 // Peak fruiting
	} else {
		riskScore += 5
	}

	prediction.RiskScore = riskScore
	prediction.RiskLevel = s.getRiskLevelFromScore(riskScore, "olive_fly")
	prediction.AlertMessage = s.getAlertMessageForRisk(prediction.RiskLevel, "olive_fly", forecast.DaysAhead)
	prediction.Recommendations = s.getOliveFlyRecommendations(string(prediction.RiskLevel))

	return prediction
}

// calculatePeacockSpotRiskFromForecast calculates peacock spot risk from forecast data
func (s *PestControlService) calculatePeacockSpotRiskFromForecast(forecast *models.DailyForecast, parcel *models.Parcel) models.ForecastRiskPrediction {
	prediction := models.ForecastRiskPrediction{
		ParcelID: forecast.ParcelID,
		PestType: models.PestTypePeacockSpot,
	}

	riskScore := 0.0

	// Temperature factor (0-35 points)
	temp := forecast.TempAvg
	if temp >= 10 && temp <= 20 {
		riskScore += 35
	} else if temp > 20 && temp <= 25 {
		riskScore += 25
	} else if temp > 5 && temp < 10 {
		riskScore += 15
	} else {
		riskScore += 5
	}

	// Wetness/humidity factor (0-40 points)
	humidity := forecast.HumidityMax
	precipitation := forecast.PrecipitationSum

	if precipitation > 5 || humidity > 90 {
		riskScore += 40
	} else if precipitation > 1 || humidity > 80 {
		riskScore += 30
	} else if humidity > 70 {
		riskScore += 20
	} else {
		riskScore += 5
	}

	// Season factor (0-15 points)
	month := forecast.ForecastDate.Time.Month()
	if month >= time.September && month <= time.November {
		riskScore += 15 // Autumn peak
	} else if month >= time.March && month <= time.May {
		riskScore += 12 // Spring
	} else if month >= time.December || month <= time.February {
		riskScore += 8 // Winter
	} else {
		riskScore += 3 // Summer
	}

	// Rain probability factor (0-10 points)
	if forecast.PrecipitationProb > 70 {
		riskScore += 10
	} else if forecast.PrecipitationProb > 40 {
		riskScore += 5
	}

	prediction.RiskScore = riskScore
	prediction.RiskLevel = s.getRiskLevelFromScore(riskScore, "peacock_spot")
	prediction.AlertMessage = s.getAlertMessageForRisk(prediction.RiskLevel, "peacock_spot", forecast.DaysAhead)
	prediction.Recommendations = s.getPeacockSpotRecommendations(string(prediction.RiskLevel))

	return prediction
}

// getRiskLevelFromScore converts a numeric score to a risk level
func (s *PestControlService) getRiskLevelFromScore(score float64, pestType string) models.RiskLevel {
	if pestType == "peacock_spot" {
		// Peacock spot uses different thresholds
		if score >= 75 {
			return models.RiskLevelCritical
		} else if score >= 55 {
			return models.RiskLevelHigh
		} else if score >= 35 {
			return models.RiskLevelModerate
		} else if score >= 15 {
			return models.RiskLevelLow
		}
		return models.RiskLevelNone
	}

	// Olive fly thresholds
	if score >= 80 {
		return models.RiskLevelCritical
	} else if score >= 60 {
		return models.RiskLevelHigh
	} else if score >= 40 {
		return models.RiskLevelModerate
	} else if score >= 20 {
		return models.RiskLevelLow
	}
	return models.RiskLevelNone
}

// calculateTrend determines if risk is increasing, stable, or decreasing
func (s *PestControlService) calculateTrend(prevScore, currentScore float64, dayIndex int) string {
	if dayIndex == 0 {
		return "stable"
	}

	diff := currentScore - prevScore
	if diff > 10 {
		return "increasing"
	} else if diff < -10 {
		return "decreasing"
	}
	return "stable"
}

// getAlertMessageForRisk generates an alert message for forecast risk
func (s *PestControlService) getAlertMessageForRisk(level models.RiskLevel, pestType string, daysAhead int) string {
	dayLabel := "today"
	if daysAhead == 1 {
		dayLabel = "tomorrow"
	} else if daysAhead > 1 {
		dayLabel = fmt.Sprintf("in %d days", daysAhead)
	}

	pestName := "Olive Fly"
	if pestType == "peacock_spot" {
		pestName = "Peacock Spot"
	}

	switch level {
	case models.RiskLevelCritical:
		return fmt.Sprintf("Critical %s risk expected %s. Plan immediate intervention.", pestName, dayLabel)
	case models.RiskLevelHigh:
		return fmt.Sprintf("High %s risk expected %s. Prepare treatment.", pestName, dayLabel)
	case models.RiskLevelModerate:
		return fmt.Sprintf("Moderate %s risk expected %s. Monitor closely.", pestName, dayLabel)
	case models.RiskLevelLow:
		return fmt.Sprintf("Low %s risk expected %s.", pestName, dayLabel)
	default:
		return fmt.Sprintf("Minimal %s risk expected %s.", pestName, dayLabel)
	}
}

// GetRiskForecast retrieves cached risk forecast predictions
func (s *PestControlService) GetRiskForecast(parcelID uint, pestType models.PestType) ([]models.ForecastRiskPrediction, error) {
	var predictions []models.ForecastRiskPrediction

	query := initializers.DB.Where("parcel_id = ?", parcelID)

	if pestType != "" {
		query = query.Where("pest_type = ?", pestType)
	}

	err := query.Order("days_ahead ASC").Find(&predictions).Error

	// Check if we need to refresh (older than 6 hours or empty)
	if len(predictions) == 0 || (len(predictions) > 0 && time.Since(predictions[0].FetchedAt) > 6*time.Hour) {
		freshPredictions, err := s.CalculateRiskForecast(parcelID)
		if err == nil && len(freshPredictions) > 0 {
			// Filter by pest type if specified
			if pestType != "" {
				var filtered []models.ForecastRiskPrediction
				for _, p := range freshPredictions {
					if p.PestType == pestType {
						filtered = append(filtered, p)
					}
				}
				return filtered, nil
			}
			return freshPredictions, nil
		}
	}

	return predictions, err
}

// GetRiskSummary returns a summary of risk trends for all pests
type RiskForecastSummary struct {
	ParcelID          uint                        `json:"parcel_id"`
	ParcelName        string                      `json:"parcel_name"`
	GeneratedAt       time.Time                   `json:"generated_at"`
	OliveFlyForecast  []DailyRiskSummary          `json:"olive_fly_forecast"`
	PeacockSpotForecast []DailyRiskSummary        `json:"peacock_spot_forecast"`
	Alerts            []string                    `json:"alerts"`
	RecommendedActions []string                   `json:"recommended_actions"`
}

type DailyRiskSummary struct {
	Date       string  `json:"date"`
	DaysAhead  int     `json:"days_ahead"`
	RiskScore  float64 `json:"risk_score"`
	RiskLevel  string  `json:"risk_level"`
	RiskTrend  string  `json:"risk_trend"`
	Confidence float64 `json:"confidence"`
}

// GetRiskForecastSummary returns a comprehensive summary for display
func (s *PestControlService) GetRiskForecastSummary(parcelID uint) (*RiskForecastSummary, error) {
	predictions, err := s.GetRiskForecast(parcelID, "")
	if err != nil {
		return nil, err
	}

	// Get parcel name
	var parcel models.Parcel
	initializers.DB.First(&parcel, parcelID)

	summary := &RiskForecastSummary{
		ParcelID:    parcelID,
		ParcelName:  parcel.Name,
		GeneratedAt: time.Now(),
		Alerts:      []string{},
		RecommendedActions: []string{},
	}

	for _, p := range predictions {
		dailySummary := DailyRiskSummary{
			Date:       p.ForecastDate.Time.Format("2006-01-02"),
			DaysAhead:  p.DaysAhead,
			RiskScore:  p.RiskScore,
			RiskLevel:  string(p.RiskLevel),
			RiskTrend:  p.RiskTrend,
			Confidence: p.Confidence,
		}

		if p.PestType == models.PestTypeOliveFly {
			summary.OliveFlyForecast = append(summary.OliveFlyForecast, dailySummary)
		} else if p.PestType == models.PestTypePeacockSpot {
			summary.PeacockSpotForecast = append(summary.PeacockSpotForecast, dailySummary)
		}

		// Generate alerts for high/critical risks
		if p.RiskLevel == models.RiskLevelCritical || p.RiskLevel == models.RiskLevelHigh {
			summary.Alerts = append(summary.Alerts, p.AlertMessage)
		}
	}

	// Generate recommended actions based on forecast
	summary.RecommendedActions = s.generateRecommendedActions(summary)

	return summary, nil
}

// generateRecommendedActions creates actionable recommendations based on forecast
func (s *PestControlService) generateRecommendedActions(summary *RiskForecastSummary) []string {
	actions := []string{}
	
	// Check for upcoming high/critical olive fly risk
	for _, day := range summary.OliveFlyForecast {
		if day.DaysAhead <= 3 && (day.RiskLevel == "high" || day.RiskLevel == "critical") {
			if day.RiskTrend == "increasing" {
				actions = append(actions, fmt.Sprintf("Olive Fly: Risk increasing - prepare Spinosad or Dimethoate spray for day %d", day.DaysAhead))
			} else {
				actions = append(actions, fmt.Sprintf("Olive Fly: High risk on day %d - check McPhail traps and consider treatment", day.DaysAhead))
			}
			break // Only add one fly action
		}
	}

	// Check for upcoming peacock spot risk
	for _, day := range summary.PeacockSpotForecast {
		if day.DaysAhead <= 3 && (day.RiskLevel == "high" || day.RiskLevel == "critical") {
			actions = append(actions, fmt.Sprintf("Peacock Spot: Infection risk on day %d - apply copper fungicide before rain", day.DaysAhead))
			break
		}
	}

	// Check for treatment windows (low risk, dry days)
	for _, day := range summary.OliveFlyForecast {
		if day.DaysAhead >= 1 && day.DaysAhead <= 3 && day.RiskLevel == "low" {
			actions = append(actions, fmt.Sprintf("Good treatment window on day %d - favorable conditions for spray application", day.DaysAhead))
			break
		}
	}

	if len(actions) == 0 {
		actions = append(actions, "Continue routine monitoring - no immediate action required")
	}

	return actions
}
