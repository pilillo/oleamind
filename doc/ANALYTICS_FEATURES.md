# Advanced Analytics Features

## Overview
OleaMind's advanced analytics provide farmers with data-driven insights to optimize their olive oil production through multi-year trend analysis, cost efficiency tracking, parcel performance comparison, and professional PDF reporting.

## Features

### 1. Multi-Year Trend Charts
**Location:** Analytics Dashboard → Trends Tab

**Purpose:** Track yield and revenue performance over time to identify patterns and make informed decisions.

**Features:**
- 5-year historical yield trends per parcel
- Dual-axis chart showing yield/hectare and revenue
- Summary statistics: average yield, best year, total harvests, average price
- PDF export for documentation

**Usage:**
1. Navigate to Analytics & Reporting
2. Click the "Trends" tab
3. Select a parcel from the dropdown
4. View historical performance
5. Click "Export PDF" to generate a parcel performance report

---

### 2. Cost Efficiency Analysis
**Location:** Analytics Dashboard → Costs Tab

**Purpose:** Calculate the true cost of olive oil production and identify cost-saving opportunities.

**Metrics Calculated:**
- **Cost per Liter**: Total production costs divided by liters of oil produced
- **Cost Breakdown**: Operations, Harvest, Irrigation costs separately
- **Efficiency Comparison**: See which parcels are most cost-effective

**Features:**
- Date range selector (default: current year)
- Bar chart comparing cost/liter across parcels
- Pie chart showing cost category distribution
- Summary cards highlighting most/least efficient parcels
- Detailed table with all metrics

**Cost Calculation:**
```
Total Costs = Operations + Harvest + Irrigation

Cost per Liter = Total Costs / Liters of Oil Produced
```

**Usage:**
1. Go to Analytics → Costs tab
2. Adjust date range if needed
3. Review bar/pie charts and summary cards
4. Analyze detailed table for specific cost breakdowns

---

### 3. Parcel Comparison
**Location:** Analytics Dashboard → Comparison Tab

**Purpose:** Compare multiple parcels side-by-side to benchmark performance and replicate best practices.

**Metrics Compared:**
- Area (ha) and Tree Count
- Yield per Hectare (kg/ha)
- Cost per Liter (EUR/L)
- Average Quality
- Water Usage (m³)
- Revenue and Net Profit
- ROI (%)

**Features:**
- Select up to 5 parcels simultaneously
- Radar chart showing 4-dimension performance (Yield, Revenue, ROI, Efficiency)
- Best performer cards (Highest Yield, Best ROI, Lowest Cost)
- Detailed comparison table
- PDF export for comparison reports

**Usage:**
1. Go to Analytics → Comparison tab
2. Select 2-5 parcels to compare (click parcel buttons)
3. Adjust year if needed
4. Review radar chart and best performers
5. Analyze detailed metrics in the table
6. Click "Export PDF" for a comparison report

---

### 4. PDF Export
**Purpose:** Generate professional reports for compliance, documentation, and sharing with agronomists or certifiers.

**Available Reports:**

#### Parcel Performance Report
- **Endpoint:** `/analytics/export/parcel-report/:parcel_id?year=YYYY`
- **Contents:**
  - Parcel information (name, area, trees)
  - Yield statistics (total, per hectare, per tree, quality)
  - Financial summary (revenue, costs breakdown, net profit, ROI)
  - Generation timestamp with timezone (CET)

#### Comparison Report
- **Endpoint:** `/analytics/export/comparison-report?parcel_ids=1,2,3&year=YYYY`
- **Contents:**
  - Multi-parcel comparison table
  - All metrics side-by-side
  - Best performers section
  - Generation timestamp with timezone (CET)

**PDF Features:**
- Professional A4 format (landscape for comparison)
- Currency displayed as "EUR" for universal compatibility
- Proper timezone indication (CET)
- Clean formatting suitable for official documentation

---

## API Endpoints

### GET /analytics/yield-trends/:parcel_id
Get multi-year yield trends for a parcel.

**Parameters:**
- `:parcel_id` (path) - Parcel ID
- `years` (query, optional) - Number of years (default: 5, max: 20)

**Response:**
```json
[
  {
    "year": 2024,
    "total_yield_kg": 5000,
    "yield_per_hectare": 2500,
    "yield_per_tree": 12.5,
    "average_quality": "Premium",
    "harvest_count": 3,
    "total_revenue": 15000,
    "average_price_per_kg": 3.0
  }
]
```

