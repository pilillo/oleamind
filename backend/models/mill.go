package models

import (
	"gorm.io/gorm"
)

// Mill represents an olive oil mill/processing facility
type Mill struct {
	gorm.Model
	Name             string  `json:"name" binding:"required"`
	Address          string  `json:"address"`
	City             string  `json:"city"`
	Region           string  `json:"region"`
	Country          string  `json:"country" binding:"required"`
	Phone            string  `json:"phone"`
	Email            string  `json:"email"`
	ContactPerson    string  `json:"contact_person"`
	MillType         string  `json:"mill_type"` // traditional, continuous, cooperative
	Capacity         float64 `json:"capacity"`  // kg/hour processing capacity
	CertifiedOrganic bool    `json:"certified_organic"`
	CertifiedDOP     bool    `json:"certified_dop"` // Protected Designation of Origin
	CertifiedIGP     bool    `json:"certified_igp"` // Protected Geographical Indication
	Notes            string  `json:"notes"`
	Active           bool    `json:"active" gorm:"default:true"`
}

// OliveDelivery records delivery of olives to a mill
type OliveDelivery struct {
	gorm.Model
	MillID          uint        `json:"mill_id" binding:"required"`
	Mill            *Mill       `json:"mill,omitempty" gorm:"foreignKey:MillID"`
	HarvestLogID    *uint       `json:"harvest_log_id"` // Optional: link to specific harvest
	HarvestLog      *HarvestLog `json:"harvest_log,omitempty" gorm:"foreignKey:HarvestLogID"`
	DeliveryDate    DateOnly    `json:"delivery_date" binding:"required"`
	ParcelID        uint        `json:"parcel_id" binding:"required"`
	Parcel          *Parcel     `json:"parcel,omitempty" gorm:"foreignKey:ParcelID"`
	Cultivar        string      `json:"cultivar"`
	QuantityKg      float64     `json:"quantity_kg" binding:"required,min=0"`
	ContainersCount int         `json:"containers_count"` // Number of crates/bins delivered
	DeliveryNumber  string      `json:"delivery_number"`  // Mill's delivery receipt number
	ProcessingType  string      `json:"processing_type"`  // immediate, stored, specific_batch
	Quality         string      `json:"quality"`          // excellent, good, fair, poor
	Temperature     float64     `json:"temperature"`      // Olives temperature at delivery (°C)
	DamagedFruit    float64     `json:"damaged_fruit"`    // % of damaged fruit
	ForeignMatter   float64     `json:"foreign_matter"`   // % of leaves, stems, etc.
	ProcessedDate   *DateOnly   `json:"processed_date,omitempty"`
	Notes           string      `json:"notes"`
}

// OilBatch represents a batch of produced olive oil
type OilBatch struct {
	gorm.Model
	MillID           uint     `json:"mill_id" binding:"required"`
	Mill             *Mill    `json:"mill,omitempty" gorm:"foreignKey:MillID"`
	BatchNumber      string   `json:"batch_number" binding:"required"`
	ProductionDate   DateOnly `json:"production_date" binding:"required"`
	OilType          string   `json:"oil_type"`          // extra_virgin, virgin, lampante
	ProcessingMethod string   `json:"processing_method"` // cold_extraction, continuous, traditional
	ExtractionTemp   float64  `json:"extraction_temp"`   // Temperature during extraction (°C)
	Monocultivar     bool     `json:"monocultivar"`      // Single cultivar oil
	Cultivar         string   `json:"cultivar"`          // If monocultivar
	QuantityLiters   float64  `json:"quantity_liters" binding:"required,min=0"`
	YieldPercentage  float64  `json:"yield_percentage"`               // Oil yield % from olives
	StorageLocation  string   `json:"storage_location"`               // Tank number, location
	Status           string   `json:"status" gorm:"default:'stored'"` // stored, bottled, sold
	Notes            string   `json:"notes"`
}

// OilBatchSource links deliveries to oil batches (many-to-many)
type OilBatchSource struct {
	gorm.Model
	OilBatchID      uint           `json:"oil_batch_id" binding:"required"`
	OilBatch        *OilBatch      `json:"oil_batch,omitempty" gorm:"foreignKey:OilBatchID"`
	OliveDeliveryID uint           `json:"olive_delivery_id" binding:"required"`
	OliveDelivery   *OliveDelivery `json:"olive_delivery,omitempty" gorm:"foreignKey:OliveDeliveryID"`
	QuantityKg      float64        `json:"quantity_kg"`      // kg of olives from this delivery used in batch
	ContributionPct float64        `json:"contribution_pct"` // % contribution to batch
}

