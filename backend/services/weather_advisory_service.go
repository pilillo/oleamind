package services

import (
	"fmt"
	"time"

	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// WeatherAdvisoryService provides centralized weather-based advice
// This is the single source of truth for all weather-related decisions across DSS features
// It integrates with ClimateProfileService to consider location-based adjustments
type WeatherAdvisoryService struct {
	climateService *ClimateProfileService
}

func NewWeatherAdvisoryService() *WeatherAdvisoryService {
	return &WeatherAdvisoryService{
		climateService: NewClimateProfileService(),
	}
}

// ParcelContext holds location-aware context for a parcel
type ParcelContext struct {
	ParcelID         uint
	Latitude         float64
	IsNorthern       bool
	ClimateZone      string
	IrrigationFactor float64 // Multiplier for irrigation thresholds
	ETcMultiplier    float64 // Multiplier for evapotranspiration
	IsDormant        bool    // Whether trees are in dormancy period
	GrowingSeason    string  // "early", "mid", "late", "dormant"
}

// GetParcelContext retrieves location-aware context for a parcel
func (s *WeatherAdvisoryService) GetParcelContext(parcelID uint) (*ParcelContext, error) {
	// Get climate profile (location-aware)
	profile, err := s.climateService.GetOrCreateProfile(parcelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get climate profile: %w", err)
	}

	// Get parcel for latitude
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, fmt.Errorf("failed to get parcel: %w", err)
	}

	latitude := extractLatitudeFromParcel(parcel)
	zone := getGlobalClimateZone(latitude)
	currentMonth := int(time.Now().Month())

	ctx := &ParcelContext{
		ParcelID:         parcelID,
		Latitude:         latitude,
		IsNorthern:       latitude > 0,
		ClimateZone:      zone.Name,
		IrrigationFactor: profile.IrrigationFactor,
		ETcMultiplier:    profile.ETcMultiplier,
	}

	// Determine if currently in dormancy (using profile data)
	if profile.DormancyStartMonth != nil && profile.DormancyEndMonth != nil {
		ctx.IsDormant = isInDormancyPeriodFromMonths(currentMonth, *profile.DormancyStartMonth, *profile.DormancyEndMonth)
	}

	// Determine growing season phase
	ctx.GrowingSeason = getGrowingSeasonPhase(currentMonth, ctx.IsNorthern)

	return ctx, nil
}

// getGrowingSeasonPhase returns the current phase of the olive growing season
func getGrowingSeasonPhase(month int, isNorthern bool) string {
	// Adjust for hemisphere
	if !isNorthern {
		// Southern hemisphere: shift by 6 months
		month = ((month + 5) % 12) + 1
	}

	switch month {
	case 1, 2, 12: // Dec-Feb (Northern) or Jun-Aug (Southern)
		return "dormant"
	case 3, 4: // Mar-Apr: Bud break, early growth
		return "early"
	case 5, 6, 7: // May-Jul: Flowering, fruit set
		return "mid"
	case 8, 9, 10, 11: // Aug-Nov: Fruit development, harvest
		return "late"
	default:
		return "mid"
	}
}

// isInDormancyPeriodFromMonths checks if current month is in dormancy
func isInDormancyPeriodFromMonths(currentMonth, startMonth, endMonth int) bool {
	if startMonth <= endMonth {
		// Simple range (e.g., May to August in Southern hemisphere)
		return currentMonth >= startMonth && currentMonth <= endMonth
	}
	// Wrapping range (e.g., November to February in Northern hemisphere)
	return currentMonth >= startMonth || currentMonth <= endMonth
}

// extractLatitudeFromParcel extracts latitude from parcel geometry
func extractLatitudeFromParcel(parcel models.Parcel) float64 {
	return extractLatitudeFromGeometry(parcel.GeoJSON)
}

// ================================
// WEATHER THRESHOLDS (Centralized)
// ================================

