package services

import (
	"fmt"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

type HarvestService struct{}

func NewHarvestService() *HarvestService {
	return &HarvestService{}
}

// LogHarvest records a harvest event
func (s *HarvestService) LogHarvest(harvest *models.HarvestLog) error {
	return initializers.DB.Create(harvest).Error
}

// GetHarvestHistory retrieves harvest logs for a parcel
func (s *HarvestService) GetHarvestHistory(parcelID uint, startDate, endDate time.Time) ([]models.HarvestLog, error) {
	var harvests []models.HarvestLog
	// Convert to beginning and end of day for proper comparison
	start := startDate.Truncate(24 * time.Hour)
	end := endDate.Add(24 * time.Hour).Truncate(24 * time.Hour)
	
	err := initializers.DB.Where("parcel_id = ? AND date >= ? AND date < ?", parcelID, start, end).
		Order("date DESC").
		Find(&harvests).Error
	return harvests, err
}

// GetAllHarvests retrieves all harvest logs with optional filters
func (s *HarvestService) GetAllHarvests(startDate, endDate time.Time, parcelID *uint) ([]models.HarvestLog, error) {
	var harvests []models.HarvestLog
	// Convert to beginning and end of day for proper comparison
	start := startDate.Truncate(24 * time.Hour)
	end := endDate.Add(24 * time.Hour).Truncate(24 * time.Hour)
	
	query := initializers.DB.Where("date >= ? AND date < ?", start, end)
	
	if parcelID != nil {
		query = query.Where("parcel_id = ?", *parcelID)
	}
	
	err := query.Order("date DESC").Find(&harvests).Error
	return harvests, err
}

// UpdateHarvest updates a harvest log
func (s *HarvestService) UpdateHarvest(harvestID uint, updates *models.HarvestLog) error {
	return initializers.DB.Model(&models.HarvestLog{}).Where("id = ?", harvestID).Updates(updates).Error
}

// DeleteHarvest removes a harvest log
func (s *HarvestService) DeleteHarvest(harvestID uint) error {
	return initializers.DB.Delete(&models.HarvestLog{}, harvestID).Error
}

// GetYieldStats calculates yield statistics for a parcel and year
func (s *HarvestService) GetYieldStats(parcelID uint, year int) (*models.YieldStats, error) {
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)

	var harvests []models.HarvestLog
	// Convert to beginning and end of day for proper comparison
	start := startDate.Truncate(24 * time.Hour)
	end := endDate.Add(24 * time.Hour).Truncate(24 * time.Hour)
	
	err := initializers.DB.Where("parcel_id = ? AND date >= ? AND date < ?", parcelID, start, end).
		Find(&harvests).Error
	if err != nil {
		return nil, err
	}

	stats := &models.YieldStats{
		ParcelID:   parcelID,
		ParcelName: parcel.Name,
		Year:       year,
	}

	if len(harvests) == 0 {
		return stats, nil
	}

	totalYield := 0.0
	totalRevenue := 0.0
	totalPrice := 0.0
	priceCount := 0
	qualitySum := 0
	qualityCount := 0

	qualityMap := map[string]int{
		"excellent": 4,
		"good":      3,
		"fair":      2,
		"poor":      1,
	}

	for _, h := range harvests {
		totalYield += h.QuantityKg
		totalRevenue += h.Revenue
		
		if h.PricePerKg > 0 {
			totalPrice += h.PricePerKg
			priceCount++
		}
		
		if q, ok := qualityMap[h.Quality]; ok {
			qualitySum += q
			qualityCount++
		}
	}

	stats.TotalYieldKg = totalYield
	stats.HarvestCount = len(harvests)
	stats.TotalRevenue = totalRevenue

	if parcel.Area > 0 {
		stats.YieldPerHectare = totalYield / parcel.Area
	}

	if parcel.TreesCount > 0 {
		stats.YieldPerTree = totalYield / float64(parcel.TreesCount)
	}

	if priceCount > 0 {
		stats.AveragePricePerKg = totalPrice / float64(priceCount)
	}

	if qualityCount > 0 {
		avgQuality := float64(qualitySum) / float64(qualityCount)
		reverseMap := map[int]string{4: "excellent", 3: "good", 2: "fair", 1: "poor"}
		stats.AverageQuality = reverseMap[int(avgQuality+0.5)] // Round to nearest
	}

	return stats, nil
}

