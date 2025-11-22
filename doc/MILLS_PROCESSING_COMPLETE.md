# Mills & Olive Processing - Backend Implementation Complete

## Overview
The Mills & Olive Processing system provides complete traceability from olive harvest to bottled oil, including quality analysis, batch management, and sales tracking. This closes the production loop in OleaMind's agricultural management platform.

## System Architecture

```
🫒 Olive Orchards (Parcels)
    ↓
📦 Harvest Logs
    ↓
🚚 Olive Deliveries → 🏭 Mills
    ↓
🛢️  Oil Batches (Production)
    ↓
🔬 Quality Analysis (Lab Tests)
    ↓
🍾 Bottling Operations
    ↓
💰 Sales & Distribution
```

## Completed Features

### 1. Mill Management (`models.Mill`)

Register and manage olive oil processing facilities:

**Core Information**:
- Name, address, contact details
- Mill type: `traditional`, `continuous`, `cooperative`
- Processing capacity (kg/hour)

**Certifications**:
- Organic certification
- DOP (Protected Designation of Origin)
- IGP (Protected Geographical Indication)

**API Endpoints**:
```
POST   /mills              - Register a new mill
GET    /mills              - List all mills (filter by active status)
GET    /mills/:id          - Get mill details
PUT    /mills/:id          - Update mill information
DELETE /mills/:id          - Delete a mill
```

### 2. Olive Delivery Management (`models.OliveDelivery`)

Track olive deliveries from orchards to mills:

**Delivery Details**:
- Delivery date and quantity (kg)
- Link to specific harvest (optional)
- Parcel and cultivar information
- Mill's delivery receipt number

**Quality Metrics at Delivery**:
- Overall quality assessment (excellent, good, fair, poor)
- Fruit temperature (°C)
- Damaged fruit percentage
- Foreign matter percentage (leaves, stems)

**Processing Information**:
- Processing type: `immediate`, `stored`, `specific_batch`
- Processed date (when milled)
- Containers/crates count

**Traceability**:
- Links to `HarvestLog` for complete farm-to-mill tracking
- Links to `Parcel` for origin tracking

**API Endpoints**:
```
POST   /deliveries         - Record an olive delivery
GET    /deliveries         - List deliveries (filter by mill, parcel, date range)
PUT    /deliveries/:id     - Update delivery details
DELETE /deliveries/:id     - Delete a delivery record
```

### 3. Oil Batch Production (`models.OilBatch`)

Manage oil production batches with complete source tracking:

**Batch Information**:
- Unique batch number
- Production date
- Mill association
- Quantity produced (liters)

**Oil Classification**:
- Oil type: `extra_virgin`, `virgin`, `lampante`
- Processing method: `cold_extraction`, `continuous`, `traditional`
- Extraction temperature (°C)

**Monocultivar Tracking**:
- Flag for single-cultivar oils
- Cultivar name (if monocultivar)

**Production Metrics**:
- Oil yield percentage (oil extracted from olives)
- Storage location (tank number)
- Status: `stored`, `bottled`, `sold`

**Source Traceability** (`models.OilBatchSource`):
- Many-to-many relationship linking batches to deliveries
- Track which parcels contributed to each batch
- Calculate contribution percentage per delivery

**API Endpoints**:
```
POST   /oil-batches                       - Create a new oil batch
GET    /oil-batches                       - List batches (filter by mill, status)
GET    /oil-batches/:id                   - Get batch details
PUT    /oil-batches/:id                   - Update batch information
GET    /oil-batches/:batch_id/traceability - Get full traceability (parcel to batch)
```

### 4. Quality Analysis (`models.OilQualityAnalysis`)

Laboratory analysis results with automatic EVOO classification:

**Chemical Parameters** (EU Regulation 2568/91):
- **Free Acidity**: % oleic acid (max 0.8 for EVOO)
- **Peroxide Value**: meq O2/kg (max 20 for EVOO)
- **K232**: UV absorption coefficient (max 2.50 for EVOO)
- **K270**: UV absorption coefficient (max 0.22 for EVOO)
- **ΔK**: Delta K (max 0.01 for EVOO)

**Organoleptic Parameters** (Sensory Analysis):
- **Fruity Median**: 0-10 scale
- **Bitter Median**: 0-10 scale
- **Pungent Median**: 0-10 scale
- **Defects Median**: 0-10 scale (must be 0 for EVOO)

**Health Benefits**:
- **Polyphenols**: mg/kg (antioxidants, higher is better)
- **Tocopherols**: mg/kg (Vitamin E content)

**Automatic Classification**:
The system automatically classifies oil based on lab results:
- **Extra Virgin**: Meets all EVOO criteria
- **Virgin**: Meets virgin oil criteria
- **Lampante**: Requires refining before consumption

**API Endpoints**:
```
POST   /quality-analyses           - Submit lab analysis results
GET    /quality-analyses/:batch_id - Get all analyses for a batch
```

### 5. Bottling Operations (`models.OilBottling`)

Track bottling for retail distribution:

**Bottling Details**:
- Bottling date
- Quantity bottled (liters)
- Bottle size (0.25, 0.5, 0.75, 1.0 liters, etc.)
- Number of bottles produced

**Labeling & Traceability**:
- Lot number for traceability
- Label type: `standard`, `premium`, `organic`, `dop`
- Expiry date

**Distribution**:
- Destination: `wholesale`, `retail`, `direct`, `export`
- Cost tracking

**API Endpoints**:
```
POST   /bottlings          - Record a bottling operation
GET    /bottlings          - List bottlings (filter by batch)
```

### 6. Sales Management (`models.OilSale`)

Track oil sales and revenue:

**Sale Details**:
- Sale date and customer
- Quantity sold (liters)
- Price per liter
- Total amount

**Payment Tracking**:
- Payment method: `cash`, `transfer`, `card`, `credit`
- Payment status: `pending`, `paid`, `partial`
- Invoice number

**Links**:
- Optional link to oil batch (bulk sales)
- Optional link to bottling (retail sales)

**Automatic Status Updates**:
- Batch status automatically updated to `sold` when fully sold

**API Endpoints**:
```
POST   /sales              - Record a sale
GET    /sales              - List sales (filter by date range, batch)
PUT    /sales/:id          - Update sale details
```

### 7. Production Statistics

Comprehensive production analytics:

**Metrics Calculated**:
- Total batches produced
- Total liters produced
- EVOO percentage
- Average oil yield
- Year-over-year comparisons

**API Endpoint**:
```
GET    /production/stats?mill_id=1&year=2024
```

Response:
```json
{
  "year": 2024,
  "total_batches": 15,
  "total_liters": 4500.0,
  "evoo_liters": 4200.0,
  "evoo_percentage": 93.33,
  "average_yield_pct": 18.5
}
```

## Complete Traceability Example

### From Orchard to Bottle

1. **Harvest**: Olives harvested from Parcel #5 (Frantoio cultivar)
   ```json
   {
     "parcel_id": 5,
     "date": "2024-11-10",
     "cultivar": "Frantoio",
     "quantity_kg": 2000,
     "lot_number": "LOT-2024-005"
   }
   ```

2. **Delivery**: Olives delivered to Oleificio Rossi
   ```json
   {
     "mill_id": 1,
     "harvest_log_id": 15,
     "delivery_date": "2024-11-10",
     "quantity_kg": 2000,
     "quality": "excellent",
     "delivery_number": "DEL-20241110-001"
   }
   ```

3. **Production**: Oil batch created
   ```json
   {
     "mill_id": 1,
     "batch_number": "BATCH-2024-042",
     "production_date": "2024-11-11",
     "oil_type": "extra_virgin",
     "monocultivar": true,
     "cultivar": "Frantoio",
     "quantity_liters": 360,
     "yield_percentage": 18.0,
     "source_delivery_ids": [85]
   }
   ```

4. **Quality Analysis**: Lab results confirm EVOO status
   ```json
   {
     "oil_batch_id": 42,
     "analysis_date": "2024-11-15",
     "free_acidity": 0.3,
     "peroxide_value": 8.5,
     "k232": 1.85,
     "k270": 0.15,
     "delta_k": 0.003,
     "fruity_median": 6.5,
     "defects_median": 0,
     "polyphenols": 420,
     "classification": "extra_virgin"
   }
   ```

5. **Bottling**: Packaged for retail
   ```json
   {
     "oil_batch_id": 42,
     "bottling_date": "2024-11-20",
     "quantity_liters": 360,
     "bottle_size": 0.75,
     "bottles_count": 480,
     "lot_number": "LOT-EVOO-202442",
     "label_type": "premium"
   }
   ```

6. **Sale**: Sold to customer
   ```json
   {
     "bottling_id": 28,
     "sale_date": "2024-11-25",
     "customer": "Organic Market Ltd",
     "quantity_liters": 100,
     "price_per_liter": 25.00,
     "total_amount": 2500.00,
     "invoice_number": "INV-2024-1150"
   }
   ```

### Traceability Query

```bash
GET /oil-batches/42/traceability
```

Response:
```json
{
  "batch": {
    "id": 42,
    "batch_number": "BATCH-2024-042",
    "monocultivar": true,
    "cultivar": "Frantoio",
    "quantity_liters": 360
  },
  "sources": [
    {
      "olive_delivery": {
        "delivery_number": "DEL-20241110-001",
        "parcel": {
          "id": 5,
          "name": "North Orchard",
          "area": 2.5
        },
        "harvest_log": {
          "lot_number": "LOT-2024-005",
          "quality": "excellent"
        }
      },
      "quantity_kg": 2000,
      "contribution_pct": 100.0
    }
  ],
  "parcel_count": 1,
  "total_olives_kg": 2000
}
```

## Quality Classification Logic

The system automatically classifies oil based on EU Regulation 2568/91:

### Extra Virgin Olive Oil (EVOO)
```
Free Acidity      ≤ 0.8%
Peroxide Value    ≤ 20 meq O2/kg
K232              ≤ 2.50
K270              ≤ 0.22
ΔK                ≤ 0.01
Defects Median    = 0
Fruity Median     > 0
```