const (
	// Precipitation thresholds (mm)
	PrecipNone      = 0.0  // No precipitation
	PrecipLight     = 1.0  // Light rain - minimal impact
	PrecipModerate  = 5.0  // Moderate rain - delays treatments, reduces irrigation need
	PrecipHeavy     = 10.0 // Heavy rain - no spraying, no irrigation
	PrecipExtreme   = 20.0 // Extreme rain - potential runoff, flooding risk

	// Wind thresholds (km/h)
	WindCalm     = 5.0  // Calm - ideal for spraying
	WindLight    = 10.0 // Light breeze - acceptable for spraying
	WindModerate = 15.0 // Moderate - marginal for spraying
	WindStrong   = 20.0 // Strong - do not spray (drift risk)
	WindGale     = 40.0 // Gale - dangerous conditions

	// Temperature thresholds (°C)
	TempFrost        = 0.0  // Frost risk
	TempCold         = 5.0  // Cold - slow pest activity
	TempOptPestMin   = 15.0 // Minimum for optimal pest activity
	TempOptSprayMin  = 10.0 // Minimum for spray application
	TempOptSprayMax  = 30.0 // Maximum for spray application (evaporates too fast above)
	TempOptPestMax   = 30.0 // Maximum for optimal pest activity
	TempHot          = 35.0 // Hot - reduced pest activity, plant stress
	TempExtreme      = 40.0 // Extreme heat - avoid all field operations

	// Humidity thresholds (%)
	HumidityLow      = 40  // Low humidity - high evaporation
	HumidityOptMin   = 50  // Optimal range start for spraying
	HumidityOptMax   = 80  // Optimal range end for spraying
	HumidityHigh     = 85  // High humidity - disease risk
	HumidityVeryHigh = 90  // Very high - high disease risk, poor spray drying

	// Time thresholds (hours)
	SprayDryingTime    = 4  // Hours needed for spray to dry before rain
	TreatmentCooldown  = 24 // Hours after treatment before irrigation
	IrrigationCooldown = 12 // Hours after irrigation before treatment
)

// ================================
// DAY CONDITION ASSESSMENT
// ================================

// DayConditions represents weather conditions for a specific day
type DayConditions struct {
	Date             time.Time
	DaysAhead        int
	TempMin          float64
	TempMax          float64
	TempAvg          float64
	Precipitation    float64 // mm
	PrecipProb       int     // %
	HumidityAvg      int
	HumidityMax      int
	WindSpeedMax     float64
	WindGustMax      float64
	ET0              float64
	ET0Adjusted      float64 // ET0 adjusted by climate multiplier
	SunshineDuration float64

	// Location-aware context
	ClimateZone   string
	GrowingSeason string
	IsDormant     bool

	// Calculated conditions
	IsDry         bool // < PrecipLight mm precipitation
	IsCalm        bool // < WindStrong km/h
	IsSprayable   bool // Good for spray application
	IsTreatWindow bool // Ideal treatment window
	IsIrrigatable bool // OK to irrigate
	HasFrostRisk  bool // Frost possible
	HasHeatRisk   bool // Extreme heat risk
	DiseaseRisk   bool // Conditions favor disease
	PestRisk      bool // Conditions favor pests
}

