package services

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// OpenMeteoResponse structure for current weather
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
		Time          []string  `json:"time"`
		TempMin       []float64 `json:"temperature_2m_min"`
		TempMax       []float64 `json:"temperature_2m_max"`
		Precipitation []float64 `json:"precipitation_sum"`
		ET0           []float64 `json:"et0_fao_evapotranspiration"`
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
		log.Printf("🌤️  Using cached weather data for parcel %d (age: %v)", parcelID, time.Since(weatherData.FetchedAt))
		return &weatherData, nil
	}

	// Fetch fresh data from Open-Meteo
	log.Printf("🌐 Fetching fresh weather data for parcel %d (lat: %.4f, lon: %.4f)", parcelID, lat, lon)
	freshData, err := s.fetchFromOpenMeteo(lat, lon, parcelID)
	if err != nil {
		// If we have stale data, return it with a warning
		if err == nil {
			log.Printf("⚠️  Using stale weather data due to fetch error: %v", err)
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

// fetchFromOpenMeteo calls the Open-Meteo API
func (s *WeatherService) fetchFromOpenMeteo(lat, lon float64, parcelID uint) (*models.WeatherData, error) {
	// Build API URL with all required parameters
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?"+
			"latitude=%.4f&longitude=%.4f&"+
			"current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,surface_pressure,et0_fao_evapotranspiration&"+
			"daily=temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration&"+
			"timezone=auto&"+
			"forecast_days=2",
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
		ParcelID:       parcelID,
		Latitude:       lat,
		Longitude:      lon,
		Temperature:    apiResp.Current.Temperature,
		Humidity:       apiResp.Current.Humidity,
		Precipitation:  apiResp.Current.Precipitation,
		WindSpeed:      apiResp.Current.WindSpeed,
		WindDirection:  apiResp.Current.WindDirection,
		CloudCover:     apiResp.Current.CloudCover,
		Pressure:       apiResp.Current.Pressure,
		ET0:            apiResp.Current.ET0,
		RainNext24h:    rainNext24h,
		TempMin24h:     tempMin24h,
		TempMax24h:     tempMax24h,
		DataTimestamp:  dataTime,
		FetchedAt:      time.Now(),
		FarmID:         1, // Default farm for MVP
	}

	// Save to database
	if err := initializers.DB.Create(weatherData).Error; err != nil {
		log.Printf("⚠️  Failed to save weather data: %v", err)
		// Don't return error - we still have the data
	} else {
		log.Printf("✅ Saved weather data for parcel %d (temp: %.1f°C, humidity: %d%%)", 
			parcelID, weatherData.Temperature, weatherData.Humidity)
	}

	// Clean up old weather data (keep last 30 days)
	cutoffDate := time.Now().AddDate(0, 0, -30)
	initializers.DB.Where("parcel_id = ? AND fetched_at < ?", parcelID, cutoffDate).
		Delete(&models.WeatherData{})

	return weatherData, nil
}

// GetWeatherForAllParcels fetches weather for all parcels (background job)
func (s *WeatherService) GetWeatherForAllParcels() error {
	var parcels []models.Parcel
	if err := initializers.DB.Select("id, ST_AsGeoJSON(geo_json) as geo_json").Find(&parcels).Error; err != nil {
		return err
	}

	log.Printf("🌍 Fetching weather for %d parcels", len(parcels))
	
	for _, parcel := range parcels {
		if _, err := s.GetWeatherForParcel(parcel.ID); err != nil {
			log.Printf("⚠️  Failed to fetch weather for parcel %d: %v", parcel.ID, err)
			// Continue with other parcels
		}
		// Small delay to avoid rate limiting
		time.Sleep(100 * time.Millisecond)
	}

	return nil
}

