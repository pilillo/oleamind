package main

import (
	"log/slog"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/controllers"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/middleware"
	"github.com/oleamind/backend/models" // Keep models for AutoMigrate
)

func init() {
	initializers.ConnectToDB()
}

func main() {
	// Initialize structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	r := gin.Default()

	// CORS middleware - Configure to allow Authorization header
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Enable PostGIS extension if not exists
	initializers.DB.Exec("CREATE EXTENSION IF NOT EXISTS postgis")

	// Migrations
	initializers.DB.AutoMigrate(
		&models.User{},
		&models.Session{}, // Add Session model
		&models.Farm{},
		&models.UserFarm{}, // User-Farm join table with roles
		&models.Parcel{},
		&models.ParcelVariety{},
		&models.InventoryItem{},
		&models.OperationLog{},
		&models.SatelliteData{},
		&models.WeatherData{},
		&models.WeatherForecast{},
		&models.IrrigationEvent{},
		&models.IrrigationRecommendation{},
		&models.SoilProfile{},
		&models.IrrigationSystem{},
		&models.PestRiskAssessment{},
		&models.TreatmentThreshold{},
		&models.TreatmentLog{},
		&models.PestMonitoring{},
		&models.HarvestLog{},
		&models.YieldPrediction{},
		&models.Mill{},
		&models.OliveDelivery{},
		&models.OilBatch{},
		&models.OilBatchSource{},
		&models.OilQualityAnalysis{},
		&models.OilBottling{},
		&models.OilInventory{},
		&models.OilSale{},
	)

	// Purge NDVI cache on startup if configured (useful for development/debugging)
	if os.Getenv("PURGE_NDVI_CACHE_ON_STARTUP") == "true" {
		slog.Info("Purging NDVI cache on startup (PURGE_NDVI_CACHE_ON_STARTUP=true)")
		result := initializers.DB.Exec("DELETE FROM satellite_data")
		if result.Error != nil {
			slog.Error("Failed to purge NDVI cache", "error", result.Error)
		} else {
			slog.Info("Purged NDVI records from cache", "count", result.RowsAffected)
		}
	} else {
		slog.Info("NDVI cache purge disabled (set PURGE_NDVI_CACHE_ON_STARTUP=true to enable)")
	}

	// ==================== PUBLIC ROUTES ====================
	// Authentication Routes (no auth required)
	auth := r.Group("/auth")
	{
		auth.POST("/register", controllers.Register)
		auth.POST("/login", controllers.Login)
		auth.POST("/logout", controllers.Logout)
		auth.POST("/forgot-password", controllers.ForgotPassword)
		auth.POST("/reset-password", controllers.ResetPassword)
		auth.GET("/verify-email", controllers.VerifyEmail)
	}

	// ==================== PROTECTED ROUTES ====================
	// All routes below require authentication
	protected := r.Group("/")
	protected.Use(middleware.AuthMiddleware())
	{
		// Auth - Current User
		protected.GET("/auth/me", controllers.GetCurrentUser)
		protected.POST("/auth/refresh", controllers.RefreshToken)
		protected.PUT("/auth/profile", controllers.UpdateProfile)
		protected.POST("/auth/change-password", controllers.ChangePassword)

		// User Management (Owner only)
		users := protected.Group("/users")
		users.Use(middleware.RequireRole("owner"))
		{
			users.GET("", controllers.GetUsers)
			users.GET("/:id", controllers.GetUser)
			users.POST("", controllers.CreateUser)
			users.PUT("/:id", controllers.UpdateUser)
			users.POST("/:id/deactivate", controllers.DeactivateUser)
			users.POST("/:id/activate", controllers.ActivateUser)
		}

		// Parcel Routes
		protected.POST("/parcels", controllers.CreateParcel)
		protected.GET("/parcels", controllers.GetParcels)
		protected.PUT("/parcels/:id", controllers.UpdateParcel)
		protected.DELETE("/parcels/:id", controllers.DeleteParcel)
		protected.POST("/parcels/:id/satellite", controllers.ProcessSatellite)

		// Inventory Routes
		protected.POST("/inventory", controllers.CreateInventoryItem)
		protected.GET("/inventory", controllers.GetInventory)
		protected.PUT("/inventory/:id", controllers.UpdateInventoryItem)
		protected.DELETE("/inventory/:id", controllers.DeleteInventoryItem)
		protected.GET("/inventory/low-stock", controllers.GetLowStock)

		// Operation Routes
		protected.POST("/operations", controllers.CreateOperation)
		protected.GET("/operations", controllers.GetOperations)
		protected.GET("/operations/:id", controllers.GetOperation)
		protected.PUT("/operations/:id", controllers.UpdateOperation)
		protected.DELETE("/operations/:id", controllers.DeleteOperation)
		protected.GET("/parcels/:parcel_id/operations", controllers.GetOperationsByParcel)
		protected.GET("/operations/phytosanitary", controllers.GetPhytosanitaryRegister)

		// Weather Routes
		protected.GET("/parcels/:parcel_id/weather", controllers.GetWeatherForParcel)
		protected.POST("/weather/refresh", controllers.RefreshAllWeather)

		// Irrigation Routes
		protected.GET("/irrigation/recommendation/:parcel_id", controllers.GetIrrigationRecommendation)
		protected.POST("/irrigation/events", controllers.LogIrrigationEvent)
		protected.GET("/irrigation/history/:parcel_id", controllers.GetIrrigationHistory)
		protected.GET("/irrigation/stats/:parcel_id", controllers.GetWaterUsageStats)
		protected.PUT("/irrigation/soil/:parcel_id", controllers.UpdateSoilProfile)
		protected.PUT("/irrigation/system/:parcel_id", controllers.UpdateIrrigationSystem)

		// Pest Control Routes
		protected.GET("/pests/risk/:parcel_id", controllers.GetPestRisk)
		protected.GET("/pests/risk-history/:parcel_id", controllers.GetPestRiskHistory)
		protected.POST("/pests/treatments", controllers.LogTreatment)
		protected.GET("/pests/treatments/:parcel_id", controllers.GetTreatmentHistory)
		protected.POST("/pests/monitoring", controllers.LogMonitoring)
		protected.GET("/pests/monitoring/:parcel_id", controllers.GetMonitoringHistory)

		// Harvest & Yield Routes
		protected.POST("/harvests", controllers.LogHarvest)
		protected.GET("/harvests", controllers.GetAllHarvests)
		protected.GET("/harvests/:parcel_id", controllers.GetHarvestHistory)
		protected.PUT("/harvests/:id", controllers.UpdateHarvest)
		protected.DELETE("/harvests/:id", controllers.DeleteHarvest)
		protected.GET("/yield/stats/:parcel_id", controllers.GetYieldStats)
		protected.GET("/costs/summary/:parcel_id", controllers.GetCostSummary)
		protected.POST("/yield/predictions", controllers.CreateYieldPrediction)
		protected.GET("/yield/predictions/:parcel_id", controllers.GetYieldPredictions)
		protected.POST("/yield/predict/:parcel_id", controllers.PredictYield)

		// Analytics Routes
		protected.GET("/analytics/yield-trends/:parcel_id", controllers.GetYieldTrends)
		protected.GET("/analytics/cost-efficiency", controllers.GetCostEfficiency)
		protected.GET("/analytics/parcel-comparison", controllers.GetParcelComparison)
		protected.GET("/analytics/export/parcel-report/:parcel_id", controllers.ExportParcelReportPDF)
		protected.GET("/analytics/export/comparison-report", controllers.ExportComparisonReportPDF)

		// Satellite Data Routes
		protected.GET("/satellite/:id/latest", controllers.GetLatestSatelliteData)
		protected.GET("/satellite/:id/history", controllers.GetSatelliteHistory)
		protected.GET("/satellite/:id/indices/:index", controllers.GetSatelliteIndexHistory)

		// Mills Management Routes
		protected.POST("/mills", controllers.CreateMill)
		protected.GET("/mills", controllers.GetMills)
		protected.GET("/mills/:id", controllers.GetMill)
		protected.PUT("/mills/:id", controllers.UpdateMill)
		protected.DELETE("/mills/:id", controllers.DeleteMill)

		// Olive Delivery Routes
		protected.POST("/deliveries", controllers.CreateDelivery)
		protected.GET("/deliveries", controllers.GetDeliveries)
		protected.PUT("/deliveries/:id", controllers.UpdateDelivery)
		protected.DELETE("/deliveries/:id", controllers.DeleteDelivery)

		// Oil Batch Routes
		protected.POST("/oil-batches", controllers.CreateOilBatch)
		protected.GET("/oil-batches", controllers.GetOilBatches)
		protected.GET("/oil-batches/:id", controllers.GetOilBatch)
		protected.PUT("/oil-batches/:id", controllers.UpdateOilBatch)
		protected.GET("/oil-batches/traceability/:batch_id", controllers.GetBatchTraceability)

		// Quality Analysis Routes
		protected.POST("/quality-analyses", controllers.CreateQualityAnalysis)
		protected.GET("/quality-analyses/:batch_id", controllers.GetQualityAnalyses)

		// Bottling Routes
		protected.POST("/bottlings", controllers.CreateBottling)
		protected.GET("/bottlings", controllers.GetBottlings)

		// Sales Routes
		protected.POST("/sales", controllers.CreateSale)
		protected.GET("/sales", controllers.GetSales)
		protected.PUT("/sales/:id", controllers.UpdateSale)

		// Production Statistics
		protected.GET("/production/stats", controllers.GetProductionStats)
	}

	r.Run()
}