### Virgin Olive Oil
```
Free Acidity      ≤ 2.0%
Peroxide Value    ≤ 20 meq O2/kg
K232              ≤ 2.60
K270              ≤ 0.25
Defects Median    ≤ 3.5
Fruity Median     > 0
```

### Lampante
```
Anything not meeting virgin criteria
(requires refining before consumption)
```

## Database Schema

All models use soft deletes (`gorm.Model`) and proper foreign key relationships:

```
Mills (1) ─────────── (N) OliveDeliveries
                            ↓
OliveDeliveries (N) ── (N) OilBatchSource ── (N) OilBatches
                                                    ↓
HarvestLogs ──────────────────────────┘            │
                                                    ├─── (N) OilQualityAnalysis
                                                    ├─── (N) OilBottlings
                                                    └─── (N) OilSales

Parcels ────────── (N) OliveDeliveries
       └────────── (N) HarvestLogs
```

## Benefits

1. **Complete Traceability**: Track every drop of oil back to specific orchards
2. **Quality Assurance**: Automatic classification based on lab results
3. **Compliance**: Meet EU regulations and certification requirements
4. **Monocultivar Oils**: Support for single-cultivar premium oils
5. **Inventory Management**: Track oil from production to sale
6. **Profitability**: Track costs and revenues across the entire chain
7. **Certification Support**: DOP/IGP/Organic tracking
8. **Analytics**: Production statistics and yield optimization

## Use Cases

### 1. Cooperative Management
Track deliveries from multiple farms, create batches, manage distribution.

### 2. Estate Bottler
Single-estate oils with complete traceability for premium marketing.

### 3. Quality Certification
Maintain records for DOP/IGP certifications with full documentation.

### 4. Retail Distribution
Lot number tracking for retail compliance and recalls if needed.

### 5. Historical Analysis
Compare quality and yield across seasons, optimize processing.

## API Testing

### Create a Mill
```bash
curl -X POST http://localhost:8080/mills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Oleificio Rossi",
    "address": "Via degli Ulivi 42",
    "city": "Spoleto",
    "region": "Umbria",
    "country": "Italy",
    "phone": "+39 0743 123456",
    "email": "info@oleificiorossi.it",
    "mill_type": "continuous",
    "capacity": 500,
    "certified_organic": true,
    "certified_dop": true
  }'
```

### Record a Delivery
```bash
curl -X POST http://localhost:8080/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "mill_id": 1,
    "parcel_id": 5,
    "delivery_date": "2024-11-15",
    "cultivar": "Frantoio",
    "quantity_kg": 2000,
    "quality": "excellent",
    "temperature": 18.5,
    "delivery_number": "DEL-20241115-001"
  }'
```

### Create Oil Batch with Traceability
```bash
curl -X POST http://localhost:8080/oil-batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch": {
      "mill_id": 1,
      "batch_number": "BATCH-2024-050",
      "production_date": "2024-11-16",
      "oil_type": "extra_virgin",
      "processing_method": "cold_extraction",
      "extraction_temp": 27.0,
      "monocultivar": true,
      "cultivar": "Frantoio",
      "quantity_liters": 360,
      "yield_percentage": 18.0
    },
    "source_delivery_ids": [1, 2, 3]
  }'
```

### Submit Quality Analysis
```bash
curl -X POST http://localhost:8080/quality-analyses \
  -H "Content-Type: application/json" \
  -d '{
    "oil_batch_id": 1,
    "analysis_date": "2024-11-20",
    "laboratory": "Lab Oleario Toscano",
    "free_acidity": 0.25,
    "peroxide_value": 7.8,
    "k232": 1.92,
    "k270": 0.14,
    "delta_k": 0.002,
    "fruity_median": 7.2,
    "bitter_median": 5.8,
    "pungent_median": 6.1,
    "defects_median": 0,
    "polyphenols": 485,
    "tocopherols": 215,
    "certified": true
  }'
```

## Next Steps

### Frontend Implementation (Pending)
1. **Mills Management Page**:
   - Mill directory
   - Add/edit mills
   - Certification badges

2. **Deliveries Page**:
   - Record deliveries from harvest logs
   - Quality assessment at delivery
   - Link to parcels and harvests

3. **Production Page**:
   - Create oil batches
   - Link to source deliveries
   - Automatic yield calculations
   - Batch status tracking

4. **Quality Lab Page**:
   - Submit analysis results
   - View quality trends
   - Automatic EVOO classification
   - Polyphenol tracking

5. **Bottling & Sales**:
   - Bottling operations
   - Sales tracking
   - Invoice generation
   - Inventory status

6. **Traceability Dashboard**:
   - QR code generation for bottles
   - Interactive traceability viewer
   - Parcel → Harvest → Delivery → Batch → Bottle
   - Quality certificates

7. **Analytics**:
   - Production statistics
   - Quality trends
   - Yield optimization
   - Profitability analysis

---

**Implementation Date**: November 22, 2024
**Status**: ✅ Backend Complete, Frontend Pending

