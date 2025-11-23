package services

import (
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

type PDFService struct{}

func NewPDFService() *PDFService {
	return &PDFService{}
}

// GenerateParcelReport generates a PDF report for a single parcel
func (s *PDFService) GenerateParcelReport(parcelID uint, year int) (*gofpdf.Fpdf, error) {
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 20)
	pdf.Cell(0, 10, "Parcel Performance Report")
	pdf.Ln(15)

	// Parcel Info
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 10, fmt.Sprintf("Parcel: %s", parcel.Name))
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Year: %d", year))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Area: %.2f ha", parcel.Area))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Trees: %d", parcel.TreesCount))
	pdf.Ln(12)

	// Get yield stats
	harvestService := NewHarvestService()
	yieldStats, err := harvestService.GetYieldStats(parcelID, year)
	if err == nil {
		pdf.SetFont("Arial", "B", 14)
		pdf.Cell(0, 10, "Yield Statistics")
		pdf.Ln(8)

		pdf.SetFont("Arial", "", 11)
		pdf.Cell(0, 6, fmt.Sprintf("Total Yield: %.0f kg", yieldStats.TotalYieldKg))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("Yield per Hectare: %.0f kg/ha", yieldStats.YieldPerHectare))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("Yield per Tree: %.2f kg/tree", yieldStats.YieldPerTree))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("Average Quality: %s", yieldStats.AverageQuality))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("Number of Harvests: %d", yieldStats.HarvestCount))
		pdf.Ln(12)
	}

	// Get cost summary
	startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)
	costSummary, err := harvestService.GetCostSummary(parcelID, startDate, endDate)
	if err == nil {
		pdf.SetFont("Arial", "B", 14)
		pdf.Cell(0, 10, "Financial Summary")
		pdf.Ln(8)

		pdf.SetFont("Arial", "", 11)
		pdf.Cell(0, 6, fmt.Sprintf("Total Revenue: EUR %.2f", costSummary.TotalRevenue))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("Total Costs: EUR %.2f", costSummary.TotalCost))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("  - Operations: EUR %.2f", costSummary.OperationsCost))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("  - Harvest: EUR %.2f", costSummary.HarvestCost))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("  - Treatments: EUR %.2f", costSummary.TreatmentCost))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("  - Irrigation: EUR %.2f", costSummary.IrrigationCost))
		pdf.Ln(6)
		pdf.SetFont("Arial", "B", 11)
		pdf.Cell(0, 6, fmt.Sprintf("Net Profit: EUR %.2f", costSummary.NetProfit))
		pdf.Ln(6)
		pdf.Cell(0, 6, fmt.Sprintf("ROI: %.1f%%", costSummary.ROI))
		pdf.Ln(12)
	}

	// Footer with local time
	loc, _ := time.LoadLocation("Europe/Rome") // Italy timezone
	localTime := time.Now().In(loc)
	pdf.SetY(-15)
	pdf.SetFont("Arial", "I", 8)
	pdf.Cell(0, 10, fmt.Sprintf("Generated: %s (CET)", localTime.Format("2006-01-02 15:04:05")))

	return pdf, nil
}

// GenerateComparisonReport generates a PDF comparing multiple parcels
func (s *PDFService) GenerateComparisonReport(parcelIDs []uint, year int) (*gofpdf.Fpdf, error) {
	analyticsService := NewAnalyticsService()
	data, err := analyticsService.GetParcelComparison(parcelIDs, year)
	if err != nil {
		return nil, err
	}

	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape for comparison table
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 20)
	pdf.Cell(0, 10, "Parcel Comparison Report")
	pdf.Ln(12)

	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 6, fmt.Sprintf("Year: %d", year))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Parcels Compared: %d", len(data)))
	pdf.Ln(12)

	// Table
	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(40, 7, "Parcel")
	pdf.Cell(25, 7, "Area (ha)")
	pdf.Cell(25, 7, "Yield/ha")
	pdf.Cell(25, 7, "Cost/L")
	pdf.Cell(30, 7, "Revenue")
	pdf.Cell(30, 7, "Net Profit")
	pdf.Cell(20, 7, "ROI %")
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 9)
	for _, parcel := range data {
		pdf.Cell(40, 6, parcel.ParcelName)
		pdf.Cell(25, 6, fmt.Sprintf("%.2f", parcel.Area))
		pdf.Cell(25, 6, fmt.Sprintf("%.0f kg", parcel.YieldPerHectare))
		pdf.Cell(25, 6, fmt.Sprintf("EUR %.2f", parcel.CostPerLiter))
		pdf.Cell(30, 6, fmt.Sprintf("EUR %.0f", parcel.TotalRevenue))
		pdf.Cell(30, 6, fmt.Sprintf("EUR %.0f", parcel.NetProfit))
		pdf.Cell(20, 6, fmt.Sprintf("%.1f", parcel.ROI))
		pdf.Ln(7)
	}

	// Best performers
	pdf.Ln(10)
	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 8, "Best Performers")
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 10)

	// Best yield
	bestYield := data[0]
	for _, d := range data {
		if d.YieldPerHectare > bestYield.YieldPerHectare {
			bestYield = d
		}
	}
	pdf.Cell(0, 6, fmt.Sprintf("* Highest Yield: %s (%.0f kg/ha)", bestYield.ParcelName, bestYield.YieldPerHectare))
	pdf.Ln(6)

	// Best ROI
	bestROI := data[0]
	for _, d := range data {
		if d.ROI > bestROI.ROI {
			bestROI = d
		}
	}
	pdf.Cell(0, 6, fmt.Sprintf("* Best ROI: %s (%.1f%%)", bestROI.ParcelName, bestROI.ROI))
	pdf.Ln(6)

	// Best efficiency
	bestEfficiency := data[0]
	for _, d := range data {
		if d.CostPerLiter > 0 && (bestEfficiency.CostPerLiter == 0 || d.CostPerLiter < bestEfficiency.CostPerLiter) {
			bestEfficiency = d
		}
	}
	if bestEfficiency.CostPerLiter > 0 {
		pdf.Cell(0, 6, fmt.Sprintf("* Lowest Cost: %s (EUR %.2f/L)", bestEfficiency.ParcelName, bestEfficiency.CostPerLiter))
	}

	// Footer with local time
	loc, _ := time.LoadLocation("Europe/Rome")
	localTime := time.Now().In(loc)
	pdf.SetY(-15)
	pdf.SetFont("Arial", "I", 8)
	pdf.Cell(0, 10, fmt.Sprintf("Generated: %s (CET)", localTime.Format("2006-01-02 15:04:05")))

	return pdf, nil
}
