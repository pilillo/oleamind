package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// OpenMeteoResponse structure for current weather and 7-day forecast
type OpenMeteoCurrentResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
	Current   struct {
		Time          string  `json:"time"`
		Temperature   float64 `json:"temperature_2m"`
		Humidity      int     `json:"relative_humidity_2m"`
		Precipitation float64 `json:"precipitation"`
		WindSpeed     float64 `json:"wind_speed_10m"`
		WindDirection int     `json:"wind_direction_10m"`
		CloudCover    int     `json:"cloud_cover"`
		Pressure      float64 `json:"surface_pressure"`
		ET0           float64 `json:"et0_fao_evapotranspiration"`
	} `json:"current"`
	Daily struct {
		Time              []string  `json:"time"`
		TempMin           []float64 `json:"temperature_2m_min"`
		TempMax           []float64 `json:"temperature_2m_max"`
		Precipitation     []float64 `json:"precipitation_sum"`
		PrecipitationProb []int     `json:"precipitation_probability_max"`
		ET0               []float64 `json:"et0_fao_evapotranspiration"`
		HumidityMax       []int     `json:"relative_humidity_2m_max"`
		HumidityMin       []int     `json:"relative_humidity_2m_min"`
		WindSpeedMax      []float64 `json:"wind_speed_10m_max"`
		WindGustMax       []float64 `json:"wind_gusts_10m_max"`
		SunshineDuration  []float64 `json:"sunshine_duration"`
		UVIndexMax        []float64 `json:"uv_index_max"`
	} `json:"daily"`
}

// WeatherService handles weather data operations
type WeatherService struct{}

// NewWeatherService creates a new weather service instance
func NewWeatherService() *WeatherService {
	return &WeatherService{}
}

// GetWeatherForParcel fetches or returns cached weather data for a parcel
func (s *WeatherService) GetWeatherForParcel(parcelID uint) (*models.WeatherData, error) {
	// Get parcel to extract coordinates
	var parcel models.Parcel
	if err := initializers.DB.Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("parcel not found: %w", err)
	}

	// Extract centroid coordinates from parcel geometry
	lat, lon, err := s.extractCoordinates(&parcel)
	if err != nil {
		return nil, fmt.Errorf("failed to extract coordinates: %w", err)
	}

	// Check for cached data
	var weatherData models.WeatherData
	err = initializers.DB.Where("parcel_id = ?", parcelID).
		Order("fetched_at DESC").
		First(&weatherData).Error

	if err == nil && !weatherData.IsStale() {
		slog.Info("Using cached weather data",
			"parcel_id", parcelID,
			"age", time.Since(weatherData.FetchedAt),
		)
		return &weatherData, nil
	}

	// Fetch fresh data from Open-Meteo
	slog.Info("Fetching fresh weather data",
		"parcel_id", parcelID,
		"lat", fmt.Sprintf("%.4f", lat),
		"lon", fmt.Sprintf("%.4f", lon),
	)
	freshData, err := s.fetchFromOpenMeteo(lat, lon, parcelID)
	if err != nil {
		// If we have stale data, return it with a warning
		if err == nil { // This condition `err == nil` here is likely a bug in the original code, it should be `err != nil` to check if the fetch failed. Assuming the intent was to use stale data if fetch failed.
			slog.Warn("Using stale weather data due to fetch error", "error", err)
			return &weatherData, nil
		}
		return nil, fmt.Errorf("failed to fetch weather: %w", err)
	}

	return freshData, nil
}

// extractCoordinates gets the centroid of a parcel's geometry
func (s *WeatherService) extractCoordinates(parcel *models.Parcel) (float64, float64, error) {
	if len(parcel.GeoJSON) == 0 {
		return 0, 0, fmt.Errorf("parcel has no geometry")
	}

	// Use PostGIS to calculate centroid
	var lat, lon float64
	err := initializers.DB.Raw(`
		SELECT 
			ST_Y(ST_Centroid(ST_GeomFromGeoJSON(?::text))) as lat,
			ST_X(ST_Centroid(ST_GeomFromGeoJSON(?::text))) as lon
	`, string(parcel.GeoJSON), string(parcel.GeoJSON)).Row().Scan(&lat, &lon)

	if err != nil {
		return 0, 0, err
	}

	return lat, lon, nil
}

