package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"github.com/oleamind/backend/utils"
	"golang.org/x/crypto/bcrypt"
)

// Register creates a new user account and farm
func Register(c *gin.Context) {
	var body struct {
		Email       string `json:"email" binding:"required,email"`
		Password    string `json:"password" binding:"required,min=8"`
		FirstName   string `json:"firstName"`
		LastName    string `json:"lastName"`
		FarmName    string `json:"farmName" binding:"required"`    // Required: new farm name
		FarmAddress string `json:"farmAddress"`                     // Optional: farm address
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

	// Generate verification token
	verificationToken := generateToken()

	// Create user
	user := models.User{
		Email:             body.Email,
		Password:          string(hash),
		FirstName:         body.FirstName,
		LastName:          body.LastName,
		VerificationToken: verificationToken,
		EmailVerified:     false,
		Active:            true,
	}

	// Create user first
	if result := initializers.DB.Create(&user); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists or invalid data"})
		return
	}

	// Create farm with user as owner
	farm := models.Farm{
		Name:               body.FarmName,
		Address:            body.FarmAddress,
		OwnerID:            user.ID,
		Tier:               "free", // Start with free tier
		SubscriptionStatus: "active",
	}

	if err := initializers.DB.Create(&farm).Error; err != nil {
		// Rollback user creation if farm creation fails
		initializers.DB.Delete(&user)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create farm"})
		return
	}

	// Create UserFarm relationship with owner role
	userFarm := models.UserFarm{
		UserID: user.ID,
		FarmID: farm.ID,
		Role:   "owner",
	}

	if err := initializers.DB.Create(&userFarm).Error; err != nil {
		// Rollback farm and user
		initializers.DB.Delete(&farm)
		initializers.DB.Delete(&user)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to associate user with farm"})
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": time.Now().Add(time.Hour * 24).Unix(), // 24 hours
	})

	tokenString, err := token.SignedString([]byte(os.Getenv("SECRET")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// Set cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("Authorization", tokenString, 3600*24, "", "", false, true)

	// Send verification email
	emailService := utils.NewEmailService()
	if err := emailService.SendVerificationEmail(user.Email, verificationToken); err != nil {
		slog.Warn("Failed to send verification email",
			"email", user.Email,
			"error", err)
		// Don't fail registration if email fails
	}

	// Build farms array with roles (user is owner of the newly created farm)
	farms := []gin.H{
		{
			"id":   farm.ID,
			"name": farm.Name,
			"role": "owner",
		},
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"emailVerified": user.EmailVerified,
			"active":        user.Active,
			"farms":         farms,
		},
		"farm": gin.H{
			"id":        farm.ID,
			"name":      farm.Name,
			"address":   farm.Address,
			"tier":      farm.Tier,
			"ownerId":   farm.OwnerID,
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
	if err := initializers.DB.Preload("Farms").Preload("UserFarms").Where("email = ?", body.Email).First(&user).Error; err != nil {
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

	// Generate JWT token (no role in token - roles are farm-scoped)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": time.Now().Add(time.Hour * 24).Unix(), // 24 hours
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

	// Load user farms with roles
	var userFarms []models.UserFarm
	initializers.DB.Where("user_id = ?", user.ID).Preload("Farm").Find(&userFarms)
	
	// Build farms array with roles
	var farms []gin.H
	for _, uf := range userFarms {
		farms = append(farms, gin.H{
			"id":   uf.Farm.ID,
			"name": uf.Farm.Name,
			"role": uf.Role,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"emailVerified": user.EmailVerified,
			"farms":         farms,
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
	
	// Load user farms with roles
	var userFarms []models.UserFarm
	initializers.DB.Where("user_id = ?", u.ID).Preload("Farm").Find(&userFarms)
	
	// Build farms array with roles
	var farms []gin.H
	for _, uf := range userFarms {
		farms = append(farms, gin.H{
			"id":     uf.Farm.ID,
			"name":   uf.Farm.Name,
			"address": uf.Farm.Address,
			"role":   uf.Role,
			"tier":   uf.Farm.Tier,
		})
	}
	
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":            u.ID,
			"email":         u.Email,
			"firstName":     u.FirstName,
			"lastName":      u.LastName,
			"emailVerified": u.EmailVerified,
			"active":        u.Active,
			"lastLogin":     u.LastLogin,
			"farms":         farms,
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

	// Generate new token (no role in token - roles are farm-scoped)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": u.ID,
		"exp": time.Now().Add(time.Hour * 24).Unix(),
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

	// Send reset email
	emailService := utils.NewEmailService()
	if err := emailService.SendPasswordResetEmail(user.Email, resetToken); err != nil {
		slog.Warn("Failed to send password reset email",
			"email", user.Email,
			"error", err)
		// Don't fail the request if email fails
	}

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