// GetDayConditionsWithContext analyzes weather data with location-aware adjustments
func (s *WeatherAdvisoryService) GetDayConditionsWithContext(forecast *models.DailyForecast, ctx *ParcelContext) DayConditions {
	cond := DayConditions{
		Date:             forecast.ForecastDate.Time,
		DaysAhead:        forecast.DaysAhead,
		TempMin:          forecast.TempMin,
		TempMax:          forecast.TempMax,
		TempAvg:          forecast.TempAvg,
		Precipitation:    forecast.PrecipitationSum,
		PrecipProb:       forecast.PrecipitationProb,
		HumidityAvg:      forecast.HumidityAvg,
		HumidityMax:      forecast.HumidityMax,
		WindSpeedMax:     forecast.WindSpeedMax,
		WindGustMax:      forecast.WindGustMax,
		ET0:              forecast.ET0,
		ET0Adjusted:      forecast.ET0 * ctx.ETcMultiplier, // Location-adjusted
		SunshineDuration: forecast.SunshineDur,
		ClimateZone:      ctx.ClimateZone,
		GrowingSeason:    ctx.GrowingSeason,
		IsDormant:        ctx.IsDormant,
	}

	// Calculate derived conditions
	cond.IsDry = forecast.PrecipitationSum < PrecipLight
	cond.IsCalm = forecast.WindSpeedMax < WindStrong
	cond.HasFrostRisk = forecast.TempMin <= TempFrost
	cond.HasHeatRisk = forecast.TempMax >= TempExtreme

	// Sprayable: dry, calm, moderate temperature, not too humid
	// In dormant season, spraying is generally not needed
	cond.IsSprayable = !ctx.IsDormant &&
		cond.IsDry &&
		cond.IsCalm &&
		forecast.TempAvg >= TempOptSprayMin &&
		forecast.TempAvg <= TempOptSprayMax &&
		forecast.HumidityMax < HumidityVeryHigh

	// Ideal treatment window: sprayable + sunny + no frost
	cond.IsTreatWindow = cond.IsSprayable &&
		forecast.SunshineDur > 4 &&
		!cond.HasFrostRisk

	// Irrigatable: no significant rain expected AND not in dormancy
	// Apply location-aware irrigation factor (lower value = irrigate earlier/more often)
	irrigationRainThreshold := PrecipModerate * ctx.IrrigationFactor
	cond.IsIrrigatable = !ctx.IsDormant &&
		forecast.PrecipitationSum < irrigationRainThreshold &&
		forecast.PrecipitationProb < 50

	// Disease risk: wet + moderate temp (10-25°C)
	// Peacock spot is more relevant in autumn/winter in Mediterranean climates
	isDiseaseSeason := ctx.GrowingSeason == "late" || ctx.GrowingSeason == "dormant"
	cond.DiseaseRisk = isDiseaseSeason &&
		(forecast.PrecipitationSum >= PrecipLight || forecast.HumidityMax >= HumidityHigh) &&
		forecast.TempAvg >= 5 && forecast.TempAvg <= 25

	// Pest risk (olive fly): warm + moderate humidity + dry
	// Olive fly is active primarily in late spring through autumn (fruit development)
	isPestSeason := ctx.GrowingSeason == "mid" || ctx.GrowingSeason == "late"
	cond.PestRisk = isPestSeason &&
		forecast.TempAvg >= TempOptPestMin &&
		forecast.TempAvg <= TempOptPestMax &&
		forecast.HumidityAvg >= 50 &&
		forecast.PrecipitationSum < PrecipHeavy

	return cond
}

// GetDayConditions is a convenience method that uses default context
// Prefer GetDayConditionsWithContext for location-aware advice
func (s *WeatherAdvisoryService) GetDayConditions(forecast *models.DailyForecast) DayConditions {
	// Fallback to a default context if parcel not available
	defaultCtx := &ParcelContext{
		Latitude:         40.0, // Default Mediterranean
		IsNorthern:       true,
		ClimateZone:      "Central Mediterranean",
		IrrigationFactor: 1.0,
		ETcMultiplier:    1.0,
		IsDormant:        false,
		GrowingSeason:    "mid",
	}
	return s.GetDayConditionsWithContext(forecast, defaultCtx)
}

// Get7DayConditions retrieves conditions for the next 7 days with location awareness
func (s *WeatherAdvisoryService) Get7DayConditions(parcelID uint) ([]DayConditions, error) {
	// Get location-aware context
	ctx, err := s.GetParcelContext(parcelID)
	if err != nil {
		// Fallback to default context
		ctx = &ParcelContext{
			ParcelID:         parcelID,
			Latitude:         40.0,
			IsNorthern:       true,
			ClimateZone:      "Central Mediterranean",
			IrrigationFactor: 1.0,
			ETcMultiplier:    1.0,
			GrowingSeason:    getGrowingSeasonPhase(int(time.Now().Month()), true),
		}
	}

	var forecasts []models.DailyForecast
	err = initializers.DB.Where("parcel_id = ?", parcelID).
		Order("days_ahead ASC").
		Limit(7).
		Find(&forecasts).Error

	if err != nil {
		return nil, err
	}

	conditions := make([]DayConditions, 0, len(forecasts))
	for _, f := range forecasts {
		conditions = append(conditions, s.GetDayConditionsWithContext(&f, ctx))
	}

	return conditions, nil
}