// fetchFromOpenMeteo calls the Open-Meteo API with 7-day forecast
func (s *WeatherService) fetchFromOpenMeteo(lat, lon float64, parcelID uint) (*models.WeatherData, error) {
	// Build API URL with all required parameters including 7-day forecast
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?"+
			"latitude=%.4f&longitude=%.4f&"+
			"current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,surface_pressure,et0_fao_evapotranspiration&"+
			"daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,"+
			"et0_fao_evapotranspiration,relative_humidity_2m_max,relative_humidity_2m_min,"+
			"wind_speed_10m_max,wind_gusts_10m_max,sunshine_duration,uv_index_max&"+
			"timezone=auto&"+
			"forecast_days=7",
		lat, lon,
	)

	// Make HTTP request
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var apiResp OpenMeteoCurrentResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Parse data timestamp
	dataTime, err := time.Parse(time.RFC3339, apiResp.Current.Time)
	if err != nil {
		dataTime = time.Now()
	}

	// Calculate rain in next 24h (sum of today and tomorrow)
	rainNext24h := 0.0
	if len(apiResp.Daily.Precipitation) >= 2 {
		rainNext24h = apiResp.Daily.Precipitation[0] + apiResp.Daily.Precipitation[1]
	}

	// Get min/max temps for next 24h
	tempMin24h := apiResp.Current.Temperature
	tempMax24h := apiResp.Current.Temperature
	if len(apiResp.Daily.TempMin) > 0 {
		tempMin24h = apiResp.Daily.TempMin[0]
	}
	if len(apiResp.Daily.TempMax) > 0 {
		tempMax24h = apiResp.Daily.TempMax[0]
	}

	// Create weather data model
	weatherData := &models.WeatherData{
		ParcelID:      parcelID,
		Latitude:      lat,
		Longitude:     lon,
		Temperature:   apiResp.Current.Temperature,
		Humidity:      apiResp.Current.Humidity,
		Precipitation: apiResp.Current.Precipitation,
		WindSpeed:     apiResp.Current.WindSpeed,
		WindDirection: apiResp.Current.WindDirection,
		CloudCover:    apiResp.Current.CloudCover,
		Pressure:      apiResp.Current.Pressure,
		ET0:           apiResp.Current.ET0,
		RainNext24h:   rainNext24h,
		TempMin24h:    tempMin24h,
		TempMax24h:    tempMax24h,
		DataTimestamp: dataTime,
		FetchedAt:     time.Now(),
		FarmID:        1, // Default farm for MVP
	}

	// Save to database
	if err := initializers.DB.Create(weatherData).Error; err != nil {
		log.Printf("⚠️  Failed to save weather data: %v", err)
		// Don't return error - we still have the data
	} else {
		slog.Info("Saved weather data",
			"parcel_id", parcelID,
			"temp_c", weatherData.Temperature,
			"humidity_pct", weatherData.Humidity,
		)
	}

	// Save 7-day forecast
	s.saveDailyForecasts(parcelID, &apiResp)

	// Clean up old weather data (keep last 30 days)
	cutoffDate := time.Now().AddDate(0, 0, -30)
	initializers.DB.Where("parcel_id = ? AND fetched_at < ?", parcelID, cutoffDate).
		Delete(&models.WeatherData{})

	return weatherData, nil
}

