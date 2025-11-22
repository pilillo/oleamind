package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"golang.org/x/crypto/bcrypt"
)

// GetUsers returns all users (owner only)
func GetUsers(c *gin.Context) {
	var users []models.User
	query := initializers.DB.Preload("Farm")

	// Filter by role
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}

	// Filter by active status
	if active := c.Query("active"); active != "" {
		query = query.Where("active = ?", active == "true")
	}

	// Filter by farm
	if farmID := c.Query("farmId"); farmID != "" {
		query = query.Where("farm_id = ?", farmID)
	}

	if err := query.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Remove sensitive data
	var response []gin.H
	for _, user := range users {
		response = append(response, gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"role":          user.Role,
			"farmId":        user.FarmID,
			"farm":          user.Farm,
			"active":        user.Active,
			"emailVerified": user.EmailVerified,
			"lastLogin":     user.LastLogin,
			"createdAt":     user.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, response)
}

// GetUser returns a specific user by ID
func GetUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := initializers.DB.Preload("Farm").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            user.ID,
		"email":         user.Email,
		"firstName":     user.FirstName,
		"lastName":      user.LastName,
		"role":          user.Role,
		"farmId":        user.FarmID,
		"farm":          user.Farm,
		"active":        user.Active,
		"emailVerified": user.EmailVerified,
		"lastLogin":     user.LastLogin,
		"createdAt":     user.CreatedAt,
	})
}

// CreateUser creates a new user (owner only)
func CreateUser(c *gin.Context) {
	var body struct {
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=8"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Role      string `json:"role" binding:"required"`
		FarmID    *uint  `json:"farmId"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	validRoles := map[string]bool{
		"owner":         true,
		"agronomist":    true,
		"mill_operator": true,
		"viewer":        true,
	}
	if !validRoles[body.Role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:         body.Email,
		Password:      string(hash),
		FirstName:     body.FirstName,
		LastName:      body.LastName,
		Role:          body.Role,
		FarmID:        body.FarmID,
		EmailVerified: true, // Auto-verify for admin-created users
		Active:        true,
	}

	if result := initializers.DB.Create(&user); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists or invalid data"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"role":      user.Role,
			"farmId":    user.FarmID,
		},
	})
}

// UpdateUser updates user details
func UpdateUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := initializers.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var body struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Role      string `json:"role"`
		FarmID    *uint  `json:"farmId"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields
	if body.FirstName != "" {
		user.FirstName = body.FirstName
	}
	if body.LastName != "" {
		user.LastName = body.LastName
	}
	if body.Role != "" {
		// Validate role
		validRoles := map[string]bool{
			"owner":         true,
			"agronomist":    true,
			"mill_operator": true,
			"viewer":        true,
		}
		if !validRoles[body.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
			return
		}
		user.Role = body.Role
	}
	if body.FarmID != nil {
		user.FarmID = body.FarmID
	}

	if err := initializers.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated successfully",
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"role":      user.Role,
			"farmId":    user.FarmID,
		},
	})
}

// DeactivateUser deactivates a user account
func DeactivateUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := initializers.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Active = false
	if err := initializers.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deactivated successfully"})
}

// ActivateUser activates a user account
func ActivateUser(c *gin.Context) {
	userID := c.Param("id")

	var user models.User
	if err := initializers.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Active = true
	if err := initializers.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User activated successfully"})
}

// UpdateProfile allows users to update their own profile
func UpdateProfile(c *gin.Context) {
	currentUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user := currentUser.(models.User)

	var body struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.FirstName != "" {
		user.FirstName = body.FirstName
	}
	if body.LastName != "" {
		user.LastName = body.LastName
	}

	if err := initializers.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"firstName": user.FirstName,
			"lastName":  user.LastName,
			"role":      user.Role,
		},
	})
}

// ChangePassword allows users to change their password
func ChangePassword(c *gin.Context) {
	currentUser, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	user := currentUser.(models.User)

	var body struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user.Password = string(hash)
	if err := initializers.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to change password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}
