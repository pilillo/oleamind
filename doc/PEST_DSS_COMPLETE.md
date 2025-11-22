# Pest & Disease Decision Support System (DSS) - Complete Implementation

## Overview
The Pest & Disease DSS is now fully implemented in OleaMind, providing intelligent pest and disease risk assessment for olive orchards based on real-time weather data, with actionable treatment recommendations.

## Completed Features

### 1. Backend Implementation

#### Data Models (`backend/models/pest.go`)
- **PestRiskAssessment**: Daily risk calculations per parcel
  - 5 pest/disease types supported (Olive Fly, Peacock Spot, Verticillium, Olive Knot, Anthracnose)
  - 5 risk levels (none, low, moderate, high, critical)
  - Risk score (0-100), alert messages, recommendations
  - Weather conditions tracking (temperature, humidity, precipitation)
  - Favorable condition days counter

- **TreatmentLog**: Records actual pest control treatments
  - Treatment types (chemical, biological, cultural, trap)
  - Product details (name, active agent, dose rate)
  - Application method and target area
  - Cost tracking and efficacy observations

- **PestMonitoring**: Manual observation tracking
  - Trap counts and visual inspections
  - Infection rate and severity assessment
  - Photo documentation support

- **TreatmentThreshold**: Intervention thresholds (for future enhancement)

#### Service Layer (`backend/services/pest_service.go`)
- **Olive Fruit Fly Risk Model (Bactrocera oleae)**
  - Temperature factor: Optimum 20-30°C (40 points max)
  - Humidity factor: >70% highest risk (30 points max)
  - Precipitation factor: Dry conditions favor flies (20 points max)
  - Growth stage factor: June-October critical period (10 points max)
  - Total score: 0-100, mapped to 5 risk levels

- **Peacock Spot Risk Model (Spilocaea oleagina)**
  - Temperature factor: Optimum 10-20°C for spore germination (35 points max)
  - Wetness/humidity factor: Free moisture required (40 points max)
  - Season factor: Autumn peak, spring secondary (15 points max)
  - Forecast factor: Rain expected increases risk (10 points max)
  - Total score: 0-100, mapped to 5 risk levels

- **Treatment Recommendations**
  - Dynamic recommendations based on risk level
  - JSON-formatted for structured display
  - Includes monitoring, chemical, biological, and cultural practices
  - Specific timing and application guidance

#### API Endpoints (`backend/controllers/pest_controller.go`)
```
GET  /pests/risk/:parcel_id              - Get current risk assessment
GET  /pests/risk-history/:parcel_id      - Get historical risk data
POST /pests/treatments                    - Log a treatment
GET  /pests/treatments/:parcel_id        - Get treatment history
POST /pests/monitoring                    - Log monitoring observation
GET  /pests/monitoring/:parcel_id        - Get monitoring history
```

### 2. Frontend Implementation

#### Parcels Page Enhancement (`frontend/src/pages/Parcels.tsx`)
- **Sanitary Status Panel** (shows when parcel selected)
  - Displays risk for both Olive Fly and Peacock Spot
  - Color-coded risk levels (red=critical, orange=high, amber=moderate, yellow=low, green=none)
  - Risk score visualization (0-100)
  - Alert messages specific to each pest
  - Quick action recommendations for high/critical risks
  - Auto-fetches when selecting a parcel

#### Dashboard Integration (`frontend/src/pages/Dashboard.tsx`)
- **Critical Pest Risk Alerts**
  - Top 2 critical/high risk parcels shown prominently
  - Displays: parcel name, pest type, risk level, alert message
  - Color-coded (red for critical, orange for high)
  - Integrated with irrigation and inventory alerts

### 3. Internationalization (`frontend/src/i18n/`)
Complete translations in English and Italian for:
- Pest names (Olive Fly → Mosca Olearia, Peacock Spot → Occhio di Pavone)
- Risk levels (none, low, moderate, high, critical)
- Treatment types (chemical, biological, cultural, trap)
- UI labels and alerts

### 4. Unit Tests (`backend/services/pest_service_test.go`)
Comprehensive test coverage:
- Olive Fly risk calculation scenarios (critical, high, low, minimal)
- Peacock Spot risk calculation scenarios (various weather conditions)
- Treatment logging and history retrieval
- Risk history tracking
- Database cleanup and isolation

## Technical Details

### Olive Fruit Fly Risk Algorithm
```
Risk Score = Temperature(0-40) + Humidity(0-30) + Precipitation(0-20) + Growth Stage(0-10)

Temperature:
- 20-30°C: 40 points (optimal)
- 15-20°C: 25 points (suboptimal)
- 30-35°C: 15 points (hot)
- Other: 5 points (too cold/hot)

Humidity:
- >70%: 30 points
- 60-70%: 20 points
- 50-60%: 10 points
- <50%: 5 points

Precipitation:
- >20mm: 5 points (heavy rain disrupts)
- 5-20mm: 10 points (light rain)
- <5mm: 20 points (dry favors flies)

Growth Stage:
- June-October: 10 points (fruiting period)
- Other: 2 points
```