// ================================
// ADVISORY GENERATION
// ================================

// Advisory represents a single piece of weather-based advice
type Advisory struct {
	Type       string `json:"type"`       // irrigation, pest, disease, treatment, weather
	Priority   string `json:"priority"`   // critical, high, medium, low, info
	DaysAhead  int    `json:"days_ahead"` // Which day this applies to
	Message    string `json:"message"`
	Reason     string `json:"reason"`     // Why this advice is given
	Action     string `json:"action"`     // What to do
	AvoidUntil string `json:"avoid_until,omitempty"` // If something should be delayed
}

// WeatherAdvisory contains all advisories for a parcel
type WeatherAdvisory struct {
	ParcelID         uint        `json:"parcel_id"`
	ParcelName       string      `json:"parcel_name"`
	GeneratedAt      time.Time   `json:"generated_at"`

	// Location context
	ClimateZone      string      `json:"climate_zone"`
	GrowingSeason    string      `json:"growing_season"`
	IsDormant        bool        `json:"is_dormant"`
	Hemisphere       string      `json:"hemisphere"` // "northern" or "southern"

	// Advisories
	Advisories       []Advisory  `json:"advisories"`
	BestSprayDay     int         `json:"best_spray_day"`     // -1 if none in next 7 days
	BestIrrigateDay  int         `json:"best_irrigate_day"`  // -1 if none needed
	RainExpectedDays []int       `json:"rain_expected_days"` // Days with rain > 5mm
	Warnings         []string    `json:"warnings"`
}

