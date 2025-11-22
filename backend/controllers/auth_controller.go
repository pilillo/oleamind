package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"golang.org/x/crypto/bcrypt"
)

// Register creates a new user account
func Register(c *gin.Context) {
	var body struct {
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=8"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Role      string `json:"role"`
		FarmID    *uint  `json:"farmId"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Set default role if not provided
	role := body.Role
	if role == "" {
		role = "viewer"
	}

	// Generate verification token
	verificationToken := generateToken()

	user := models.User{
		Email:             body.Email,
		Password:          string(hash),
		FirstName:         body.FirstName,
		LastName:          body.LastName,
		Role:              role,
		FarmID:            body.FarmID,
		VerificationToken: verificationToken,
		EmailVerified:     false,
		Active:            true,
	}

	// Create user
	if result := initializers.DB.Create(&user); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists or invalid data"})
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"exp":  time.Now().Add(time.Hour * 24).Unix(), // 24 hours
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// Set cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("Authorization", tokenString, 3600*24, "", "", false, true)

	// TODO: Send verification email

	c.JSON(http.StatusCreated, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"role":          user.Role,
			"farmId":        user.FarmID,
			"emailVerified": user.EmailVerified,
			"active":        user.Active,
		},
	})
}

// Login authenticates a user and returns a JWT token
func Login(c *gin.Context) {
	var body struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Find user
	var user models.User
	if err := initializers.DB.Preload("Farm").Where("email = ?", body.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check if user is active
	if !user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is deactivated"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"exp":  time.Now().Add(time.Hour * 24).Unix(), // 24 hours
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// Update last login
	now := time.Now()
	user.LastLogin = &now
	initializers.DB.Save(&user)

	// Set cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("Authorization", tokenString, 3600*24, "", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"role":          user.Role,
			"farmId":        user.FarmID,
			"emailVerified": user.EmailVerified,
		},
	})
}

// Logout invalidates the current session
func Logout(c *gin.Context) {
	c.SetCookie("Authorization", "", -1, "", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// GetCurrentUser returns the authenticated user's profile
func GetCurrentUser(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	u := user.(models.User)
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":            u.ID,
			"email":         u.Email,
			"firstName":     u.FirstName,
			"lastName":      u.LastName,
			"role":          u.Role,
			"farmId":        u.FarmID,
			"farm":          u.Farm,
			"emailVerified": u.EmailVerified,
			"active":        u.Active,
			"lastLogin":     u.LastLogin,
		},
	})
}

// RefreshToken generates a new JWT token
func RefreshToken(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	u := user.(models.User)

	// Generate new token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  u.ID,
		"role": u.Role,
		"exp":  time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	c.SetCookie("Authorization", tokenString, 3600*24, "", "", false, true)

	c.JSON(http.StatusOK, gin.H{"token": tokenString})
}

// ForgotPassword initiates password reset process
func ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email"})
		return
	}

	var user models.User
	if err := initializers.DB.Where("email = ?", body.Email).First(&user).Error; err != nil {
		// Don't reveal if email exists
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent"})
		return
	}

	// Generate reset token
	resetToken := generateToken()
	expiry := time.Now().Add(time.Hour * 1) // 1 hour expiry
	user.ResetToken = resetToken
	user.ResetTokenExpiry = &expiry

	initializers.DB.Save(&user)

	// TODO: Send reset email

	c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a reset link has been sent"})
}

// ResetPassword resets user password with valid token
func ResetPassword(c *gin.Context) {
	var body struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	if err := initializers.DB.Where("reset_token = ?", body.Token).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	// Check token expiry
	if user.ResetTokenExpiry == nil || time.Now().After(*user.ResetTokenExpiry) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Update password and clear reset token
	user.Password = string(hash)
	user.ResetToken = ""
	user.ResetTokenExpiry = nil

	initializers.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// VerifyEmail verifies user email with token
func VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token required"})
		return
	}

	var user models.User
	if err := initializers.DB.Where("verification_token = ?", token).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification token"})
		return
	}

	user.EmailVerified = true
	user.VerificationToken = ""

	initializers.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// generateToken creates a random token
func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
