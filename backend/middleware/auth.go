package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// AuthMiddleware validates JWT tokens and loads user into context
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header or cookie
		tokenString := extractToken(c)

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(os.Getenv("SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Check expiration
		if exp, ok := claims["exp"].(float64); ok {
			if time.Now().Unix() > int64(exp) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token expired"})
				c.Abort()
				return
			}
		}

		// Load user from database with farms
		userID := uint(claims["sub"].(float64))
		var user models.User
		if err := initializers.DB.Preload("Farms").Preload("UserFarms").First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		// Check if user is active
		if !user.Active {
			c.JSON(http.StatusForbidden, gin.H{"error": "User account is deactivated"})
			c.Abort()
			return
		}

		// Store user in context
		c.Set("user", user)
		c.Set("userId", user.ID)

		c.Next()
	}
}

// RequireRole checks if user has one of the required roles (legacy - checks if user is owner of any farm)
// For farm-scoped roles, use RequireFarmRole instead
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		u := user.(models.User)

		// Check if user is owner of any farm
		var count int64
		initializers.DB.Model(&models.Farm{}).Where("owner_id = ?", u.ID).Count(&count)

		if count > 0 {
			// User is owner of at least one farm
			for _, requiredRole := range roles {
				if requiredRole == "owner" {
					c.Next()
					return
				}
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// RequireFarmRole checks if user has required role for a specific farm
// Farm ID should be set in context by RequireFarmAccess or extracted from request
func RequireFarmRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, _ := c.Get("user")
		farmID, exists := c.Get("farmId")

		if !exists {
			// Try to get from query/param
			farmID = getFarmIDFromRequest(c)
			if farmID == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Farm ID required"})
				c.Abort()
				return
			}
		}

		u := user.(models.User)
		fID := farmID.(uint)

		// Check if user is owner of this farm
		var farm models.Farm
		if err := initializers.DB.Where("id = ? AND owner_id = ?", fID, u.ID).First(&farm).Error; err == nil {
			// User is owner - has all permissions
			c.Set("farmId", fID)
			c.Next()
			return
		}

		// Check user's role in UserFarm join table
		var userFarm models.UserFarm
		if err := initializers.DB.Where("user_id = ? AND farm_id = ?", u.ID, fID).First(&userFarm).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to this farm"})
			c.Abort()
			return
		}

		for _, requiredRole := range roles {
			if userFarm.Role == requiredRole {
				c.Set("farmId", fID)
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions for this farm"})
		c.Abort()
	}
}

// RequireFarmAccess ensures user has access to the requested farm
// Extracts farm ID from request and verifies user has access
func RequireFarmAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, _ := c.Get("user")
		u := user.(models.User)

		farmID := getFarmIDFromRequest(c)
		if farmID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Farm ID required"})
			c.Abort()
			return
		}

		fID := farmID.(uint)

		// Check if user is owner
		var farm models.Farm
		if err := initializers.DB.Where("id = ? AND owner_id = ?", fID, u.ID).First(&farm).Error; err == nil {
			c.Set("farmId", fID)
			c.Set("farm", farm)
			c.Next()
			return
		}

		// Check if user has access via UserFarm
		var count int64
		initializers.DB.Model(&models.UserFarm{}).
			Where("user_id = ? AND farm_id = ?", u.ID, fID).
			Count(&count)

		if count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to this farm"})
			c.Abort()
			return
		}

		// Load farm for context
		initializers.DB.First(&farm, fID)
		c.Set("farmId", fID)
		c.Set("farm", farm)
		c.Next()
	}
}

// RequireFarmTier checks if farm has required subscription tier
func RequireFarmTier(tiers ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		farm, exists := c.Get("farm")
		if !exists {
			farmID, _ := c.Get("farmId")
			if farmID == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Farm context required"})
				c.Abort()
				return
			}
			var f models.Farm
			if err := initializers.DB.First(&f, farmID).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Farm not found"})
				c.Abort()
				return
			}
			farm = f
		}

		f := farm.(models.Farm)

		// Check subscription status
		if f.SubscriptionStatus != "active" {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error":  "Subscription required",
				"tier":   f.Tier,
				"status": f.SubscriptionStatus,
			})
			c.Abort()
			return
		}

		// Check tier
		for _, requiredTier := range tiers {
			if f.Tier == requiredTier {
				c.Set("farmTier", f.Tier)
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":         "Premium subscription required",
			"currentTier":   f.Tier,
			"requiredTiers": tiers,
		})
		c.Abort()
	}
}

// getFarmIDFromRequest extracts farm ID from various request sources
func getFarmIDFromRequest(c *gin.Context) interface{} {
	// Try query parameter
	if farmIDStr := c.Query("farmId"); farmIDStr != "" {
		var farmID uint
		if _, err := fmt.Sscanf(farmIDStr, "%d", &farmID); err == nil {
			return farmID
		}
	}

	// Try URL parameter
	if farmIDStr := c.Param("farmId"); farmIDStr != "" {
		var farmID uint
		if _, err := fmt.Sscanf(farmIDStr, "%d", &farmID); err == nil {
			return farmID
		}
	}

	// Try body (for POST/PUT requests)
	var body map[string]interface{}
	if c.Request.Body != nil {
		c.ShouldBindJSON(&body)
		if farmID, ok := body["farmId"].(float64); ok {
			return uint(farmID)
		}
	}

	return nil
}

// OptionalAuth loads user if token is present, but doesn't require it
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractToken(c)

		if tokenString == "" {
			c.Next()
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(os.Getenv("SECRET")), nil
		})

		if err == nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				userID := uint(claims["sub"].(float64))
				var user models.User
				if err := initializers.DB.Preload("Farms").Preload("UserFarms").First(&user, userID).Error; err == nil && user.Active {
					c.Set("user", user)
					c.Set("userId", user.ID)
				}
			}
		}

		c.Next()
	}
}

// extractToken gets token from Authorization header or cookie
func extractToken(c *gin.Context) string {
	// Try Authorization header first
	bearerToken := c.GetHeader("Authorization")
	if bearerToken != "" {
		// Format: "Bearer <token>"
		parts := strings.Split(bearerToken, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
		// Also support just the token without "Bearer" prefix
		return bearerToken
	}

	// Try cookie
	token, err := c.Cookie("Authorization")
	if err == nil && token != "" {
		return token
	}

	return ""
}
