# Centralized Weather Advisory System

## Overview

The Weather Advisory System provides a **single source of truth** for all weather-based decisions in the OleaMind DSS. This ensures consistency between pest management, irrigation scheduling, and treatment planning.

**Location-Aware**: The system considers parcel location (latitude, hemisphere, climate zone) to provide seasonally-appropriate advice. For example:
- Southern hemisphere parcels have inverted seasons
- Subtropical zones have different dormancy periods
- Climate-adjusted irrigation thresholds based on evapotranspiration rates

## Centralized Thresholds

All weather-related decisions use these consistent thresholds defined in `weather_advisory_service.go`:

### Precipitation Thresholds (mm)
| Constant | Value | Meaning |
|----------|-------|---------|
| `PrecipNone` | 0.0 | No precipitation |
| `PrecipLight` | 1.0 | Light rain - minimal impact |
| `PrecipModerate` | 5.0 | Delays treatments, reduces irrigation need |
| `PrecipHeavy` | 10.0 | No spraying, no irrigation |
| `PrecipExtreme` | 20.0 | Runoff risk, flooding potential |

### Wind Thresholds (km/h)
| Constant | Value | Meaning |
|----------|-------|---------|
| `WindCalm` | 5.0 | Ideal for spraying |
| `WindLight` | 10.0 | Acceptable for spraying |
| `WindModerate` | 15.0 | Marginal for spraying |
| `WindStrong` | 20.0 | Do not spray (drift risk) |
| `WindGale` | 40.0 | Dangerous conditions |

### Temperature Thresholds (°C)
| Constant | Value | Meaning |
|----------|-------|---------|
| `TempFrost` | 0.0 | Frost risk |
| `TempCold` | 5.0 | Slow pest activity |
| `TempOptPestMin` | 15.0 | Minimum for optimal pest activity |
| `TempOptSprayMin` | 10.0 | Minimum for spray application |
| `TempOptSprayMax` | 30.0 | Maximum for spray (evaporates too fast above) |
| `TempHot` | 35.0 | Reduced pest activity, plant stress |
| `TempExtreme` | 40.0 | Avoid all field operations |

### Humidity Thresholds (%)
| Constant | Value | Meaning |
|----------|-------|---------|
| `HumidityLow` | 40 | High evaporation |
| `HumidityOptMin` | 50 | Optimal spray range start |
| `HumidityOptMax` | 80 | Optimal spray range end |
| `HumidityHigh` | 85 | Disease risk |
| `HumidityVeryHigh` | 90 | High disease risk, poor spray drying |

### Time Thresholds (hours)
| Constant | Value | Meaning |
|----------|-------|---------|
| `SprayDryingTime` | 4 | Hours needed for spray to dry before rain |
| `TreatmentCooldown` | 24 | Hours after treatment before irrigation |
| `IrrigationCooldown` | 12 | Hours after irrigation before treatment |

## Location-Aware Context

The system extracts location information from parcel geometry and adjusts advice accordingly:

```go
type ParcelContext struct {
    ParcelID         uint
    Latitude         float64  // Extracted from parcel GeoJSON
    IsNorthern       bool     // Determines season calculation
    ClimateZone      string   // Subtropical, Warm/Central/Cool Mediterranean
    IrrigationFactor float64  // 0.8 (subtropical) to 1.1 (cool)
    ETcMultiplier    float64  // 0.9 (cool) to 1.2 (subtropical)
    IsDormant        bool     // Based on current month + hemisphere
    GrowingSeason    string   // "early", "mid", "late", "dormant"
}
```

### Climate Zones

| Latitude Range | Zone | Irrigation Factor | ETc Multiplier |
|---------------|------|-------------------|----------------|
| < 30° | Subtropical | 0.80 (irrigate sooner) | 1.20 (higher evaporation) |
| 30-38° | Warm Mediterranean | 0.85 | 1.15 |
| 38-42° | Central Mediterranean | 1.00 | 1.00 |
| > 42° | Cool Mediterranean | 1.10 (tolerate more) | 0.90 (lower evaporation) |

### Growing Seasons (Olive Trees)

**Northern Hemisphere:**
- **Dormant**: Dec-Feb (winter rest)
- **Early**: Mar-Apr (bud break, early growth)
- **Mid**: May-Jul (flowering, fruit set)
- **Late**: Aug-Nov (fruit development, harvest)

**Southern Hemisphere:** Seasons shifted by 6 months.

## Day Condition Analysis

The system analyzes each day's weather with location-aware adjustments:

