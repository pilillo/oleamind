package services

import (
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

type AnalyticsService struct{}

func NewAnalyticsService() *AnalyticsService {
	return &AnalyticsService{}
}

// YieldTrendData represents yearly yield statistics
type YieldTrendData struct {
	Year              int     `json:"year"`
	TotalYieldKg      float64 `json:"total_yield_kg"`
	YieldPerHectare   float64 `json:"yield_per_hectare"`
	YieldPerTree      float64 `json:"yield_per_tree"`
	AverageQuality    string  `json:"average_quality"`
	HarvestCount      int     `json:"harvest_count"`
	TotalRevenue      float64 `json:"total_revenue"`
	AveragePricePerKg float64 `json:"average_price_per_kg"`
}

// GetYieldTrends returns multi-year yield trends for a parcel
func (s *AnalyticsService) GetYieldTrends(parcelID uint, years int) ([]YieldTrendData, error) {
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	currentYear := time.Now().Year()
	trends := make([]YieldTrendData, 0, years)

	// Get harvest service to reuse existing logic
	harvestService := NewHarvestService()

	for i := 0; i < years; i++ {
		year := currentYear - i

		// Get yield stats for this year
		stats, err := harvestService.GetYieldStats(parcelID, year)
		if err != nil {
			// If no data for this year, skip it
			continue
		}

		trends = append(trends, YieldTrendData{
			Year:              year,
			TotalYieldKg:      stats.TotalYieldKg,
			YieldPerHectare:   stats.YieldPerHectare,
			YieldPerTree:      stats.YieldPerTree,
			AverageQuality:    stats.AverageQuality,
			HarvestCount:      stats.HarvestCount,
			TotalRevenue:      stats.TotalRevenue,
			AveragePricePerKg: stats.AveragePricePerKg,
		})
	}

	return trends, nil
}

// CostEfficiencyData represents cost per liter breakdown
type CostEfficiencyData struct {
	ParcelID       uint               `json:"parcel_id"`
	ParcelName     string             `json:"parcel_name"`
	TotalCosts     float64            `json:"total_costs"`
	TotalLitersOil float64            `json:"total_liters_oil"`
	CostPerLiter   float64            `json:"cost_per_liter"`
	CostBreakdown  map[string]float64 `json:"cost_breakdown"`
	BatchCount     int                `json:"batch_count"`
	StartDate      string             `json:"start_date"`
	EndDate        string             `json:"end_date"`
}

// GetCostEfficiency calculates cost per liter for parcels
func (s *AnalyticsService) GetCostEfficiency(startDate, endDate time.Time, parcelID *uint) ([]CostEfficiencyData, error) {
	var results []CostEfficiencyData

	// Get all parcels or specific parcel
	var parcels []models.Parcel
	query := initializers.DB.Select("id", "name")
	if parcelID != nil {
		query = query.Where("id = ?", *parcelID)
	}
	if err := query.Find(&parcels).Error; err != nil {
		return nil, err
	}

	for _, parcel := range parcels {
		efficiency := CostEfficiencyData{
			ParcelID:      parcel.ID,
			ParcelName:    parcel.Name,
			CostBreakdown: make(map[string]float64),
			StartDate:     startDate.Format("2006-01-02"),
			EndDate:       endDate.Format("2006-01-02"),
		}

		// 1. Operations costs
		var operationsCost float64
		initializers.DB.Model(&models.OperationLog{}).
			Where("parcel_id = ? AND date BETWEEN ? AND ?", parcel.ID, startDate, endDate).
			Select("COALESCE(SUM(cost), 0)").
			Scan(&operationsCost)
		efficiency.CostBreakdown["operations"] = operationsCost

		// 2. Harvest costs
		var harvestCost float64
		initializers.DB.Model(&models.HarvestLog{}).
			Where("parcel_id = ? AND harvest_date BETWEEN ? AND ?", parcel.ID,
				models.DateOnly{Time: startDate},
				models.DateOnly{Time: endDate}).
			Select("COALESCE(SUM(cost), 0)").
			Scan(&harvestCost)
		efficiency.CostBreakdown["harvest"] = harvestCost

		// 3. Irrigation costs (if tracked)
		var irrigationCost float64
		initializers.DB.Model(&models.IrrigationEvent{}).
			Where("parcel_id = ? AND event_date BETWEEN ? AND ?", parcel.ID, startDate, endDate).
			Select("COALESCE(SUM(cost), 0)").
			Scan(&irrigationCost)
		efficiency.CostBreakdown["irrigation"] = irrigationCost

		// 4. Get total olives from this parcel
		var totalOlives float64
		initializers.DB.Model(&models.OliveDelivery{}).
			Where("parcel_id = ? AND delivery_date BETWEEN ? AND ?", parcel.ID,
				models.DateOnly{Time: startDate},
				models.DateOnly{Time: endDate}).
			Select("COALESCE(SUM(quantity_kg), 0)").
			Scan(&totalOlives)

		// 5. Get oil produced from these deliveries
		// Link deliveries → batch_sources → batches
		var totalLiters float64
		var batchCount int64

		initializers.DB.Table("oil_batches").
			Joins("JOIN oil_batch_sources ON oil_batches.id = oil_batch_sources.oil_batch_id").
			Joins("JOIN olive_deliveries ON oil_batch_sources.olive_delivery_id = olive_deliveries.id").
			Where("olive_deliveries.parcel_id = ? AND olive_deliveries.delivery_date BETWEEN ? AND ?",
				parcel.ID,
				models.DateOnly{Time: startDate},
				models.DateOnly{Time: endDate}).
			Select("COALESCE(SUM(oil_batches.quantity_liters * oil_batch_sources.contribution_pct / 100), 0)").
			Scan(&totalLiters)

		initializers.DB.Table("oil_batches").
			Joins("JOIN oil_batch_sources ON oil_batches.id = oil_batch_sources.oil_batch_id").
			Joins("JOIN olive_deliveries ON oil_batch_sources.olive_delivery_id = olive_deliveries.id").
			Where("olive_deliveries.parcel_id = ? AND olive_deliveries.delivery_date BETWEEN ? AND ?",
				parcel.ID,
				models.DateOnly{Time: startDate},
				models.DateOnly{Time: endDate}).
			Distinct("oil_batches.id").
			Count(&batchCount)

		efficiency.TotalLitersOil = totalLiters
		efficiency.BatchCount = int(batchCount)

		// Calculate total costs
		efficiency.TotalCosts = operationsCost + harvestCost + irrigationCost

		// Calculate cost per liter
		if totalLiters > 0 {
			efficiency.CostPerLiter = efficiency.TotalCosts / totalLiters
		}

		// Only include parcels that have oil production data
		if totalLiters > 0 || efficiency.TotalCosts > 0 {
			results = append(results, efficiency)
		}
	}

	return results, nil
}

// ParcelComparisonData represents comparison metrics for a parcel
type ParcelComparisonData struct {
	ParcelID        uint    `json:"parcel_id"`
	ParcelName      string  `json:"parcel_name"`
	Area            float64 `json:"area"`
	TreesCount      int     `json:"trees_count"`
	YieldPerHectare float64 `json:"yield_per_hectare"`
	CostPerLiter    float64 `json:"cost_per_liter"`
	AverageQuality  string  `json:"average_quality"`
	WaterUsage      float64 `json:"water_usage_m3"`
	TotalRevenue    float64 `json:"total_revenue"`
	NetProfit       float64 `json:"net_profit"`
	ROI             float64 `json:"roi"`
}

// GetParcelComparison returns comparison metrics for selected parcels
func (s *AnalyticsService) GetParcelComparison(parcelIDs []uint, year int) ([]ParcelComparisonData, error) {
	if len(parcelIDs) == 0 {
		return []ParcelComparisonData{}, nil
	}

	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)

	var results []ParcelComparisonData
	harvestService := NewHarvestService()

	for _, parcelID := range parcelIDs {
		var parcel models.Parcel
		if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
			continue // Skip parcels that don't exist
		}

		comparison := ParcelComparisonData{
			ParcelID:   parcel.ID,
			ParcelName: parcel.Name,
			Area:       parcel.Area,
			TreesCount: parcel.TreesCount,
		}

		// Get yield stats
		yieldStats, err := harvestService.GetYieldStats(parcelID, year)
		if err == nil {
			comparison.YieldPerHectare = yieldStats.YieldPerHectare
			comparison.AverageQuality = yieldStats.AverageQuality
			comparison.TotalRevenue = yieldStats.TotalRevenue
		}

		// Get cost summary
		costSummary, err := harvestService.GetCostSummary(parcelID, startDate, endDate)
		if err == nil {
			comparison.NetProfit = costSummary.NetProfit
			comparison.ROI = costSummary.ROI
		}

		// Get cost efficiency
		costEfficiency, err := s.GetCostEfficiency(startDate, endDate, &parcelID)
		if err == nil && len(costEfficiency) > 0 {
			comparison.CostPerLiter = costEfficiency[0].CostPerLiter
		}

		// Get water usage
		irrigationService := NewIrrigationService()
		waterStats, err := irrigationService.GetWaterUsageStats(parcelID, startDate, endDate)
		if err == nil && parcel.Area > 0 {
			// TotalWaterApplied is in mm, convert to m³: (mm * hectares * 10)
			comparison.WaterUsage = waterStats.TotalWaterApplied * parcel.Area * 10
		}

		results = append(results, comparison)
	}

	return results, nil
}
