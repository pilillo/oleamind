package services

import (
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"gorm.io/gorm"
)

type MillService struct{}

func NewMillService() *MillService {
	return &MillService{}
}

// ===== Mill Management =====

func (s *MillService) CreateMill(mill *models.Mill) error {
	return initializers.DB.Create(mill).Error
}

func (s *MillService) GetMills(activeOnly bool) ([]models.Mill, error) {
	var mills []models.Mill
	query := initializers.DB.Order("name ASC")

	if activeOnly {
		query = query.Where("active = ?", true)
	}

	err := query.Find(&mills).Error
	return mills, err
}

func (s *MillService) GetMill(millID uint) (*models.Mill, error) {
	var mill models.Mill
	err := initializers.DB.First(&mill, millID).Error
	return &mill, err
}

func (s *MillService) UpdateMill(millID uint, updates *models.Mill) error {
	return initializers.DB.Model(&models.Mill{}).Where("id = ?", millID).Updates(updates).Error
}

func (s *MillService) DeleteMill(millID uint) error {
	return initializers.DB.Delete(&models.Mill{}, millID).Error
}

// ===== Delivery Management =====

func (s *MillService) CreateDelivery(delivery *models.OliveDelivery) error {
	return initializers.DB.Create(delivery).Error
}

func (s *MillService) GetDeliveries(millID *uint, parcelID *uint, startDate, endDate time.Time) ([]models.OliveDelivery, error) {
	var deliveries []models.OliveDelivery

	query := initializers.DB.Preload("Mill").
		Preload("Parcel", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, name, area, trees_count, farm_id, created_at, updated_at")
		}).
		Where("delivery_date >= ? AND delivery_date <= ?",
			models.DateOnly{Time: startDate},
			models.DateOnly{Time: endDate}).
		Order("delivery_date DESC")

	if millID != nil {
		query = query.Where("mill_id = ?", *millID)
	}

	if parcelID != nil {
		query = query.Where("parcel_id = ?", *parcelID)
	}

	err := query.Find(&deliveries).Error
	return deliveries, err
}

func (s *MillService) UpdateDelivery(deliveryID uint, updates *models.OliveDelivery) error {
	return initializers.DB.Model(&models.OliveDelivery{}).Where("id = ?", deliveryID).Updates(updates).Error
}

func (s *MillService) DeleteDelivery(deliveryID uint) error {
	return initializers.DB.Delete(&models.OliveDelivery{}, deliveryID).Error
}

// ===== Oil Batch Management =====

func (s *MillService) CreateOilBatch(batch *models.OilBatch, sourceDeliveryIDs []uint) error {
	// Create the batch
	if err := initializers.DB.Create(batch).Error; err != nil {
		return err
	}

	// Link source deliveries
	if len(sourceDeliveryIDs) > 0 {
		var deliveries []models.OliveDelivery
		if err := initializers.DB.Where("id IN ?", sourceDeliveryIDs).Find(&deliveries).Error; err != nil {
			return err
		}

		totalOlives := 0.0
		for _, delivery := range deliveries {
			totalOlives += delivery.QuantityKg
		}

		for _, delivery := range deliveries {
			source := models.OilBatchSource{
				OilBatchID:      batch.ID,
				OliveDeliveryID: delivery.ID,
				QuantityKg:      delivery.QuantityKg,
				ContributionPct: (delivery.QuantityKg / totalOlives) * 100,
			}
			if err := initializers.DB.Create(&source).Error; err != nil {
				return err
			}

			// Update delivery as processed
			delivery.ProcessedDate = &models.DateOnly{Time: batch.ProductionDate.Time}
			initializers.DB.Save(&delivery)
		}

		// Calculate yield percentage: (oil_kg / olives_kg) * 100
		// Olive oil density is approximately 0.92 kg/L
		if totalOlives > 0 {
			oilKg := batch.QuantityLiters * 0.92
			batch.YieldPercentage = (oilKg / totalOlives) * 100
			initializers.DB.Save(batch)
		}
	}

	return nil
}