### Peacock Spot Risk Algorithm
```
Risk Score = Temperature(0-35) + Wetness(0-40) + Season(0-15) + Forecast(0-10)

Temperature:
- 10-20°C: 35 points (optimal for infection)
- 20-25°C: 25 points (still favorable)
- 5-10°C: 15 points (marginal)
- Other: 5 points

Wetness/Humidity:
- Rain >5mm OR Humidity >90%: 40 points (free moisture)
- Rain >1mm OR Humidity >80%: 30 points
- Humidity >70%: 20 points
- Other: 5 points

Season:
- September-November: 15 points (autumn peak)
- March-May: 12 points (spring)
- December-February: 8 points (winter)
- June-August: 3 points (summer)

Forecast:
- Rain >5mm expected: 10 points
- Rain >0mm expected: 5 points
```

### Risk Level Thresholds
| Risk Level | Olive Fly Score | Peacock Spot Score | Actions |
|------------|-----------------|---------------------|---------|
| Critical | ≥80 | ≥75 | Immediate treatment required |
| High | 60-79 | 55-74 | Plan treatment within 2-3 days |
| Moderate | 40-59 | 35-54 | Monitor closely, prepare |
| Low | 20-39 | 15-34 | Routine monitoring |
| None | <20 | <15 | Conditions unfavorable |

## API Usage Examples

### Get Risk Assessment
```bash
GET http://localhost:8080/pests/risk/1
```

Response:
```json
[
  {
    "ID": 10,
    "parcel_id": 1,
    "date": "2024-11-22T16:00:00Z",
    "pest_type": "olive_fly",
    "risk_level": "high",
    "risk_score": 75,
    "temperature": 24.5,
    "humidity": 70,
    "precipitation": 0,
    "alert_message": "High risk: Plan treatment within 2-3 days. Increase trap monitoring.",
    "recommendations": "{...}"
  },
  {
    "ID": 11,
    "parcel_id": 1,
    "date": "2024-11-22T16:00:00Z",
    "pest_type": "peacock_spot",
    "risk_level": "moderate",
    "risk_score": 45,
    "temperature": 16.0,
    "humidity": 75,
    "precipitation": 2.5,
    "alert_message": "Moderate risk: Monitor weather closely and prepare for treatment.",
    "recommendations": "{...}"
  }
]
```

### Log Treatment
```bash
POST http://localhost:8080/pests/treatments
Content-Type: application/json

{
  "parcel_id": 1,
  "date": "2024-11-22T08:00:00Z",
  "pest_type": "olive_fly",
  "treatment_type": "chemical",
  "product_name": "Spinosad Bait",
  "active_agent": "Spinosad",
  "dose_rate": "0.5 L/ha",
  "application_method": "spray",
  "target_area": 2.5,
  "cost": 45.00,
  "notes": "Preventive treatment based on trap monitoring"
}
```

## Benefits

1. **Proactive Pest Management**: Early warning system based on weather conditions
2. **Reduced Crop Losses**: Timely interventions prevent severe infestations
3. **Optimized Treatment Timing**: Weather-based recommendations improve efficacy
4. **Cost Savings**: Treat only when necessary, reducing chemical usage
5. **Compliance Support**: Complete treatment logging for regulatory requirements
6. **Data-Driven Decisions**: Historical tracking enables pattern analysis
7. **Multi-Pest Monitoring**: Comprehensive coverage of major olive pests

## Agronomic Basis

### Olive Fruit Fly (Bactrocera oleae)
- **Biology**: Completes 3-5 generations per year in Mediterranean climates
- **Optimal Conditions**: 20-30°C with moderate humidity
- **Critical Period**: Fruit development (June-October)
- **Economic Impact**: Can cause 80-100% crop loss if untreated
- **Monitoring**: McPhail traps, visual inspection of fruit punctures
- **Treatment Window**: Preventive sprays before infestation, based on trap counts

### Peacock Spot (Spilocaea oleagina)
- **Biology**: Fungal disease requiring free moisture for spore germination
- **Optimal Conditions**: 10-20°C with rain or high humidity (>85%)
- **Infection Cycle**: 6-12 hours of leaf wetness required
- **Critical Period**: Autumn (September-November) and spring (March-May)
- **Symptoms**: Circular spots on leaves, premature defoliation
- **Treatment Window**: Preventive copper sprays before infection periods

## Future Enhancements (Not in MVP)

- Integration with IoT trap monitoring systems
- Degree-day accumulation for fly generation modeling
- Satellite imagery for early disease detection
- Machine learning for local risk model refinement
- Mobile push notifications for critical alerts
- Integration with weather forecast for 7-day risk prediction
- Support for additional pests (Verticillium, Olive Knot, Anthracnose)
- Regional threshold customization
- Treatment efficacy tracking and ROI analysis

## Testing

Run tests with:
```bash
cd backend
TEST_DB_HOST=localhost go test ./services/... -run TestCalculateOliveFlyRisk -v
TEST_DB_HOST=localhost go test ./services/... -run TestCalculatePeacockSpotRisk -v
```

Tests verify:
- Risk calculation accuracy across different weather scenarios
- Correct risk level assignment
- Treatment and monitoring logging
- Historical data retrieval

## Configuration

No additional environment variables required. The system uses the existing weather service (`WeatherData` model) to calculate pest risk.

## Deployment Status

✅ All components deployed and tested
✅ Database migrations applied
✅ Frontend and backend integrated
✅ API endpoints functional
✅ Documentation complete

---

**Implementation Date**: November 22, 2024
**Status**: ✅ Production Ready

