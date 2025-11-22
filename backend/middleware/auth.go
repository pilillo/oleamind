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

		fmt.Printf("🔍 Auth Debug - Path: %s, Token: %s\n", c.Request.URL.Path, tokenString)

		if tokenString == "" {
			fmt.Println("❌ No token found")
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

		// Load user from database
		userID := uint(claims["sub"].(float64))
		var user models.User
		if err := initializers.DB.Preload("Farm").First(&user, userID).Error; err != nil {
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
		c.Set("userRole", user.Role)

		c.Next()
	}
}

// RequireRole checks if user has one of the required roles
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		role := userRole.(string)
		for _, requiredRole := range roles {
			if role == requiredRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
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
				if err := initializers.DB.First(&user, userID).Error; err == nil && user.Active {
					c.Set("user", user)
					c.Set("userId", user.ID)
					c.Set("userRole", user.Role)
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
