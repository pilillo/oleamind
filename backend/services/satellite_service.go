package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

const (
	STALE_THRESHOLD_DAYS    = 5
	RATE_LIMIT_HOURS        = 1
	WORKER_TIMEOUT_SECONDS  = 60
)

type SatelliteService struct{}

type NDVIResponse struct {
	Status          string    `json:"status"`
	Message         string    `json:"message"`
	NDVIMean        float64   `json:"ndvi_mean"`
	NDVIStd         float64   `json:"ndvi_std"`
	NDVIMin         float64   `json:"ndvi_min"`
	NDVIMax         float64   `json:"ndvi_max"`
	PixelsCount     int       `json:"pixels_count"`
	NDVIImage       string    `json:"ndvi_image"`
	ImageDimensions string    `json:"image_dimensions"`
	ImageBounds     []float64 `json:"image_bounds"`
	ProductDate     string    `json:"product_date"`
	CloudCover      float64   `json:"cloud_cover"`
	Satellite       string    `json:"satellite"`
}

type CachedNDVIResponse struct {
	NDVIResponse
	IsCached   bool `json:"is_cached"`
	IsStale    bool `json:"is_stale"`
	Refreshing bool `json:"refreshing"`
}

func NewSatelliteService() *SatelliteService {
	return &SatelliteService{}
}

// GetOrFetchNDVI implements the hybrid caching strategy
func (s *SatelliteService) GetOrFetchNDVI(parcelID uint, userTier string) (*CachedNDVIResponse, error) {
	// 1. Check cache
	cached, err := s.GetLatestCachedData(parcelID)
	if err != nil {
		// Log but don't fail - just proceed to fetch
		fmt.Printf("Warning: error checking cache: %v\n", err)
	}

	// 2. No cache - fetch synchronously
	if cached == nil {
		return s.fetchAndStore(parcelID, userTier, false)
	}

	// 3. Check staleness
	age := time.Since(cached.ProcessedAt)
	isStale := age > (STALE_THRESHOLD_DAYS * 24 * time.Hour)

	// 4. Check rate limit
	shouldRefetch := isStale && time.Since(cached.ProcessedAt) > (RATE_LIMIT_HOURS * time.Hour)

	// 5. Return cached data
	response := s.convertToResponse(cached)
	response.IsCached = true
	response.IsStale = isStale
	response.Refreshing = false

	// 6. Trigger async refresh if stale and not rate-limited
	if shouldRefetch {
		response.Refreshing = true
		go func() {
			// Fire-and-forget async fetch
			_, _ = s.fetchAndStore(parcelID, userTier, true)
		}()
	}

	return response, nil
}

// GetLatestCachedData retrieves the most recent satellite data for a parcel
func (s *SatelliteService) GetLatestCachedData(parcelID uint) (*models.SatelliteData, error) {
	var data models.SatelliteData
	result := initializers.DB.Where("parcel_id = ?", parcelID).
		Order("product_date DESC").
		First(&data)

	if result.Error != nil {
		// Check if it's a "not found" error - this is expected and not an error condition
		if result.Error.Error() == "record not found" {
			return nil, nil
		}
		return nil, result.Error
	}

	return &data, nil
}

// fetchAndStore calls the worker and stores the result based on user tier
func (s *SatelliteService) fetchAndStore(parcelID uint, userTier string, isAsync bool) (*CachedNDVIResponse, error) {
	// Get parcel geometry using ST_AsGeoJSON to get proper GeoJSON format
	var parcel models.Parcel
	if err := initializers.DB.Select("*, ST_AsGeoJSON(geo_json) as geo_json").First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("parcel not found: %v", err)
	}

	// Call worker
	ndviData, err := s.callWorker(parcel)
	if err != nil {
		return nil, fmt.Errorf("worker error: %v", err)
	}

	// Store based on tier
	if err := s.storeData(parcelID, userTier, ndviData); err != nil {
		return nil, fmt.Errorf("storage error: %v", err)
	}

	// Return response
	response := &CachedNDVIResponse{
		NDVIResponse: *ndviData,
		IsCached:     false,
		IsStale:      false,
		Refreshing:   false,
	}

	return response, nil
}

