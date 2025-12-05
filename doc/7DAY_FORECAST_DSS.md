# 7-Day Weather Forecast & Risk Prediction System

## Overview

OleaMind now includes a comprehensive 7-day weather forecast system that serves as the **foundation for all Decision Support Systems (DSS)**. This enables proactive farm management by predicting pest risks, planning irrigation, and optimizing treatment timing.

## ✅ Implemented Features

### 1. Extended Weather Forecasts

**Data Source**: Open-Meteo API (Free, no API key required)

**Forecast Parameters** (7 days):
| Parameter | Description |
|-----------|-------------|
| Temperature | Min, Max, Average (°C) |
| Precipitation | Sum (mm), Probability (%) |
| Humidity | Min, Max, Average (%) |
| Wind | Speed Max, Gust Max (km/h) |
| ET0 | Evapotranspiration (mm/day) |
| Sunshine | Duration (hours) |
| UV Index | Maximum value |

### 2. Risk Prediction System

**Pest/Disease Risk Forecasts**:
- **Olive Fruit Fly** (Bactrocera oleae) - 7-day risk prediction
- **Peacock Spot** (Spilocaea oleagina) - 7-day risk prediction

**Features**:
- Daily risk score (0-100) for each pest type
- Risk level classification (none, low, moderate, high, critical)
- Risk trend analysis (increasing, stable, decreasing)
- Confidence score (100% today → 40% at day 7)
- Actionable alerts and recommendations

### 3. Data Models

**DailyForecast** (`models/weather.go`):
```go
type DailyForecast struct {
    ParcelID          uint
    ForecastDate      DateOnly
    DaysAhead         int      // 0 = today, 6 = 7th day
    TempMin, TempMax, TempAvg float64
    PrecipitationSum  float64
    PrecipitationProb int
    HumidityMin, HumidityMax, HumidityAvg int
    WindSpeedMax, WindGustMax float64
    ET0               float64
    SunshineDur       float64
    UVIndexMax        float64
}
```

**ForecastRiskPrediction** (`models/weather.go`):
```go
type ForecastRiskPrediction struct {
    ParcelID      uint
    ForecastDate  DateOnly
    DaysAhead     int
    PestType      PestType
    RiskScore     float64   // 0-100
    RiskLevel     RiskLevel // none, low, moderate, high, critical
    RiskTrend     string    // increasing, stable, decreasing
    Confidence    float64   // 100% (today) to 40% (day 7)
    AlertMessage  string
    Recommendations string
}
```

## API Endpoints

### Get 7-Day Risk Forecast

```bash
GET /pests/risk-forecast/:parcel_id
```

**Query Parameters**:
- `pest_type` (optional): Filter by `olive_fly` or `peacock_spot`

**Response**:
```json
[
  {
    "parcel_id": 1,
    "forecast_date": "2024-12-05",
    "days_ahead": 0,
    "pest_type": "olive_fly",
    "risk_score": 65,
    "risk_level": "high",
    "risk_trend": "increasing",
    "confidence": 100,
    "alert_message": "High Olive Fly risk expected today. Prepare treatment.",
    "temp_avg": 24.5,
    "humidity_avg": 72,
    "precipitation_mm": 0
  },
  // ... 7 days × 2 pest types = 14 predictions
]
```

### Get Risk Forecast Summary

```bash
GET /pests/risk-forecast/:parcel_id/summary
```

**Response**:
```json
{
  "parcel_id": 1,
  "parcel_name": "North Field",
  "generated_at": "2024-12-05T10:30:00Z",
  "olive_fly_forecast": [
    {
      "date": "2024-12-05",
      "days_ahead": 0,
      "risk_score": 65,
      "risk_level": "high",
      "risk_trend": "increasing",
      "confidence": 100
    },
    // ... 7 days
  ],
  "peacock_spot_forecast": [
    // ... 7 days
  ],
  "alerts": [
    "High Olive Fly risk expected today. Prepare treatment.",
    "Peacock Spot: Infection risk on day 2 - apply copper fungicide before rain"
  ],
  "recommended_actions": [
    "Olive Fly: Risk increasing - prepare Spinosad or Dimethoate spray for day 1",
    "Good treatment window on day 3 - favorable conditions for spray application"
  ]
}
```

### Refresh Risk Forecast

```bash
POST /pests/risk-forecast/:parcel_id/refresh
```

Forces recalculation of risk predictions with latest weather data.

## Risk Calculation Algorithms

### Olive Fruit Fly Risk (May-October only)