// OilQualityAnalysis stores lab analysis results for oil batches
type OilQualityAnalysis struct {
	gorm.Model
	OilBatchID   uint      `json:"oil_batch_id" binding:"required"`
	OilBatch     *OilBatch `json:"oil_batch,omitempty" gorm:"foreignKey:OilBatchID"`
	AnalysisDate DateOnly  `json:"analysis_date" binding:"required"`
	Laboratory   string    `json:"laboratory"`

	// Chemical parameters (EU Regulation 2568/91)
	FreeAcidity   float64 `json:"free_acidity"`   // % oleic acid (max 0.8 for EVOO)
	PeroxideValue float64 `json:"peroxide_value"` // meq O2/kg (max 20 for EVOO)
	K232          float64 `json:"k232"`           // UV absorption (max 2.50 for EVOO)
	K270          float64 `json:"k270"`           // UV absorption (max 0.22 for EVOO)
	DeltaK        float64 `json:"delta_k"`        // (max 0.01 for EVOO)

	// Organoleptic parameters
	FruityMedian  float64 `json:"fruity_median"`  // 0-10 scale
	BitterMedian  float64 `json:"bitter_median"`  // 0-10 scale
	PungentMedian float64 `json:"pungent_median"` // 0-10 scale
	DefectsMedian float64 `json:"defects_median"` // 0-10 scale (must be 0 for EVOO)

	// Additional quality indicators
	Polyphenols float64 `json:"polyphenols"` // mg/kg (higher is better)
	Tocopherols float64 `json:"tocopherols"` // mg/kg (Vitamin E)

	// Classification
	Classification string `json:"classification"` // extra_virgin, virgin, lampante, defective
	Certified      bool   `json:"certified"`      // Officially certified analysis
	Notes          string `json:"notes"`
	AnalysisReport string `json:"analysis_report"` // Path/URL to PDF report
}

// OilBottling records bottling operations
type OilBottling struct {
	gorm.Model
	OilBatchID     uint      `json:"oil_batch_id" binding:"required"`
	OilBatch       *OilBatch `json:"oil_batch,omitempty" gorm:"foreignKey:OilBatchID"`
	BottlingDate   DateOnly  `json:"bottling_date" binding:"required"`
	QuantityLiters float64   `json:"quantity_liters" binding:"required,min=0"`
	BottleSize     float64   `json:"bottle_size"` // Liters per bottle (0.25, 0.5, 0.75, 1.0, etc.)
	BottlesCount   int       `json:"bottles_count"`
	LotNumber      string    `json:"lot_number"` // Bottling lot number for traceability
	LabelType      string    `json:"label_type"` // standard, premium, organic, dop
	ExpiryDate     *DateOnly `json:"expiry_date,omitempty"`
	Destination    string    `json:"destination"` // wholesale, retail, direct, export
	Cost           float64   `json:"cost" binding:"min=0"`
	Notes          string    `json:"notes"`
}

// OilInventory tracks current oil stock
type OilInventory struct {
	gorm.Model
	OilBatchID      uint      `json:"oil_batch_id" binding:"required"`
	OilBatch        *OilBatch `json:"oil_batch,omitempty" gorm:"foreignKey:OilBatchID"`
	CurrentLiters   float64   `json:"current_liters"`
	BottledLiters   float64   `json:"bottled_liters"`
	SoldLiters      float64   `json:"sold_liters"`
	RemainingLiters float64   `json:"remaining_liters"`
	LastUpdated     DateOnly  `json:"last_updated"`
}

// OilSale records oil sales
type OilSale struct {
	gorm.Model
	OilBatchID     *uint        `json:"oil_batch_id"`
	OilBatch       *OilBatch    `json:"oil_batch,omitempty" gorm:"foreignKey:OilBatchID"`
	BottlingID     *uint        `json:"bottling_id"`
	Bottling       *OilBottling `json:"bottling,omitempty" gorm:"foreignKey:BottlingID"`
	SaleDate       DateOnly     `json:"sale_date" binding:"required"`
	Customer       string       `json:"customer"`
	QuantityLiters float64      `json:"quantity_liters" binding:"required,min=0"`
	PricePerLiter  float64      `json:"price_per_liter" binding:"required,min=0"`
	TotalAmount    float64      `json:"total_amount" binding:"required,min=0"`
	PaymentMethod  string       `json:"payment_method"`                          // cash, transfer, card, credit
	PaymentStatus  string       `json:"payment_status" gorm:"default:'pending'"` // pending, paid, partial
	InvoiceNumber  string       `json:"invoice_number"`
	Notes          string       `json:"notes"`
}