### GET /analytics/cost-efficiency
Calculate cost per liter for parcels.

**Parameters:**
- `start_date` (query) - Start date (YYYY-MM-DD)
- `end_date` (query) - End date (YYYY-MM-DD)
- `parcel_id` (query, optional) - Filter by specific parcel

**Response:**
```json
[
  {
    "parcel_id": 1,
    "parcel_name": "North Field",
    "total_costs": 10000,
    "total_liters_oil": 2000,
    "cost_per_liter": 5.0,
    "cost_breakdown": {
      "operations": 6000,
      "harvest": 3000,
      "irrigation": 1000
    },
    "batch_count": 5,
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }
]
```

### GET /analytics/parcel-comparison
Compare multiple parcels.

**Parameters:**
- `parcel_ids` (query, required) - Comma-separated parcel IDs
- `year` (query, optional) - Year for comparison (default: current year)

**Response:**
```json
[
  {
    "parcel_id": 1,
    "parcel_name": "North Field",
    "area": 10.5,
    "trees_count": 400,
    "yield_per_hectare": 2500,
    "cost_per_liter": 5.0,
    "average_quality": "Premium",
    "water_usage_m3": 5000,
    "total_revenue": 15000,
    "net_profit": 5000,
    "roi": 50.0
  }
]
```

### GET /analytics/export/parcel-report/:parcel_id
Download parcel performance PDF.

**Parameters:**
- `:parcel_id` (path) - Parcel ID
- `year` (query, optional) - Year (default: current year)

**Response:** PDF file download

### GET /analytics/export/comparison-report
Download comparison PDF.

**Parameters:**
- `parcel_ids` (query, required) - Comma-separated parcel IDs
- `year` (query, optional) - Year (default: current year)

**Response:** PDF file download

---

## Data Sources

The analytics features aggregate data from multiple tables:

- **harvest_logs** - Yield quantities, quality scores, harvest costs
- **operation_logs** - Operations costs (labor, equipment, inputs)
- **irrigation_events** - Irrigation costs and water usage
- **olive_deliveries** - Olives delivered to mill
- **oil_batches** - Oil produced (liters)
- **oil_batch_sources** - Links deliveries to batches
- **parcels** - Parcel metadata (area, trees)

---

## Technical Notes

### Cost Calculation Logic
1. Aggregate costs from operations, harvest, and irrigation for the specified period
2. Link olive deliveries to oil batches via `oil_batch_sources`
3. Calculate oil produced by summing `quantity_liters * contribution_pct`
4. Divide total costs by liters produced

### Water Usage Conversion
Water usage from `irrigation_events` is stored in mm (millimeters of water applied).
Conversion to m³: `water_m3 = water_mm * area_ha * 10`

### Quality Classification
Quality scores from harvest logs are classified as:
- Premium: > 90
- Excellent: 80-90
- Good: 70-80
- Standard: < 70

---

## Best Practices

### Multi-Year Trends
- Review trends annually to identify yield patterns
- Compare similar years (weather patterns)
- Use best years as performance targets
- Investigate significant drops to identify issues

### Cost Efficiency
- Review monthly to catch rising costs early
- Compare similar-sized parcels for fair benchmarking
- Focus on largest cost categories for optimization
- Track seasonal variations in costs

### Parcel Comparison
- Compare parcels with similar characteristics (age, variety, size)
- Use top performers as benchmarks
- Identify specific practices from efficient parcels
- Consider external factors (weather, soil) when comparing

### PDF Reports
- Export reports before major decisions
- Share with agronomists for expert review
- Store PDFs for compliance/certification audits
- Include reports in annual farm documentation

---

## Troubleshooting

**No data showing in trends:**
- Ensure the parcel has harvest records for multiple years
- Check that harvest dates are properly recorded
- Verify yield quantities are entered

**Cost per liter seems wrong:**
- Confirm all costs are recorded (operations, harvest, irrigation)
- Verify oil batches are linked to deliveries
- Check delivery quantities match actual olives processed

**PDF export fails:**
- Ensure you're logged in (authentication required)
- Check browser console for detailed error messages
- Try exporting a different parcel or date range

**Comparison shows incomplete data:**
- Selected year may not have data for all parcels
- Some metrics require specific data types (e.g., quality requires lab results)
- Try a different year or select parcels with complete records

---

## Future Enhancements
- Automated weekly/monthly email reports
- Predictive analytics for yield forecasting
- Mobile-optimized analytics views
- Customizable dashboard widgets
- Integration with weather data for correlation analysis