func (s *MillService) GetOilBatches(millID *uint, status string) ([]models.OilBatch, error) {
	var batches []models.OilBatch
	query := initializers.DB.Preload("Mill").Order("production_date DESC")

	if millID != nil {
		query = query.Where("mill_id = ?", *millID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Find(&batches).Error
	return batches, err
}

func (s *MillService) GetOilBatch(batchID uint) (*models.OilBatch, error) {
	var batch models.OilBatch
	err := initializers.DB.Preload("Mill").First(&batch, batchID).Error
	return &batch, err
}

func (s *MillService) UpdateOilBatch(batchID uint, updates *models.OilBatch) error {
	return initializers.DB.Model(&models.OilBatch{}).Where("id = ?", batchID).Updates(updates).Error
}

// ===== Traceability =====

func (s *MillService) GetBatchTraceability(batchID uint) (map[string]interface{}, error) {
	var batch models.OilBatch
	if err := initializers.DB.Preload("Mill").First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	// Get source deliveries
	var sources []models.OilBatchSource
	if err := initializers.DB.Preload("OliveDelivery.Parcel", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, name, area, trees_count, farm_id")
	}).Preload("OliveDelivery.HarvestLog").
		Where("oil_batch_id = ?", batchID).
		Find(&sources).Error; err != nil {
		return nil, err
	}

	// Build traceability map
	traceability := map[string]interface{}{
		"batch":           batch,
		"sources":         sources,
		"parcel_count":    len(getUniqueParcels(sources)),
		"total_olives_kg": getTotalOlivesKg(sources),
	}

	return traceability, nil
}

func getUniqueParcels(sources []models.OilBatchSource) map[uint]bool {
	parcels := make(map[uint]bool)
	for _, source := range sources {
		if source.OliveDelivery.ParcelID > 0 {
			parcels[source.OliveDelivery.ParcelID] = true
		}
	}
	return parcels
}

func getTotalOlivesKg(sources []models.OilBatchSource) float64 {
	total := 0.0
	for _, source := range sources {
		total += source.QuantityKg
	}
	return total
}

// ===== Quality Analysis =====

func (s *MillService) CreateQualityAnalysis(analysis *models.OilQualityAnalysis) error {
	// Auto-classify based on parameters
	analysis.Classification = s.classifyOil(analysis)
	return initializers.DB.Create(analysis).Error
}

func (s *MillService) GetQualityAnalyses(batchID uint) ([]models.OilQualityAnalysis, error) {
	var analyses []models.OilQualityAnalysis
	err := initializers.DB.Where("oil_batch_id = ?", batchID).
		Order("analysis_date DESC").
		Find(&analyses).Error
	return analyses, err
}

func (s *MillService) classifyOil(analysis *models.OilQualityAnalysis) string {
	// EU Regulation 2568/91 classification criteria for EVOO
	if analysis.FreeAcidity <= 0.8 &&
		analysis.PeroxideValue <= 20 &&
		analysis.K232 <= 2.50 &&
		analysis.K270 <= 0.22 &&
		analysis.DeltaK <= 0.01 &&
		analysis.DefectsMedian == 0 &&
		analysis.FruityMedian > 0 {
		return "extra_virgin"
	}

	// Virgin oil criteria
	if analysis.FreeAcidity <= 2.0 &&
		analysis.PeroxideValue <= 20 &&
		analysis.K232 <= 2.60 &&
		analysis.K270 <= 0.25 &&
		analysis.DefectsMedian <= 3.5 &&
		analysis.FruityMedian > 0 {
		return "virgin"
	}

	// Lampante (not suitable for consumption without refining)
	return "lampante"
}

// ===== Bottling Management =====

func (s *MillService) CreateBottling(bottling *models.OilBottling) error {
	// Update batch status
	var batch models.OilBatch
	if err := initializers.DB.First(&batch, bottling.OilBatchID).Error; err != nil {
		return err
	}

	if err := initializers.DB.Create(bottling).Error; err != nil {
		return err
	}

	// Update batch status to bottled
	batch.Status = "bottled"
	initializers.DB.Save(&batch)

	return nil
}

func (s *MillService) GetBottlings(batchID uint) ([]models.OilBottling, error) {
	var bottlings []models.OilBottling
	query := initializers.DB.Preload("OilBatch").Order("bottling_date DESC")

	if batchID > 0 {
		query = query.Where("oil_batch_id = ?", batchID)
	}

	err := query.Find(&bottlings).Error
	return bottlings, err
}

// ===== Sales Management =====

func (s *MillService) CreateSale(sale *models.OilSale) error {
	// Update batch status to sold if fully sold
	if err := initializers.DB.Create(sale).Error; err != nil {
		return err
	}

	// Check if batch is fully sold
	if sale.OilBatchID != nil && *sale.OilBatchID > 0 {
		var totalSold float64
		initializers.DB.Model(&models.OilSale{}).
			Where("oil_batch_id = ?", sale.OilBatchID).
			Select("COALESCE(SUM(quantity_liters), 0)").
			Scan(&totalSold)

		var batch models.OilBatch
		if err := initializers.DB.First(&batch, *sale.OilBatchID).Error; err == nil {
			if totalSold >= batch.QuantityLiters {
				batch.Status = "sold"
				initializers.DB.Save(&batch)
			}
		}
	}

	return nil
}

func (s *MillService) GetSales(startDate, endDate time.Time, batchID *uint) ([]models.OilSale, error) {
	var sales []models.OilSale

	query := initializers.DB.Preload("OilBatch").
		Preload("Bottling").
		Where("sale_date >= ? AND sale_date <= ?",
			models.DateOnly{Time: startDate},
			models.DateOnly{Time: endDate}).
		Order("sale_date DESC")

	if batchID != nil {
		query = query.Where("oil_batch_id = ?", *batchID)
	}

	err := query.Find(&sales).Error
	return sales, err
}

func (s *MillService) UpdateSale(saleID uint, updates *models.OilSale) error {
	return initializers.DB.Model(&models.OilSale{}).Where("id = ?", saleID).Updates(updates).Error
}

// ===== Statistics =====

func (s *MillService) GetProductionStats(millID uint, year int) (map[string]interface{}, error) {
	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)

	var batches []models.OilBatch
	query := initializers.DB.Where("production_date >= ? AND production_date <= ?",
		models.DateOnly{Time: startDate},
		models.DateOnly{Time: endDate})

	if millID > 0 {
		query = query.Where("mill_id = ?", millID)
	}

	if err := query.Find(&batches).Error; err != nil {
		return nil, err
	}

	totalLiters := 0.0
	evooLiters := 0.0
	batchCount := len(batches)
	avgYield := 0.0
	yieldCount := 0

	for _, batch := range batches {
		totalLiters += batch.QuantityLiters
		if batch.OilType == "extra_virgin" {
			evooLiters += batch.QuantityLiters
		}
		if batch.YieldPercentage > 0 {
			avgYield += batch.YieldPercentage
			yieldCount++
		}
	}

	if yieldCount > 0 {
		avgYield /= float64(yieldCount)
	}

	stats := map[string]interface{}{
		"year":              year,
		"total_batches":     batchCount,
		"total_liters":      totalLiters,
		"evoo_liters":       evooLiters,
		"evoo_percentage":   (evooLiters / totalLiters) * 100,
		"average_yield_pct": avgYield,
	}

	return stats, nil
}