// GetCostSummary calculates cost summary for a parcel
func (s *HarvestService) GetCostSummary(parcelID uint, startDate, endDate time.Time) (*models.CostSummary, error) {
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	summary := &models.CostSummary{
		ParcelID:   parcelID,
		ParcelName: parcel.Name,
		StartDate:  startDate.Format("2006-01-02"),
		EndDate:    endDate.Format("2006-01-02"),
	}

	// Operations cost
	var operationsCost float64
	initializers.DB.Model(&models.OperationLog{}).
		Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&operationsCost)
	summary.OperationsCost = operationsCost

	// Harvest cost
	var harvestCost float64
	initializers.DB.Model(&models.HarvestLog{}).
		Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&harvestCost)
	summary.HarvestCost = harvestCost

	// Treatment cost
	var treatmentCost float64
	initializers.DB.Model(&models.TreatmentLog{}).
		Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&treatmentCost)
	summary.TreatmentCost = treatmentCost

	// Irrigation cost (if tracked)
	var irrigationCost float64
	initializers.DB.Model(&models.IrrigationEvent{}).
		Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&irrigationCost)
	summary.IrrigationCost = irrigationCost

	// Total revenue from harvests
	var totalRevenue float64
	initializers.DB.Model(&models.HarvestLog{}).
		Where("parcel_id = ? AND date BETWEEN ? AND ?", parcelID, startDate, endDate).
		Select("COALESCE(SUM(revenue), 0)").
		Scan(&totalRevenue)
	summary.TotalRevenue = totalRevenue

	// Calculate totals
	summary.TotalCost = summary.OperationsCost + summary.HarvestCost + summary.TreatmentCost + summary.IrrigationCost
	summary.NetProfit = summary.TotalRevenue - summary.TotalCost

	if summary.TotalCost > 0 {
		summary.ROI = (summary.NetProfit / summary.TotalCost) * 100
	}

	return summary, nil
}

// CreateYieldPrediction creates a yield prediction for a parcel
func (s *HarvestService) CreateYieldPrediction(prediction *models.YieldPrediction) error {
	return initializers.DB.Create(prediction).Error
}

// UpdateYieldPrediction updates a yield prediction with actual results
func (s *HarvestService) UpdateYieldPrediction(predictionID uint, actualYield float64) error {
	var prediction models.YieldPrediction
	if err := initializers.DB.First(&prediction, predictionID).Error; err != nil {
		return err
	}

	prediction.ActualYieldKg = actualYield
	
	if prediction.PredictedYieldKg > 0 {
		prediction.Accuracy = (1 - abs(prediction.PredictedYieldKg-actualYield)/prediction.PredictedYieldKg) * 100
	}

	return initializers.DB.Save(&prediction).Error
}

// GetYieldPredictions retrieves yield predictions for a parcel
func (s *HarvestService) GetYieldPredictions(parcelID uint, year *int) ([]models.YieldPrediction, error) {
	var predictions []models.YieldPrediction
	query := initializers.DB.Where("parcel_id = ?", parcelID)
	
	if year != nil {
		query = query.Where("year = ?", *year)
	}
	
	err := query.Order("prediction_date DESC").Find(&predictions).Error
	return predictions, err
}

// PredictYieldFromHistory creates a prediction based on historical average
func (s *HarvestService) PredictYieldFromHistory(parcelID uint, targetYear int, yearsBack int) (*models.YieldPrediction, error) {
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	// Get historical yields
	var totalYield float64
	var yearCount int

	for i := 1; i <= yearsBack; i++ {
		year := targetYear - i
		stats, err := s.GetYieldStats(parcelID, year)
		if err == nil && stats.TotalYieldKg > 0 {
			totalYield += stats.TotalYieldKg
			yearCount++
		}
	}

	if yearCount == 0 {
		return nil, fmt.Errorf("no historical data available for prediction")
	}

	averageYield := totalYield / float64(yearCount)
	yieldPerTree := 0.0
	if parcel.TreesCount > 0 {
		yieldPerTree = averageYield / float64(parcel.TreesCount)
	}

	prediction := &models.YieldPrediction{
		ParcelID:              parcelID,
		Year:                  targetYear,
		PredictionDate:        time.Now(),
		PredictedYieldKg:      averageYield,
		PredictedYieldPerTree: yieldPerTree,
		Method:                "historical_average",
		ConfidenceLevel:       s.determineConfidence(yearCount),
		Notes:                 fmt.Sprintf("Based on %d years of historical data", yearCount),
	}

	return prediction, nil
}

func (s *HarvestService) determineConfidence(yearCount int) string {
	if yearCount >= 5 {
		return "high"
	} else if yearCount >= 3 {
		return "medium"
	}
	return "low"
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