// GenerateAdvisory creates comprehensive weather-based advice for a parcel
// Takes location (latitude, climate zone) into account for seasonally-appropriate advice
func (s *WeatherAdvisoryService) GenerateAdvisory(parcelID uint) (*WeatherAdvisory, error) {
	// Get parcel info
	var parcel models.Parcel
	if err := initializers.DB.First(&parcel, parcelID).Error; err != nil {
		return nil, err
	}

	// Get location-aware context
	ctx, err := s.GetParcelContext(parcelID)
	if err != nil {
		// Use default context
		ctx = &ParcelContext{
			ParcelID:         parcelID,
			Latitude:         40.0,
			IsNorthern:       true,
			ClimateZone:      "Central Mediterranean",
			IrrigationFactor: 1.0,
			ETcMultiplier:    1.0,
			GrowingSeason:    getGrowingSeasonPhase(int(time.Now().Month()), true),
		}
	}

	// Get 7-day conditions (already location-aware)
	conditions, err := s.Get7DayConditions(parcelID)
	if err != nil || len(conditions) == 0 {
		return &WeatherAdvisory{
			ParcelID:      parcelID,
			ParcelName:    parcel.Name,
			GeneratedAt:   time.Now(),
			ClimateZone:   ctx.ClimateZone,
			GrowingSeason: ctx.GrowingSeason,
			IsDormant:     ctx.IsDormant,
			Hemisphere:    getHemisphereString(ctx.IsNorthern),
			Advisories:    []Advisory{{Type: "info", Priority: "low", Message: "Weather forecast not available"}},
		}, nil
	}

	hemisphere := "northern"
	if !ctx.IsNorthern {
		hemisphere = "southern"
	}

	advisory := &WeatherAdvisory{
		ParcelID:         parcelID,
		ParcelName:       parcel.Name,
		GeneratedAt:      time.Now(),
		ClimateZone:      ctx.ClimateZone,
		GrowingSeason:    ctx.GrowingSeason,
		IsDormant:        ctx.IsDormant,
		Hemisphere:       hemisphere,
		Advisories:       []Advisory{},
		BestSprayDay:     -1,
		BestIrrigateDay:  -1,
		RainExpectedDays: []int{},
		Warnings:         []string{},
	}

	// If dormant, add a general advisory about reduced activity
	if ctx.IsDormant {
		advisory.Advisories = append(advisory.Advisories, Advisory{
			Type:     "info",
			Priority: "info",
			Message:  "Trees are in dormancy period - reduced irrigation and pest monitoring needed",
			Reason:   fmt.Sprintf("Current season: %s, Climate zone: %s", ctx.GrowingSeason, ctx.ClimateZone),
			Action:   "Focus on pruning, equipment maintenance, and orchard cleanup",
		})
	}

	// Find best spray day (considering dormancy)
	for _, c := range conditions {
		if c.IsTreatWindow && advisory.BestSprayDay == -1 && !ctx.IsDormant {
			advisory.BestSprayDay = c.DaysAhead
		}
		if c.IsIrrigatable && advisory.BestIrrigateDay == -1 && !ctx.IsDormant && c.ET0Adjusted > 3.0 {
			advisory.BestIrrigateDay = c.DaysAhead
		}
		if c.Precipitation >= PrecipModerate {
			advisory.RainExpectedDays = append(advisory.RainExpectedDays, c.DaysAhead)
		}
	}

	// Generate advisories for each day
	for i, cond := range conditions {
		// --- WEATHER WARNINGS ---
		if cond.HasFrostRisk {
			advisory.Advisories = append(advisory.Advisories, Advisory{
				Type:     "weather",
				Priority: "critical",
				DaysAhead: cond.DaysAhead,
				Message:  fmt.Sprintf("Frost risk on day %d (min %.1f°C)", cond.DaysAhead, cond.TempMin),
				Reason:   "Temperature dropping below freezing",
				Action:   "Protect sensitive plants, avoid irrigation late in day",
			})
		}

		if cond.HasHeatRisk {
			advisory.Advisories = append(advisory.Advisories, Advisory{
				Type:     "weather",
				Priority: "high",
				DaysAhead: cond.DaysAhead,
				Message:  fmt.Sprintf("Extreme heat on day %d (max %.1f°C)", cond.DaysAhead, cond.TempMax),
				Reason:   "Temperature exceeding safe limits",
				Action:   "Avoid field work midday, increase irrigation, monitor for heat stress",
			})
		}

		if cond.Precipitation >= PrecipExtreme {
			advisory.Advisories = append(advisory.Advisories, Advisory{
				Type:     "weather",
				Priority: "high",
				DaysAhead: cond.DaysAhead,
				Message:  fmt.Sprintf("Heavy rain expected day %d (%.0fmm)", cond.DaysAhead, cond.Precipitation),
				Reason:   "Significant precipitation expected",
				Action:   "Delay all spray treatments, skip irrigation, check drainage",
			})
		}

		if cond.WindGustMax >= WindGale {
			advisory.Advisories = append(advisory.Advisories, Advisory{
				Type:     "weather",
				Priority: "high",
				DaysAhead: cond.DaysAhead,
				Message:  fmt.Sprintf("Strong winds on day %d (gusts %.0f km/h)", cond.DaysAhead, cond.WindGustMax),
				Reason:   "Wind speed unsafe for field operations",
				Action:   "Avoid all spraying, secure equipment",
			})
		}

		// --- TREATMENT WINDOWS ---
		if cond.IsTreatWindow && cond.DaysAhead <= 3 {
			// Check if we need to treat before upcoming rain
			rainComing := false
			for j := i + 1; j < len(conditions) && j <= i+2; j++ {
				if conditions[j].Precipitation >= PrecipModerate {
					rainComing = true
					break
				}
			}

			if rainComing {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "treatment",
					Priority: "high",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("Day %d: Last good spray window before rain", cond.DaysAhead),
					Reason:   "Dry conditions now, rain expected soon",
					Action:   "Apply any planned treatments today, allow 4-6h drying time",
				})
			} else if cond.DaysAhead == advisory.BestSprayDay {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "treatment",
					Priority: "medium",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("Day %d: Ideal treatment window", cond.DaysAhead),
					Reason:   fmt.Sprintf("Dry (%.1fmm), calm (%.0f km/h), moderate temp (%.0f°C)", cond.Precipitation, cond.WindSpeedMax, cond.TempAvg),
					Action:   "Good conditions for spray application",
				})
			}
		}

		// --- IRRIGATION ADVICE ---
		if cond.DaysAhead <= 2 {
			if cond.Precipitation >= PrecipModerate {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "irrigation",
					Priority: "info",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("Skip irrigation day %d - rain expected (%.0fmm)", cond.DaysAhead, cond.Precipitation),
					Reason:   "Natural rainfall will provide water",
					Action:   "No irrigation needed, monitor soil moisture after rain",
				})
			} else if cond.ET0 > 5 && cond.IsDry {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "irrigation",
					Priority: "medium",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("High water demand day %d (ET0: %.1fmm)", cond.DaysAhead, cond.ET0),
					Reason:   "High evapotranspiration, dry conditions",
					Action:   "Ensure adequate irrigation, prefer early morning application",
				})
			}
		}

		// --- DISEASE RISK ---
		if cond.DiseaseRisk && cond.DaysAhead <= 3 {
			// Check if we should apply preventive fungicide
			if i > 0 && conditions[i-1].IsDry {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "disease",
					Priority: "high",
					DaysAhead: cond.DaysAhead - 1,
					Message:  fmt.Sprintf("Apply fungicide day %d before wet period", cond.DaysAhead-1),
					Reason:   fmt.Sprintf("Infection-favorable conditions expected day %d (%.0fmm rain, %d%% humidity, %.0f°C)", cond.DaysAhead, cond.Precipitation, cond.HumidityMax, cond.TempAvg),
					Action:   "Apply copper fungicide, ensure 4-6h drying time before rain",
				})
			} else {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "disease",
					Priority: "medium",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("Disease-favorable conditions day %d", cond.DaysAhead),
					Reason:   fmt.Sprintf("Wet (%.0fmm) + moderate temp (%.0f°C) = infection risk", cond.Precipitation, cond.TempAvg),
					Action:   "Monitor for symptoms, plan treatment for next dry window",
				})
			}
		}

		// --- PEST RISK ---
		if cond.PestRisk && cond.DaysAhead <= 3 {
			month := time.Now().AddDate(0, 0, cond.DaysAhead).Month()
			if month >= time.May && month <= time.October {
				advisory.Advisories = append(advisory.Advisories, Advisory{
					Type:     "pest",
					Priority: "medium",
					DaysAhead: cond.DaysAhead,
					Message:  fmt.Sprintf("Olive fly favorable conditions day %d", cond.DaysAhead),
					Reason:   fmt.Sprintf("Warm (%.0f°C), moderate humidity (%d%%), dry", cond.TempAvg, cond.HumidityAvg),
					Action:   "Check McPhail traps, monitor fruit for oviposition",
				})
			}
		}
	}

	// Add coordination warnings
	s.addCoordinationWarnings(advisory, conditions)

	return advisory, nil
}

