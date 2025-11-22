# Harvest & Yield Management - Backend Implementation Complete

## Overview
The Harvest & Yield Management system is now fully implemented on the backend, providing comprehensive tracking of harvests, yield statistics, cost analysis, and yield predictions.

## Completed Features

### 1. Backend Models (`backend/models/harvest.go`)

#### HarvestLog
Records individual harvest events with comprehensive details:
- **Core Data**: Date, parcel, cultivar, quantity (kg)
- **Quality**: Quality assessment (excellent, good, fair, poor)
- **Financial**: Cost, revenue, price per kg
- **Labor**: Labor hours, number of workers
- **Method**: Harvest method (manual, mechanical, mixed)
- **Traceability**: Lot number, destination (mill name)
- **Agronomic**: Maturity index (0-7 Jaén scale)
- **Context**: Weather conditions at harvest

#### YieldPrediction
Forecast yield for upcoming seasons:
- **Prediction**: Predicted yield (total kg and per tree)
- **Method**: Prediction method (manual, historical_average, model)
- **Accuracy**: Tracks actual yield and calculates prediction accuracy
- **Confidence**: Low, medium, high confidence levels
- **Factors**: JSON field for storing influencing factors

#### CostSummary (Computed)
Aggregates all costs for profitability analysis:
- **Operations Cost**: From OperationLog
- **Harvest Cost**: From HarvestLog
- **Treatment Cost**: From TreatmentLog (pest control)
- **Irrigation Cost**: From IrrigationEvent
- **Revenue**: Total harvest revenue
- **Profit**: Net profit calculation
- **ROI**: Return on Investment percentage

#### YieldStats (Computed)
Annual yield statistics:
- **Total Yield**: kg per parcel per year
- **Yield per Hectare**: kg/ha
- **Yield per Tree**: kg/tree
- **Quality**: Average quality assessment
- **Financial**: Total revenue, average price per kg

### 2. Backend Service (`backend/services/harvest_service.go`)

#### Harvest Management
- `LogHarvest`: Record a harvest event
- `GetHarvestHistory`: Retrieve harvests for a parcel with date filtering
- `GetAllHarvests`: Get all harvests with optional filters
- `UpdateHarvest`: Update harvest record
- `DeleteHarvest`: Remove harvest record

#### Yield Statistics
- `GetYieldStats`: Calculate comprehensive yield statistics for a parcel and year
  - Aggregates all harvests for the year
  - Calculates per-hectare and per-tree yields
  - Computes average quality and price

#### Cost Analysis
- `GetCostSummary`: Aggregate costs from all sources
  - Queries OperationLog, HarvestLog, TreatmentLog, IrrigationEvent
  - Calculates total costs and revenue
  - Computes net profit and ROI

#### Yield Prediction
- `CreateYieldPrediction`: Manual yield prediction entry
- `UpdateYieldPrediction`: Update with actual results and calculate accuracy
- `GetYieldPredictions`: Retrieve predictions for a parcel
- `PredictYieldFromHistory`: Generate prediction from historical averages
  - Analyzes last N years of data
  - Calculates average yield
  - Determines confidence level based on data availability

### 3. API Endpoints (`backend/controllers/harvest_controller.go`)

```
POST   /harvests                      - Log a harvest event
GET    /harvests                      - Get all harvests (with filters)
GET    /harvests/:parcel_id           - Get harvest history for a parcel
PUT    /harvests/:id                  - Update a harvest record
DELETE /harvests/:id                  - Delete a harvest record
GET    /yield/stats/:parcel_id        - Get yield statistics
GET    /costs/summary/:parcel_id      - Get cost summary and profitability
POST   /yield/predictions             - Create a yield prediction
GET    /yield/predictions/:parcel_id  - Get predictions for a parcel
POST   /yield/predict/:parcel_id      - Auto-generate prediction from history
```

### 4. Date Handling Fix

#### Custom DateOnly Type (`backend/models/types.go`)
Created a flexible date type that accepts both formats:
- **Date-only**: `"2025-11-22"` (from HTML date inputs)
- **Datetime**: `"2025-11-22T10:30:00Z"` (RFC3339)

Applied to all date fields across models:
- `HarvestLog.Date`
- `OperationLog.Date`
- `PestRiskAssessment.Date`
- `TreatmentLog.Date`
- `IrrigationEvent.Date`
- `PestMonitoring.Date`

Benefits:
- ✅ Frontend forms work seamlessly
- ✅ No date format conversion needed in frontend
- ✅ Database stores as proper timestamp
- ✅ JSON responses use clean date format