```go
type DayConditions struct {
    // Location context
    ClimateZone   string  // From parcel location
    GrowingSeason string  // Calculated from date + hemisphere
    IsDormant     bool    // Affects all recommendations
    ET0Adjusted   float64 // ET0 × climate multiplier
    
    // Weather conditions
    IsDry         bool  // < 1mm precipitation
    IsCalm        bool  // < 20 km/h wind
    IsSprayable   bool  // Dry + calm + temp 10-30°C + not dormant
    IsTreatWindow bool  // Sprayable + sunny + no frost
    IsIrrigatable bool  // < rain threshold × irrigation_factor, not dormant
    DiseaseRisk   bool  // Wet + moderate temp + disease season (late/dormant)
    PestRisk      bool  // Warm + humid + pest season (mid/late)
}
```

## API Endpoints

### GET `/weather/advisory/:parcel_id`
Returns comprehensive, prioritized advice for the next 7 days, with location context.

**Response:**
```json
{
  "parcel_id": 1,
  "parcel_name": "Uliveto Nord",
  "generated_at": "2025-12-05T10:00:00Z",
  
  "climate_zone": "Central Mediterranean",
  "growing_season": "dormant",
  "is_dormant": true,
  "hemisphere": "northern",
  
  "best_spray_day": -1,
  "best_irrigate_day": -1,
  "rain_expected_days": [3, 5],
  "advisories": [
    {
      "type": "info",
      "priority": "info",
      "message": "Trees are in dormancy period - reduced irrigation and pest monitoring needed",
      "reason": "Current season: dormant, Climate zone: Central Mediterranean",
      "action": "Focus on pruning, equipment maintenance, and orchard cleanup"
    }
  ],
  "warnings": []
}
```

**Non-dormant example (summer):**
```json
{
  "climate_zone": "Warm Mediterranean",
  "growing_season": "mid",
  "is_dormant": false,
  "hemisphere": "northern",
  "best_spray_day": 2,
  "best_irrigate_day": 0,
  "advisories": [
    {
      "type": "treatment",
      "priority": "high",
      "days_ahead": 2,
      "message": "Day 2: Last good spray window before rain",
      "reason": "Dry conditions now, rain expected soon",
      "action": "Apply any planned treatments, allow 4-6h drying"
    }
  ]
}
```

### GET `/weather/conditions/:parcel_id`
Returns raw condition analysis for each day.

### GET `/weather/check-spray/:parcel_id`
Quick check if today is suitable for spraying.

### GET `/weather/check-irrigation/:parcel_id`
Quick check if irrigation is advisable today.

## How Services Use the Centralized System

### Irrigation Service
```go
// Uses centralized threshold
recommendation.ShouldIrrigate = ... && recommendation.Rainfall < PrecipModerate
```

### Pest Service
```go
// Uses centralized advisory service
advisoryService := NewWeatherAdvisoryService()
conditions, _ := advisoryService.Get7DayConditions(parcelID)
bestSprayDay, _ := advisoryService.GetBestTreatmentWindow(parcelID, 5)
```

### Forecast Recommendations
All generated recommendations now include:
- Coordination advice (don't irrigate on spray day)
- Specific timing guidance (4-6h drying time for fungicides)
- Alternative day suggestions when conditions are poor

## Consistency Guarantees

1. **Same thresholds everywhere**: All services use the constants from `weather_advisory_service.go`
2. **Coordinated advice**: Treatment and irrigation recommendations are aware of each other
3. **Clear timing**: Fungicide drying time (4-6h) and irrigation cooldown (24h after treatment) are enforced
4. **Weather-aware actions**: Every recommendation considers actual forecast data

## Example: Coordinated Advice

When the system detects:
- Day 0: Dry, calm (ideal for spray)
- Day 1: Heavy rain expected (20mm)
- Day 2: Clearing, windy
- Day 3: Perfect conditions

It will generate:
1. "🍃 Peacock Spot: Apply copper fungicide TODAY (day 0) - needs 4h to dry before rain"
2. "🌧️ Heavy rain day 1 (20mm) - delay all treatments, skip irrigation"
3. "💨 Windy conditions on day 2 - not suitable for spraying"
4. "✅ Good spray window on day 3 - dry, calm conditions"

## Future Enhancements

- [ ] Integration with soil moisture sensors for irrigation decisions
- [ ] Historical effectiveness tracking (which conditions led to best treatment results)
- [ ] Push notifications for critical weather changes
- [ ] Regional pest pressure data integration