// addCoordinationWarnings adds warnings about treatment/irrigation conflicts
func (s *WeatherAdvisoryService) addCoordinationWarnings(advisory *WeatherAdvisory, conditions []DayConditions) {
	// Find if spray and irrigation are both recommended on same day
	sprayDays := make(map[int]bool)
	irrigateDays := make(map[int]bool)

	for _, adv := range advisory.Advisories {
		if adv.Type == "treatment" && adv.Priority != "info" {
			sprayDays[adv.DaysAhead] = true
		}
		if adv.Type == "irrigation" && adv.Priority == "medium" {
			irrigateDays[adv.DaysAhead] = true
		}
	}

	for day := range sprayDays {
		if irrigateDays[day] {
			advisory.Warnings = append(advisory.Warnings,
				fmt.Sprintf("Day %d: If treating, irrigate in morning and spray in evening (or skip irrigation)", day))
		}
	}

	// Check for upcoming rain after spray days
	for day := range sprayDays {
		for _, c := range conditions {
			if c.DaysAhead == day+1 && c.Precipitation >= PrecipModerate {
				// Already covered by "last window before rain" advisory
				break
			}
		}
	}
}

// ================================
// HELPER METHODS FOR OTHER SERVICES
// ================================

// ShouldIrrigate checks if irrigation is advisable given weather
func (s *WeatherAdvisoryService) ShouldIrrigate(parcelID uint) (bool, string) {
	conditions, err := s.Get7DayConditions(parcelID)
	if err != nil || len(conditions) == 0 {
		return true, "Weather data unavailable - use soil moisture to decide"
	}

	today := conditions[0]

	if today.Precipitation >= PrecipModerate {
		return false, fmt.Sprintf("Rain expected today (%.0fmm) - skip irrigation", today.Precipitation)
	}

	if len(conditions) > 1 && conditions[1].Precipitation >= PrecipHeavy {
		return false, fmt.Sprintf("Heavy rain tomorrow (%.0fmm) - consider skipping irrigation", conditions[1].Precipitation)
	}

	if today.HasFrostRisk {
		return false, "Frost risk - avoid late irrigation"
	}

	return true, "Weather suitable for irrigation"
}

