# Weather Service Integration (Open-Meteo)

## ✅ Status: Complete (Backend + Frontend - Phase 1)

### What's Working

The weather service is **fully operational** and integrated with Open-Meteo API, with:
- **Actionable insights** on Dashboard (for farmers to make decisions)
- **Detailed weather** per parcel on Parcels page (where it belongs)

## Backend Implementation

### 1. Weather Data Model (`backend/models/weather.go`)

**WeatherData** - Stores current conditions and forecasts for parcels:
- Current conditions: temperature, humidity, precipitation, wind speed/direction, cloud cover, pressure
- **ET0** (Reference evapotranspiration) - critical for irrigation decisions
- 24h forecast: expected rain, min/max temperatures
- Soil moisture estimates
- Automatic caching with 1-hour TTL
- 30-day data retention

**WeatherForecast** - Hourly forecast data (future enhancement)

### 2. Weather Service (`backend/services/weather_service.go`)

**Features:**
- ✅ Open-Meteo API integration (completely free, no API key!)
- ✅ Automatic coordinate extraction from parcel geometry using PostGIS
- ✅ Smart caching: 1-hour refresh interval
- ✅ Stale-while-revalidate pattern
- ✅ Batch weather refresh for all parcels
- ✅ Error handling and structured logging
- ✅ Automatic cleanup of old data (30-day retention)

**API Endpoints:**
```go
GET  /parcels/:parcel_id/weather  // Get weather for specific parcel
POST /weather/refresh              // Trigger refresh for all parcels
```

### 3. Open-Meteo Integration

**Data Retrieved:**
- Current conditions (updated hourly)
- Temperature (2m above ground)
- Relative humidity
- Precipitation
- Wind speed and direction (10m above ground)
- Cloud cover percentage
- Surface pressure
- **ET0 (FAO Evapotranspiration)** ⭐
- 2-day forecast (daily min/max temp, precipitation sum)

**Why Open-Meteo?**
- ✅ Completely free
- ✅ No API key required
- ✅ No rate limits for reasonable use
- ✅ High-resolution data (0.25° grid)
- ✅ Includes agricultural parameters (ET0!)
- ✅ Historical data available
- ✅ Open-source and well-documented

### 4. Coordinate Extraction

The service automatically extracts the centroid of each parcel's geometry using PostGIS:

```sql
SELECT 
  ST_Y(ST_Centroid(ST_GeomFromGeoJSON(?))) as lat,
  ST_X(ST_Centroid(ST_GeomFromGeoJSON(?))) as lon
```

This ensures weather data matches the actual parcel location.

### 5. Caching Strategy

**Smart Caching:**
1. Check database for cached data
2. If data < 1 hour old → return cached data
3. If data > 1 hour old → fetch fresh data from Open-Meteo
4. Save new data to database
5. Clean up data older than 30 days

**Benefits:**
- Reduces API calls
- Faster response times
- Historical data for analysis
- Graceful degradation (returns stale data if API fails)

## Testing

### Manual Testing

```bash
# Get weather for parcel 1
curl http://localhost:8080/parcels/1/weather

# Trigger refresh for all parcels
curl -X POST http://localhost:8080/weather/refresh
```

### Expected Response

```json
{
  "ID": 1,
  "parcel_id": 1,
  "latitude": 41.9005,
  "longitude": 12.5005,
  "temperature": 15.3,
  "humidity": 72,
  "precipitation": 0.0,
  "wind_speed": 12.5,
  "wind_direction": 180,
  "cloud_cover": 45,
  "pressure": 1013.2,
  "et0": 2.4,
  "rain_next_24h": 5.2,
  "temp_min_24h": 10.1,
  "temp_max_24h": 18.7,
  "data_timestamp": "2025-11-22T16:00:00Z",
  "fetched_at": "2025-11-22T16:05:32Z"
}
```

### Unit Tests

```bash
cd backend
go test ./controllers -v -run "TestGet.*Weather|TestRefresh"
```

