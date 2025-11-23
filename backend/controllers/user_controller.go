package controllers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
	"golang.org/x/crypto/bcrypt"
)

// GetUsers returns users from farms where current user is owner
func GetUsers(c *gin.Context) {
	user, _ := c.Get("user")
	u := user.(models.User)

	// Get farms where user is owner
	var ownedFarms []models.Farm
	if err := initializers.DB.Where("owner_id = ?", u.ID).Find(&ownedFarms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch owned farms"})
		return
	}

	if len(ownedFarms) == 0 {
		c.JSON(http.StatusOK, []gin.H{}) // Empty array - user owns no farms
		return
	}

	var farmIDs []uint
	for _, farm := range ownedFarms {
		farmIDs = append(farmIDs, farm.ID)
	}

	// Optional: filter by specific farm
	if farmIDStr := c.Query("farmId"); farmIDStr != "" {
		var farmID uint
		if _, err := fmt.Sscanf(farmIDStr, "%d", &farmID); err == nil {
			// Verify user owns this farm
			ownsFarm := false
			for _, fid := range farmIDs {
				if fid == farmID {
					ownsFarm = true
					break
				}
			}
			if ownsFarm {
				farmIDs = []uint{farmID}
			} else {
				c.JSON(http.StatusForbidden, gin.H{"error": "You can only view users from farms you own"})
				return
			}
		}
	}

	// Get all users from owned farms via UserFarm join table
	var userFarms []models.UserFarm
	query := initializers.DB.Where("farm_id IN ?", farmIDs).Preload("User").Preload("Farm")

	// Filter by role if provided
	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}

	if err := query.Find(&userFarms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Build response with user and their role per farm
	response := []gin.H{}
	userMap := make(map[uint]gin.H) // Track users we've already added

	for _, uf := range userFarms {
		// Filter by active status if provided
		if activeStr := c.Query("active"); activeStr != "" {
			active := activeStr == "true"
			if uf.User.Active != active {
				continue
			}
		}

		// If user already in map, add farm to their farms array
		if existing, exists := userMap[uf.User.ID]; exists {
			farms := existing["farms"].([]gin.H)
			farms = append(farms, gin.H{
				"id":   uf.Farm.ID,
				"name": uf.Farm.Name,
				"role": uf.Role,
			})
			existing["farms"] = farms
		} else {
			// New user - create entry
			userMap[uf.User.ID] = gin.H{
				"id":            uf.User.ID,
				"email":         uf.User.Email,
				"firstName":     uf.User.FirstName,
				"lastName":      uf.User.LastName,
				"active":        uf.User.Active,
				"emailVerified": uf.User.EmailVerified,
				"lastLogin":     uf.User.LastLogin,
				"createdAt":     uf.User.CreatedAt,
				"farms": []gin.H{
					{
						"id":   uf.Farm.ID,
						"name": uf.Farm.Name,
						"role": uf.Role,
					},
				},
			}
		}
	}

	// Convert map to slice
	for _, userData := range userMap {
		response = append(response, userData)
	}

	c.JSON(http.StatusOK, response)
}

// GetUser returns a specific user by ID (only if they belong to a farm you own)
func GetUser(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(models.User)
	
	userIDStr := c.Param("id")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get farms where current user is owner
	var ownedFarms []models.Farm
	initializers.DB.Where("owner_id = ?", currentUser.ID).Find(&ownedFarms)
	
	var farmIDs []uint
	for _, farm := range ownedFarms {
		farmIDs = append(farmIDs, farm.ID)
	}

	if len(farmIDs) == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't own any farms"})
		return
	}

	// Check if target user belongs to any of your farms
	var userFarm models.UserFarm
	if err := initializers.DB.Where("user_id = ? AND farm_id IN ?", targetUserID, farmIDs).
		Preload("User").Preload("Farm").First(&userFarm).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "User not found or you don't have access"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            userFarm.User.ID,
		"email":         userFarm.User.Email,
		"firstName":     userFarm.User.FirstName,
		"lastName":      userFarm.User.LastName,
		"active":        userFarm.User.Active,
		"emailVerified": userFarm.User.EmailVerified,
		"lastLogin":     userFarm.User.LastLogin,
		"createdAt":     userFarm.User.CreatedAt,
		"farm": gin.H{
			"id":   userFarm.Farm.ID,
			"name": userFarm.Farm.Name,
			"role": userFarm.Role,
		},
	})
}

