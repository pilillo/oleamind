package services

import (
	"fmt"
	"log"
	"log/slog"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

const (
	// Default crop coefficients for olive trees by growth stage
	KcDormant          = 0.50 // Winter dormancy
	KcFlowering        = 0.65 // Spring flowering
	KcFruitSet         = 0.70 // Early fruit development
	KcFruitDevelopment = 0.75 // Active fruit growth
	KcHarvest          = 0.65 // Pre-harvest
	KcPostHarvest      = 0.55 // After harvest, preparing for dormancy

	// Water stress thresholds (as % of available water capacity depleted)
	StressNone     = 0.30 // < 30% depleted
	StressMild     = 0.50 // 30-50% depleted
	StressModerate = 0.70 // 50-70% depleted
	StressSevere   = 1.00 // > 70% depleted

	// Irrigation triggers
	IrrigationThresholdNormal   = 0.50 // Irrigate when 50% of AWC depleted
	IrrigationThresholdCritical = 0.40 // More frequent for critical stages

	// Deficit irrigation strategies
	DeficitNone      = "none"      // Full irrigation (100% ETc)
	DeficitRegulated = "regulated" // Controlled deficit (60-80% ETc) in non-critical stages
	DeficitSustained = "sustained" // Consistent deficit (50-70% ETc) throughout season
)

type IrrigationService struct {
	DB *gorm.DB
}

func NewIrrigationService() *IrrigationService {
	return &IrrigationService{DB: initializers.DB}
}

// CalculateRecommendation calculates irrigation recommendation for a parcel
func (s *IrrigationService) CalculateRecommendation(parcelID uint) (*models.IrrigationRecommendation, error) {
	// Get weather data for the parcel (try to get latest first)
	var weather models.WeatherData
	err := s.DB.Where("parcel_id = ?", parcelID).
		Order("fetched_at DESC").
		First(&weather).Error

	if err != nil {
		// Return a default recommendation indicating weather data is needed
		// This allows the frontend to display a helpful message
		return &models.IrrigationRecommendation{
			ParcelID:        parcelID,
			CalculationDate: time.Now(),
			ShouldIrrigate:  false,
			UrgencyLevel:    "none",
			WeatherForecast: "Weather data not available. Please wait for weather data to be fetched.",
		}, nil
	}

	// Get or create soil profile (use defaults if not set)
	soilProfile, err := s.getOrCreateSoilProfile(parcelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get soil profile: %w", err)
	}

	// Get irrigation system info (use defaults if not set)
	irrigationSystem, err := s.getOrCreateIrrigationSystem(parcelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get irrigation system: %w", err)
	}

	// Get recent irrigation events (last 7 days)
	var recentIrrigations []models.IrrigationEvent
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	s.DB.Where("parcel_id = ? AND date >= ?", parcelID, sevenDaysAgo).
		Order("date DESC").
		Find(&recentIrrigations)

	// Get previous recommendation for cumulative tracking
	var prevRecommendation models.IrrigationRecommendation
	s.DB.Where("parcel_id = ?", parcelID).
		Order("calculation_date DESC").
		First(&prevRecommendation)

	// Determine current growth stage (simplified - based on month)
	growthStage := s.determineGrowthStage(time.Now())
	kc := s.getCropCoefficient(growthStage)

	// Calculate water balance
	recommendation := &models.IrrigationRecommendation{
		ParcelID:        parcelID,
		CalculationDate: time.Now(),
		ET0:             weather.ET0,
		Kc:              kc,
		GrowthStage:     growthStage,
	}

	// ETc = ET0 × Kc (crop evapotranspiration)
	recommendation.ETc = recommendation.ET0 * recommendation.Kc

	// Get rainfall from weather (next 24h forecast)
	recommendation.Rainfall = weather.RainNext24h

	// Calculate effective rainfall (accounting for runoff based on slope)
	runoffFactor := 1.0 - (soilProfile.Slope * 0.01) // Simple runoff model
	if runoffFactor < 0.5 {
		runoffFactor = 0.5 // At least 50% is effective even on steep slopes
	}
	recommendation.EffectiveRainfall = recommendation.Rainfall * runoffFactor

	// Sum irrigation applied in last 24 hours
	yesterday := time.Now().AddDate(0, 0, -1)
	var irrigationSum float64
	for _, irr := range recentIrrigations {
		if irr.Date.After(yesterday) {
			irrigationSum += irr.WaterAmount
		}
	}
	recommendation.IrrigationApplied = irrigationSum

	// Water balance = (Rainfall + Irrigation) - ETc
	recommendation.WaterBalance = (recommendation.EffectiveRainfall + recommendation.IrrigationApplied) - recommendation.ETc

	// Cumulative deficit tracking
	recommendation.CumulativeDeficit = prevRecommendation.CumulativeDeficit
	if recommendation.WaterBalance < 0 {
		recommendation.CumulativeDeficit += -recommendation.WaterBalance
	} else {
		// Surplus reduces deficit
		recommendation.CumulativeDeficit -= recommendation.WaterBalance
		if recommendation.CumulativeDeficit < 0 {
			recommendation.CumulativeDeficit = 0
		}
	}

	// Estimate soil moisture as % of available water capacity
	depletionRatio := recommendation.CumulativeDeficit / soilProfile.AvailableWaterCapacity
	if depletionRatio > 1.0 {
		depletionRatio = 1.0
	}
	recommendation.SoilMoistureEstimate = (1.0 - depletionRatio) * 100

	// Determine stress level
	recommendation.StressLevel = s.getStressLevel(depletionRatio)

	// Determine if irrigation is needed
	irrigationThreshold := IrrigationThresholdNormal
	if growthStage == "flowering" || growthStage == "fruit_set" {
		irrigationThreshold = IrrigationThresholdCritical // More critical stages
	}

	recommendation.ShouldIrrigate = depletionRatio >= irrigationThreshold && recommendation.Rainfall < 5.0

	// Calculate recommended amount if irrigation is needed
	if recommendation.ShouldIrrigate {
		// Recommended amount = cumulative deficit (to refill to field capacity)
		// But adjusted by irrigation efficiency
		recommendation.RecommendedAmount = recommendation.CumulativeDeficit / (irrigationSystem.Efficiency / 100.0)

		// Cap at reasonable daily maximum (e.g., 15mm per day)
		if recommendation.RecommendedAmount > 15.0 {
			recommendation.RecommendedAmount = 15.0
		}

		// Convert to liters per tree (assuming tree spacing)
		// mm × tree_spacing² × 1000 = liters per tree
		treeSpacingM := irrigationSystem.TreeSpacing
		if treeSpacingM == 0 {
			treeSpacingM = 6.0 // Default 6m spacing for olive orchards
		}
		areaPerTree := treeSpacingM * treeSpacingM // m²
		recommendation.RecommendedLitersTree = recommendation.RecommendedAmount * areaPerTree

		// Determine urgency
		if depletionRatio >= StressSevere {
			recommendation.UrgencyLevel = "critical"
		} else if depletionRatio >= StressModerate {
			recommendation.UrgencyLevel = "high"
		} else if depletionRatio >= StressMild {
			recommendation.UrgencyLevel = "medium"
		} else {
			recommendation.UrgencyLevel = "low"
		}

		// Calculate next irrigation date (assuming this irrigation is applied)
		daysUntilNextIrrigation := recommendation.RecommendedAmount / recommendation.ETc
		recommendation.NextIrrigationDate = time.Now().AddDate(0, 0, int(daysUntilNextIrrigation))
	} else {
		recommendation.UrgencyLevel = "none"
		// Estimate when irrigation will be needed
		daysUntilNeeded := (soilProfile.AvailableWaterCapacity*irrigationThreshold - recommendation.CumulativeDeficit) / recommendation.ETc
		if daysUntilNeeded < 0 {
			daysUntilNeeded = 1
		}
		recommendation.NextIrrigationDate = time.Now().AddDate(0, 0, int(daysUntilNeeded))
	}

	// Weather forecast summary
	if weather.RainNext24h > 10 {
		recommendation.WeatherForecast = "Heavy rain expected - delay irrigation"
	} else if weather.RainNext24h > 5 {
		recommendation.WeatherForecast = "Moderate rain expected"
	} else if weather.RainNext24h > 0 {
		recommendation.WeatherForecast = "Light rain possible"
	} else {
		recommendation.WeatherForecast = "No significant rain forecasted"
	}

	// Apply deficit irrigation strategy if configured
	recommendation.DeficitStrategy = DeficitNone // Default to full irrigation
	recommendation.DeficitReduction = 0.0

	// Save recommendation
	if err := s.DB.Create(recommendation).Error; err != nil {
		slog.Warn("Failed to save irrigation recommendation", "error", err)
	} else {
		slog.Info("Irrigation recommendation calculated",
			"parcel_id", parcelID,
			"irrigate", recommendation.ShouldIrrigate,
			"amount_mm", recommendation.RecommendedAmount,
			"urgency", recommendation.UrgencyLevel,
		)
	}

	return recommendation, nil
}

// determineGrowthStage returns the current growth stage based on date (Northern Hemisphere)
func (s *IrrigationService) determineGrowthStage(date time.Time) string {
	month := date.Month()
	switch {
	case month >= time.December || month <= time.February:
		return "dormant" // Winter
	case month >= time.March && month <= time.April:
		return "flowering" // Spring flowering
	case month == time.May:
		return "fruit_set" // Early fruit development
	case month >= time.June && month <= time.September:
		return "fruit_development" // Active growth
	case month == time.October:
		return "harvest" // Harvest season
	case month == time.November:
		return "post_harvest" // Post-harvest recovery
	default:
		return "fruit_development"
	}
}

// getCropCoefficient returns the Kc value for a given growth stage
func (s *IrrigationService) getCropCoefficient(stage string) float64 {
	switch stage {
	case "dormant":
		return KcDormant
	case "flowering":
		return KcFlowering
	case "fruit_set":
		return KcFruitSet
	case "fruit_development":
		return KcFruitDevelopment
	case "harvest":
		return KcHarvest
	case "post_harvest":
		return KcPostHarvest
	default:
		return KcFruitDevelopment
	}
}

// getStressLevel returns the water stress level based on depletion ratio
func (s *IrrigationService) getStressLevel(depletionRatio float64) string {
	switch {
	case depletionRatio < StressNone:
		return "none"
	case depletionRatio < StressMild:
		return "mild"
	case depletionRatio < StressModerate:
		return "moderate"
	default:
		return "severe"
	}
}

// getOrCreateSoilProfile gets existing soil profile or creates default one
func (s *IrrigationService) getOrCreateSoilProfile(parcelID uint) (*models.SoilProfile, error) {
	var profile models.SoilProfile
	err := s.DB.Where("parcel_id = ?", parcelID).First(&profile).Error
	if err == nil {
		return &profile, nil
	}

	// Create default profile for Mediterranean clay-loam soil (typical for olives)
	profile = models.SoilProfile{
		ParcelID:               parcelID,
		SoilType:               "clay-loam",
		FieldCapacity:          25.0,  // %
		WiltingPoint:           12.0,  // %
		AvailableWaterCapacity: 150.0, // mm (for 1.2m root depth)
		RootDepth:              120.0, // cm (olive trees have deep roots)
		InfiltrationRate:       10.0,  // mm/hour
		Slope:                  5.0,   // % (moderate slope)
		OrganicMatter:          2.5,   // %
		Notes:                  "Default profile - please update with actual soil data",
	}

	if err := s.DB.Create(&profile).Error; err != nil {
		return nil, fmt.Errorf("failed to create default soil profile: %w", err)
	}

	log.Printf("✅ Created default soil profile for parcel %d", parcelID)
	return &profile, nil
}

// getOrCreateIrrigationSystem gets existing system info or creates default
func (s *IrrigationService) getOrCreateIrrigationSystem(parcelID uint) (*models.IrrigationSystem, error) {
	var system models.IrrigationSystem
	err := s.DB.Where("parcel_id = ?", parcelID).First(&system).Error
	if err == nil {
		return &system, nil
	}

	// Create default drip irrigation system (most common for olives)
	system = models.IrrigationSystem{
		ParcelID:       parcelID,
		SystemType:     "drip",
		Efficiency:     90.0, // % (drip irrigation is highly efficient)
		FlowRate:       4.0,  // L/hour per emitter
		EmitterSpacing: 50.0, // cm
		TreeSpacing:    6.0,  // meters (typical for olive orchards)
		Notes:          "Default drip system - please update with actual system specs",
	}

	if err := s.DB.Create(&system).Error; err != nil {
		return nil, fmt.Errorf("failed to create default irrigation system: %w", err)
	}

	slog.Info("Created default irrigation system", "parcel_id", parcelID)
	return &system, nil
}

// LogIrrigationEvent records an irrigation event
func (s *IrrigationService) LogIrrigationEvent(event *models.IrrigationEvent) error {
	if err := s.DB.Create(event).Error; err != nil {
		return fmt.Errorf("failed to log irrigation event: %w", err)
	}
	slog.Info("Logged irrigation event", "parcel_id", event.ParcelID, "amount_mm", event.WaterAmount)
	return nil
}

// GetIrrigationHistory returns irrigation events for a parcel within a date range
func (s *IrrigationService) GetIrrigationHistory(parcelID uint, startDate, endDate time.Time) ([]models.IrrigationEvent, error) {
	var events []models.IrrigationEvent
	err := s.DB.Where("parcel_id = ? AND date >= ? AND date <= ?", parcelID, startDate, endDate).
		Order("date DESC").
		Find(&events).Error
	return events, err
}

// GetWaterUsageStats calculates water usage statistics for a parcel
func (s *IrrigationService) GetWaterUsageStats(parcelID uint, startDate, endDate time.Time) (*models.WaterUsageStats, error) {
	var events []models.IrrigationEvent
	if err := s.DB.Where("parcel_id = ? AND date >= ? AND date <= ?", parcelID, startDate, endDate).
		Find(&events).Error; err != nil {
		return nil, err
	}

	stats := &models.WaterUsageStats{
		ParcelID:  parcelID,
		StartDate: startDate,
		EndDate:   endDate,
	}

	for _, event := range events {
		stats.TotalWaterApplied += event.WaterAmount
		stats.TotalCost += event.Cost
		stats.IrrigationEvents++
	}

	if stats.IrrigationEvents > 0 {
		stats.AverageWaterPerEvent = stats.TotalWaterApplied / float64(stats.IrrigationEvents)
	}

	// TODO: Calculate total rainfall and ET0 from weather data
	// TODO: Calculate water use efficiency

	return stats, nil
}