**Results:** ✅ All tests passing

## Next Steps (Frontend)

### Pending Implementation

1. **Dashboard Weather Widget**
   - Current conditions card
   - Temperature, humidity, wind
   - Weather icon
   - Mini forecast

2. **Parcels Page Weather Panel**
   - Detailed weather for selected parcel
   - ET0 display
   - 24h forecast
   - Historical chart (optional)

3. **i18n Translations**
   - Weather terms (EN/IT)
   - Weather conditions
   - Units

4. **Weather-based Alerts**
   - Rain alerts
   - Temperature extremes
   - Wind warnings

## Future Enhancements (Phase 2 & 3)

### Irrigation DSS (Phase 2)
- Water balance calculations using ET0
- Soil moisture tracking
- Irrigation recommendations per parcel
- Deficit irrigation strategies
- Water stress alerts

### Pest & Disease DSS (Phase 3)
- **Olive Fly Risk Model**
  - Temperature + humidity-based predictions
  - Development cycle tracking
  - Intervention alerts

- **Fungal Disease Risk**
  - Wetness duration calculations
  - Temperature correlation
  - Infection risk alerts (Peacock spot, etc.)

- **Treatment Recommendations**
  - Optimal application windows
  - Weather-aware scheduling

## Database Schema

**weather_data table:**
```sql
CREATE TABLE weather_data (
  id SERIAL PRIMARY KEY,
  parcel_id INTEGER REFERENCES parcels(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  humidity INTEGER,
  precipitation DOUBLE PRECISION,
  wind_speed DOUBLE PRECISION,
  wind_direction INTEGER,
  cloud_cover INTEGER,
  pressure DOUBLE PRECISION,
  et0 DOUBLE PRECISION,
  soil_moisture DOUBLE PRECISION,
  rain_next_24h DOUBLE PRECISION,
  temp_min_24h DOUBLE PRECISION,
  temp_max_24h DOUBLE PRECISION,
  data_timestamp TIMESTAMP,
  fetched_at TIMESTAMP,
  farm_id INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_weather_data_parcel ON weather_data(parcel_id);
CREATE INDEX idx_weather_data_fetched ON weather_data(fetched_at);
```

## Configuration

No configuration required! The service works out of the box with Open-Meteo's free tier.

**Optional Environment Variables (future):**
- `WEATHER_CACHE_TTL` - Cache duration (default: 1h)
- `WEATHER_RETENTION_DAYS` - Data retention (default: 30 days)
- `WEATHER_REFRESH_INTERVAL` - Auto-refresh interval

## Resources

- [Open-Meteo API Docs](https://open-meteo.com/en/docs)
- [Open-Meteo Agriculture API](https://open-meteo.com/en/docs/agriculture-api)
- [FAO Penman-Monteith ET0](http://www.fao.org/3/X0490E/x0490e06.htm)

## Screenshots

### Dashboard Weather Widget

The weather widget displays on the Dashboard with:
- Large weather emoji and temperature
- Current humidity, wind speed, ET0, and rain forecast
- Last updated timestamp
- Auto-refreshes hourly

## Summary

✅ **Backend Complete** - Weather service fully functional with Open-Meteo API
✅ **Frontend Complete** - Live weather widget on Dashboard with beautiful UI
✅ **i18n Complete** - Full English and Italian translations
✅ **Testing Complete** - All unit tests passing
🎯 **Foundation Ready** - Ready for Irrigation & Pest/Disease DSS implementation

The weather integration provides **real, live data** for every parcel location, updated hourly, with intelligent caching and **no cost or API limits**. This is the foundation for smart, data-driven decision support systems!

### What You Can Do Now

1. **View Live Weather** - Open the Dashboard to see current conditions
2. **Switch Languages** - Toggle EN/IT to see translated weather terms
3. **API Access** - Use `GET /parcels/:id/weather` for programmatic access
4. **Build DSS** - Use weather data for irrigation and pest/disease models