### 5. GeoJSON Serialization Fix

Fixed JSON marshaling error when loading operations with parcels:
- Modified `GetOperations` to selectively preload Parcel fields
- Excludes problematic `geo_json` field from preload
- Prevents `"invalid character '1' after top-level value"` error

## API Usage Examples

### Log a Harvest
```bash
POST http://localhost:8080/harvests
Content-Type: application/json

{
  "parcel_id": 1,
  "date": "2024-11-15",
  "cultivar": "Frantoio",
  "quantity_kg": 1250.5,
  "quality": "excellent",
  "destination": "Oleificio Rossi",
  "lot_number": "LOT-2024-001",
  "labor_hours": 32.5,
  "workers": 4,
  "harvest_method": "mechanical",
  "cost": 450.00,
  "price_per_kg": 4.50,
  "revenue": 5627.25,
  "maturity_index": 3.2,
  "notes": "Perfect ripeness, optimal weather conditions"
}
```

### Get Yield Statistics
```bash
GET http://localhost:8080/yield/stats/1?year=2024
```

Response:
```json
{
  "parcel_id": 1,
  "parcel_name": "North Orchard",
  "year": 2024,
  "total_yield_kg": 3500.0,
  "yield_per_hectare": 1400.0,
  "yield_per_tree": 17.5,
  "harvest_count": 2,
  "average_quality": "good",
  "total_revenue": 15750.00,
  "average_price_per_kg": 4.50
}
```

### Get Cost Summary
```bash
GET http://localhost:8080/costs/summary/1?start_date=2024-01-01&end_date=2024-12-31
```

Response:
```json
{
  "parcel_id": 1,
  "parcel_name": "North Orchard",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "operations_cost": 2500.00,
  "harvest_cost": 900.00,
  "treatment_cost": 350.00,
  "irrigation_cost": 150.00,
  "total_cost": 3900.00,
  "total_revenue": 15750.00,
  "net_profit": 11850.00,
  "roi": 303.85
}
```

### Predict Yield from History
```bash
POST http://localhost:8080/yield/predict/1?year=2025&years_back=5
```

Response:
```json
{
  "ID": 5,
  "parcel_id": 1,
  "year": 2025,
  "prediction_date": "2024-11-22T18:30:00Z",
  "predicted_yield_kg": 3450.0,
  "predicted_yield_per_tree": 17.25,
  "confidence_level": "high",
  "method": "historical_average",
  "notes": "Based on 5 years of historical data"
}
```

## Benefits

1. **Complete Traceability**: From harvest to mill with lot numbers
2. **Financial Analysis**: ROI and profitability tracking across all activities
3. **Quality Tracking**: Monitor quality trends over time
4. **Yield Forecasting**: Data-driven predictions for planning
5. **Cost Optimization**: Identify cost drivers and optimize spending
6. **Compliance**: Complete harvest records for certifications
7. **Multi-Year Analysis**: Compare yields across seasons

## Technical Details

### Yield Calculation Logic
```
Yield per Hectare = Total Yield (kg) / Parcel Area (ha)
Yield per Tree = Total Yield (kg) / Number of Trees
Average Quality = Mean of quality scores (excellent=4, good=3, fair=2, poor=1)
```

### Cost Aggregation
```
Total Cost = Operations + Harvest + Treatment + Irrigation
Net Profit = Total Revenue - Total Cost
ROI = (Net Profit / Total Cost) × 100
```

### Prediction Confidence
```
High: ≥5 years of historical data
Medium: 3-4 years of historical data
Low: 1-2 years of historical data
```

## Database Schema

All models use soft deletes (`gorm.Model`) and include:
- `ID`: Primary key
- `CreatedAt`: Auto-generated
- `UpdatedAt`: Auto-generated
- `DeletedAt`: For soft deletes

Foreign keys properly configured with `gorm:"foreignKey:ParcelID"`

## Next Steps

### Frontend Implementation (Pending)
1. Create Harvests page with:
   - Harvest log form
   - Harvest history table
   - Yield statistics dashboard
   - Cost analysis charts
   - Yield prediction interface

2. Dashboard Integration:
   - Current year yield summary
   - Top performing parcels
   - Profitability overview
   - Yield predictions

3. Parcels Page Enhancement:
   - Add "Harvest History" tab
   - Display yield stats per parcel
   - Show cost summary
   - Quick harvest log button

### Testing
- Unit tests for service logic
- Integration tests for API endpoints
- Validation tests for edge cases

---

**Implementation Date**: November 22, 2024
**Status**: ✅ Backend Complete, Frontend Pending