// ShouldSpray checks if spray application is advisable given weather
func (s *WeatherAdvisoryService) ShouldSpray(parcelID uint) (bool, string, int) {
	conditions, err := s.Get7DayConditions(parcelID)
	if err != nil || len(conditions) == 0 {
		return false, "Weather data unavailable - check conditions manually", -1
	}

	today := conditions[0]

	if !today.IsDry {
		// Find next dry day
		for _, c := range conditions[1:] {
			if c.IsSprayable {
				return false, fmt.Sprintf("Rain today - wait for day %d", c.DaysAhead), c.DaysAhead
			}
		}
		return false, "No good spray window in next 7 days", -1
	}

	if !today.IsCalm {
		return false, fmt.Sprintf("Too windy (%.0f km/h) - spray drift risk", today.WindSpeedMax), -1
	}

	if today.TempAvg < TempOptSprayMin {
		return false, fmt.Sprintf("Too cold (%.0f°C) - reduced efficacy", today.TempAvg), -1
	}

	if today.TempAvg > TempOptSprayMax {
		return false, fmt.Sprintf("Too hot (%.0f°C) - rapid evaporation", today.TempAvg), -1
	}

	if today.HumidityMax >= HumidityVeryHigh {
		return false, fmt.Sprintf("Humidity too high (%d%%) - slow drying", today.HumidityMax), -1
	}

	// Check if rain coming soon
	for _, c := range conditions[1:3] {
		if c.Precipitation >= PrecipModerate {
			return true, fmt.Sprintf("Apply today - rain expected day %d", c.DaysAhead), 0
		}
	}

	return true, "Good conditions for spray application", 0
}

// GetBestTreatmentWindow finds the best day for treatment in next N days
func (s *WeatherAdvisoryService) GetBestTreatmentWindow(parcelID uint, maxDays int) (int, string) {
	conditions, err := s.Get7DayConditions(parcelID)
	if err != nil || len(conditions) == 0 {
		return -1, "Weather data unavailable"
	}

	for _, c := range conditions {
		if c.DaysAhead > maxDays {
			break
		}
		if c.IsTreatWindow {
			return c.DaysAhead, fmt.Sprintf("Day %d: dry, calm, %.0f°C", c.DaysAhead, c.TempAvg)
		}
	}

	// If no ideal window, find best compromise
	for _, c := range conditions {
		if c.DaysAhead > maxDays {
			break
		}
		if c.IsSprayable {
			return c.DaysAhead, fmt.Sprintf("Day %d: acceptable conditions", c.DaysAhead)
		}
	}

	return -1, "No suitable treatment window in next " + fmt.Sprintf("%d", maxDays) + " days"
}

// getHemisphereString returns "northern" or "southern" based on latitude
func getHemisphereString(isNorthern bool) string {
	if isNorthern {
		return "northern"
	}
	return "southern"
}