// callWorker makes HTTP request to the Python satellite worker
func (s *SatelliteService) callWorker(parcel models.Parcel) (*NDVIResponse, error) {
	workerURL := os.Getenv("WORKER_URL")
	if workerURL == "" {
		workerURL = "http://worker:5000"
	}

	// Parse GeoJSON
	var geojson map[string]interface{}
	if err := json.Unmarshal([]byte(parcel.GeoJSON), &geojson); err != nil {
		return nil, fmt.Errorf("failed to parse GeoJSON: %v", err)
	}

	// Prepare request
	requestBody := map[string]interface{}{
		"bbox": geojson,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// Make HTTP request
	client := &http.Client{
		Timeout: WORKER_TIMEOUT_SECONDS * time.Second,
	}

	resp, err := client.Post(workerURL+"/process", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to call worker: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("worker returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var ndviResp NDVIResponse
	if err := json.Unmarshal(body, &ndviResp); err != nil {
		return nil, fmt.Errorf("failed to parse worker response: %v", err)
	}

	return &ndviResp, nil
}

// storeData stores the NDVI data according to tier policy
func (s *SatelliteService) storeData(parcelID uint, userTier string, data *NDVIResponse) error {
	// Parse product date
	productDate, err := time.Parse("2006-01-02", data.ProductDate)
	if err != nil {
		productDate = time.Now()
	}

	// Serialize image bounds
	imageBoundsJSON, _ := json.Marshal(data.ImageBounds)

	// Create new record
	newData := models.SatelliteData{
		ParcelID:        parcelID,
		ProductDate:     productDate,
		ProcessedAt:     time.Now(),
		CloudCover:      data.CloudCover,
		NDVIMean:        data.NDVIMean,
		NDVIStd:         data.NDVIStd,
		NDVIMin:         data.NDVIMin,
		NDVIMax:         data.NDVIMax,
		PixelCount:      data.PixelsCount,
		ImageBase64:     data.NDVIImage,
		ImageBounds:     string(imageBoundsJSON),
		ImageDimensions: data.ImageDimensions,
		Satellite:       data.Satellite,
	}

	// For FREE tier: delete old entries before saving
	if userTier == "free" {
		if err := initializers.DB.Where("parcel_id = ?", parcelID).Delete(&models.SatelliteData{}).Error; err != nil {
			return fmt.Errorf("failed to delete old data: %v", err)
		}
	}

	// For PREMIUM tier: just append (keep history)
	if err := initializers.DB.Create(&newData).Error; err != nil {
		return fmt.Errorf("failed to save data: %v", err)
	}

	return nil
}

// convertToResponse converts a SatelliteData model to NDVIResponse
func (s *SatelliteService) convertToResponse(data *models.SatelliteData) *CachedNDVIResponse {
	var imageBounds []float64
	json.Unmarshal([]byte(data.ImageBounds), &imageBounds)

	return &CachedNDVIResponse{
		NDVIResponse: NDVIResponse{
			Status:          "success",
			Message:         "NDVI data retrieved",
			NDVIMean:        data.NDVIMean,
			NDVIStd:         data.NDVIStd,
			NDVIMin:         data.NDVIMin,
			NDVIMax:         data.NDVIMax,
			PixelsCount:     data.PixelCount,
			NDVIImage:       data.ImageBase64,
			ImageDimensions: data.ImageDimensions,
			ImageBounds:     imageBounds,
			ProductDate:     data.ProductDate.Format("2006-01-02"),
			CloudCover:      data.CloudCover,
			Satellite:       data.Satellite,
		},
		IsCached:   true,
		IsStale:    false,
		Refreshing: false,
	}
}