```
Risk Score = Temperature(0-40) + Humidity(0-30) + Precipitation(0-20) + GrowthStage(0-10)

Temperature (using average):
- 20-30°C: 40 points (optimal for fly activity)
- 15-20°C: 25 points
- 30-35°C: 15 points
- Other: 5 points

Humidity (using average):
- >70%: 30 points
- 60-70%: 20 points
- 50-60%: 10 points
- <50%: 5 points

Precipitation:
- >20mm: 5 points (rain disrupts)
- 5-20mm: 10 points
- <5mm: 20 points (dry favors flies)

Growth Stage:
- July-September: 10 points (peak)
- May-June, October: 5 points
```

### Peacock Spot Risk (Year-round)

```
Risk Score = Temperature(0-35) + Wetness(0-40) + Season(0-15) + RainProb(0-10)

Temperature (using average):
- 10-20°C: 35 points (optimal for infection)
- 20-25°C: 25 points
- 5-10°C: 15 points
- Other: 5 points

Wetness (using max humidity + precipitation):
- Rain >5mm OR Humidity >90%: 40 points
- Rain >1mm OR Humidity >80%: 30 points
- Humidity >70%: 20 points
- Other: 5 points

Season:
- September-November: 15 points (autumn peak)
- March-May: 12 points (spring)
- December-February: 8 points (winter)
- June-August: 3 points (summer)

Rain Probability:
- >70%: 10 points
- >40%: 5 points
```

### Trend Calculation

```
Trend = Current Risk Score - Previous Day Risk Score

If difference > 10: "increasing"
If difference < -10: "decreasing"
Otherwise: "stable"
```

### Confidence Scoring

```
Confidence = 100 - (DaysAhead × 10)
Minimum: 40%

Day 0 (today): 100%
Day 1: 90%
Day 2: 80%
...
Day 6: 40%
```

## Use Cases

### 1. Pest Risk Forecasting
- See when risk levels will rise before they become critical
- Plan treatments proactively
- Avoid unnecessary treatments during low-risk periods

### 2. Treatment Window Planning
- Identify dry, calm days for spray applications
- Avoid treating before rain (waste of product)
- Schedule copper sprays before wet periods

### 3. Irrigation Planning (Future)
- Plan irrigation around expected rainfall
- Reduce irrigation before rainy periods
- Increase irrigation during dry spells with high ET0

### 4. Harvest Planning (Future)
- Monitor weather conditions for optimal harvest days
- Plan around rain to avoid wet harvesting

## Frontend Integration

### Recommended Components

1. **7-Day Risk Chart** - Line chart showing risk trends
2. **Risk Calendar** - Color-coded daily risk levels
3. **Alert Banner** - Highlights upcoming high/critical days
4. **Action Recommendations** - What to do and when

### API Integration Example

```typescript
// Fetch risk forecast summary
const response = await fetch(`/pests/risk-forecast/${parcelId}/summary`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const summary = await response.json();

// Display alerts
summary.alerts.forEach(alert => showAlert(alert));

// Show recommended actions
summary.recommended_actions.forEach(action => showAction(action));

// Render risk chart
renderChart('olive_fly', summary.olive_fly_forecast);
renderChart('peacock_spot', summary.peacock_spot_forecast);
```

## Caching & Performance

- **Forecast refresh**: Every 6 hours automatically
- **Force refresh**: POST to `/refresh` endpoint
- **Storage**: Forecasts stored in database for offline access
- **Cleanup**: Old predictions automatically removed

## Future Enhancements

1. **Additional Pests/Diseases**
   - Verticillium wilt
   - Olive knot
   - Anthracnose

2. **Advanced Algorithms**
   - Degree-day accumulation for fly generations
   - Spore germination modeling for diseases
   - Machine learning for local refinement

3. **Irrigation DSS Integration**
   - Use forecast rainfall for irrigation planning
   - ET0-based water requirement predictions

4. **Notifications**
   - Email/push notifications for critical alerts
   - Daily/weekly forecast digests

5. **Mobile App**
   - Offline forecast access
   - Quick action buttons

## Configuration

No additional configuration required. The system uses Open-Meteo's free API.

**Optional Environment Variables**:
```bash
# Forecast cache duration (default: 6 hours)
FORECAST_CACHE_TTL=6h

# Number of forecast days (default: 7, max: 16)
FORECAST_DAYS=7
```

## Testing

```bash
# Run backend tests
cd backend
go test ./services/... -v -run "Forecast|Risk"

# Test API endpoints
curl http://localhost:8080/pests/risk-forecast/1
curl http://localhost:8080/pests/risk-forecast/1/summary
```

---

**Implementation Date**: December 5, 2024
**Status**: ✅ Backend Complete - Frontend Pending