// CreateUser creates a new user for a farm you own
func CreateUser(c *gin.Context) {
	user, _ := c.Get("user")
	currentUser := user.(models.User)

	var body struct {
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=8"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Role      string `json:"role" binding:"required"`
		FarmID    uint   `json:"farmId" binding:"required"` // Must specify farm
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify current user is owner of the specified farm
	var farm models.Farm
	if err := initializers.DB.Where("id = ? AND owner_id = ?", body.FarmID, currentUser.ID).First(&farm).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only create users for farms you own"})
		return
	}

	// Validate role (cannot create another owner - only one owner per farm)
	validRoles := map[string]bool{
		"agronomist":    true,
		"mill_operator": true,
		"viewer":        true,
	}
	if !validRoles[body.Role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Cannot create owner role - farm already has an owner"})
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := initializers.DB.Where("email = ?", body.Email).First(&existingUser).Error; err == nil {
		// User exists - check if already associated with this farm
		var existingUserFarm models.UserFarm
		if err := initializers.DB.Where("user_id = ? AND farm_id = ?", existingUser.ID, body.FarmID).First(&existingUserFarm).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User is already associated with this farm"})
			return
		}
		// User exists but not associated - add them to the farm
		userFarm := models.UserFarm{
			UserID: existingUser.ID,
			FarmID: body.FarmID,
			Role:   body.Role,
		}
		if err := initializers.DB.Create(&userFarm).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to associate user with farm"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "User added to farm successfully",
			"user": gin.H{
				"id":        existingUser.ID,
				"email":     existingUser.Email,
				"firstName": existingUser.FirstName,
				"lastName":  existingUser.LastName,
			},
			"farm": gin.H{
				"id":   farm.ID,
				"name": farm.Name,
				"role": body.Role,
			},
		})
		return
	}

	// Create new user
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	newUser := models.User{
		Email:         body.Email,
		Password:      string(hash),
		FirstName:     body.FirstName,
		LastName:      body.LastName,
		EmailVerified: true, // Auto-verify for owner-created users
		Active:        true,
	}

	if err := initializers.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists or invalid data"})
		return
	}

	// Associate user with farm
	userFarm := models.UserFarm{
		UserID: newUser.ID,
		FarmID: body.FarmID,
		Role:   body.Role,
	}

	if err := initializers.DB.Create(&userFarm).Error; err != nil {
		// Rollback user creation
		initializers.DB.Delete(&newUser)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to associate user with farm"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user": gin.H{
			"id":        newUser.ID,
			"email":     newUser.Email,
			"firstName": newUser.FirstName,
			"lastName":  newUser.LastName,
		},
		"farm": gin.H{
			"id":   farm.ID,
			"name": farm.Name,
			"role": body.Role,
		},
	})
}

// UpdateUser updates user details and role for a specific farm
func UpdateUser(c *gin.Context) {
	currentUser, _ := c.Get("user")
	cu := currentUser.(models.User)
	
	userIDStr := c.Param("id")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var body struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Role      string `json:"role"` // Role for the farm
		FarmID    uint   `json:"farmId"` // Required: which farm to update role for
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify current user owns the farm
	var farm models.Farm
	if err := initializers.DB.Where("id = ? AND owner_id = ?", body.FarmID, cu.ID).First(&farm).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update users for farms you own"})
		return
	}

	// Get target user
	var targetUser models.User
	if err := initializers.DB.First(&targetUser, targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Update user basic info if provided
	if body.FirstName != "" {
		targetUser.FirstName = body.FirstName
	}
	if body.LastName != "" {
		targetUser.LastName = body.LastName
	}
	if err := initializers.DB.Save(&targetUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	// Update role in UserFarm if provided
	if body.Role != "" {
		// Cannot change owner role
		if body.Role == "owner" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot assign owner role - farm already has an owner"})
			return
		}

		validRoles := map[string]bool{
			"agronomist":    true,
			"mill_operator": true,
			"viewer":        true,
		}
		if !validRoles[body.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
			return
		}

		var userFarm models.UserFarm
		if err := initializers.DB.Where("user_id = ? AND farm_id = ?", targetUserID, body.FarmID).First(&userFarm).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User is not associated with this farm"})
			return
		}

		userFarm.Role = body.Role
		if err := initializers.DB.Save(&userFarm).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated successfully",
		"user": gin.H{
			"id":        targetUser.ID,
			"email":     targetUser.Email,
			"firstName": targetUser.FirstName,
			"lastName":  targetUser.LastName,
		},
		"farm": gin.H{
			"id":   farm.ID,
			"name": farm.Name,
			"role": body.Role,
		},
	})
}

// DeactivateUser deactivates a user account (only for users in your farms)
func DeactivateUser(c *gin.Context) {
	currentUser, _ := c.Get("user")
	cu := currentUser.(models.User)
	
	userIDStr := c.Param("id")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get farms where current user is owner
	var ownedFarms []models.Farm
	initializers.DB.Where("owner_id = ?", cu.ID).Find(&ownedFarms)
	
	var farmIDs []uint
	for _, farm := range ownedFarms {
		farmIDs = append(farmIDs, farm.ID)
	}

	if len(farmIDs) == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't own any farms"})
		return
	}

	// Verify target user belongs to one of your farms
	var userFarm models.UserFarm
	if err := initializers.DB.Where("user_id = ? AND farm_id IN ?", targetUserID, farmIDs).First(&userFarm).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "User not found or you don't have access"})
		return
	}

	// Cannot deactivate yourself
	if targetUserID == cu.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot deactivate your own account"})
		return
	}

	var user models.User
	if err := initializers.DB.First(&user, targetUserID).Error; err != nil {
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

// ActivateUser activates a user account (only for users in your farms)
func ActivateUser(c *gin.Context) {
	currentUser, _ := c.Get("user")
	cu := currentUser.(models.User)
	
	userIDStr := c.Param("id")
	var targetUserID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &targetUserID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get farms where current user is owner
	var ownedFarms []models.Farm
	initializers.DB.Where("owner_id = ?", cu.ID).Find(&ownedFarms)
	
	var farmIDs []uint
	for _, farm := range ownedFarms {
		farmIDs = append(farmIDs, farm.ID)
	}

	if len(farmIDs) == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't own any farms"})
		return
	}

	// Verify target user belongs to one of your farms
	var userFarm models.UserFarm
	if err := initializers.DB.Where("user_id = ? AND farm_id IN ?", targetUserID, farmIDs).First(&userFarm).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "User not found or you don't have access"})
		return
	}

	var user models.User
	if err := initializers.DB.First(&user, targetUserID).Error; err != nil {
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