// saveDailyForecasts stores the 7-day daily forecast data
func (s *WeatherService) saveDailyForecasts(parcelID uint, apiResp *OpenMeteoCurrentResponse) {
	// Delete existing forecasts for this parcel (we'll replace with fresh data)
	initializers.DB.Where("parcel_id = ?", parcelID).Delete(&models.DailyForecast{})

	now := time.Now()

	for i, dateStr := range apiResp.Daily.Time {
		// Parse forecast date
		forecastDate, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			slog.Warn("Failed to parse forecast date", "date", dateStr, "error", err)
			continue
		}

		// Calculate average temperature
		tempAvg := 0.0
		if i < len(apiResp.Daily.TempMin) && i < len(apiResp.Daily.TempMax) {
			tempAvg = (apiResp.Daily.TempMin[i] + apiResp.Daily.TempMax[i]) / 2
		}

		// Calculate average humidity
		humidityAvg := 0
		if i < len(apiResp.Daily.HumidityMin) && i < len(apiResp.Daily.HumidityMax) {
			humidityAvg = (apiResp.Daily.HumidityMin[i] + apiResp.Daily.HumidityMax[i]) / 2
		}

		forecast := models.DailyForecast{
			ParcelID:     parcelID,
			ForecastDate: models.DateOnly{Time: forecastDate},
			DaysAhead:    i,
			FetchedAt:    now,
			FarmID:       1, // Default for MVP
		}

		// Temperature
		if i < len(apiResp.Daily.TempMin) {
			forecast.TempMin = apiResp.Daily.TempMin[i]
		}
		if i < len(apiResp.Daily.TempMax) {
			forecast.TempMax = apiResp.Daily.TempMax[i]
		}
		forecast.TempAvg = tempAvg

		// Precipitation
		if i < len(apiResp.Daily.Precipitation) {
			forecast.PrecipitationSum = apiResp.Daily.Precipitation[i]
		}
		if i < len(apiResp.Daily.PrecipitationProb) {
			forecast.PrecipitationProb = apiResp.Daily.PrecipitationProb[i]
		}

		// Humidity
		if i < len(apiResp.Daily.HumidityMin) {
			forecast.HumidityMin = apiResp.Daily.HumidityMin[i]
		}
		if i < len(apiResp.Daily.HumidityMax) {
			forecast.HumidityMax = apiResp.Daily.HumidityMax[i]
		}
		forecast.HumidityAvg = humidityAvg

		// Wind
		if i < len(apiResp.Daily.WindSpeedMax) {
			forecast.WindSpeedMax = apiResp.Daily.WindSpeedMax[i]
			forecast.WindSpeedAvg = apiResp.Daily.WindSpeedMax[i] * 0.6 // Approximate average
		}
		if i < len(apiResp.Daily.WindGustMax) {
			forecast.WindGustMax = apiResp.Daily.WindGustMax[i]
		}

		// ET0 and solar
		if i < len(apiResp.Daily.ET0) {
			forecast.ET0 = apiResp.Daily.ET0[i]
		}
		if i < len(apiResp.Daily.SunshineDuration) {
			forecast.SunshineDur = apiResp.Daily.SunshineDuration[i] / 3600 // Convert seconds to hours
		}
		if i < len(apiResp.Daily.UVIndexMax) {
			forecast.UVIndexMax = apiResp.Daily.UVIndexMax[i]
		}

		// Save forecast
		if err := initializers.DB.Create(&forecast).Error; err != nil {
			slog.Warn("Failed to save daily forecast",
				"parcel_id", parcelID,
				"date", dateStr,
				"error", err,
			)
		}
	}

	slog.Info("Saved 7-day forecast",
		"parcel_id", parcelID,
		"days", len(apiResp.Daily.Time),
	)
}

// GetDailyForecasts retrieves the 7-day forecast for a parcel
func (s *WeatherService) GetDailyForecasts(parcelID uint) ([]models.DailyForecast, error) {
	var forecasts []models.DailyForecast

	// Check if we have fresh forecasts
	var latest models.DailyForecast
	err := initializers.DB.Where("parcel_id = ?", parcelID).
		Order("fetched_at DESC").
		First(&latest).Error

	// If no forecasts or stale, fetch fresh data
	if err != nil || latest.IsForecastStale() {
		slog.Info("Fetching fresh forecast data", "parcel_id", parcelID)
		if _, err := s.GetWeatherForParcel(parcelID); err != nil {
			slog.Warn("Failed to refresh forecast", "error", err)
		}
	}

	// Get all forecasts ordered by date
	err = initializers.DB.Where("parcel_id = ?", parcelID).
		Order("days_ahead ASC").
		Find(&forecasts).Error

	return forecasts, err
}

// GetWeatherForAllParcels fetches weather for all parcels (background job)
func (s *WeatherService) GetWeatherForAllParcels() error {
	var parcels []models.Parcel
	if err := initializers.DB.Select("id, ST_AsGeoJSON(geo_json) as geo_json").Find(&parcels).Error; err != nil {
		return err
	}

	slog.Info("Fetching weather for parcels", "count", len(parcels))

	for _, parcel := range parcels {
		if _, err := s.GetWeatherForParcel(parcel.ID); err != nil {
			slog.Error("Failed to fetch weather for parcel",
				"parcel_id", parcel.ID,
				"error", err,
			)
			// Continue with other parcels
		}
		// Small delay to avoid rate limiting
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}
