package utils

import (
	"github.com/oleamind/backend/initializers"
	"github.com/oleamind/backend/models"
)

// GetUserAccessibleFarms returns farm IDs that the user has access to
func GetUserAccessibleFarms(userID uint) []uint {
	var farmIDs []uint
	
	// Get farms where user is owner
	var ownedFarms []models.Farm
	initializers.DB.Where("owner_id = ?", userID).Find(&ownedFarms)
	for _, farm := range ownedFarms {
		farmIDs = append(farmIDs, farm.ID)
	}
	
	// Get farms where user has access via UserFarm
	var userFarms []models.UserFarm
	initializers.DB.Where("user_id = ?", userID).Find(&userFarms)
	for _, uf := range userFarms {
		// Avoid duplicates
		exists := false
		for _, fid := range farmIDs {
			if fid == uf.FarmID {
				exists = true
				break
			}
		}
		if !exists {
			farmIDs = append(farmIDs, uf.FarmID)
		}
	}
	
	return farmIDs
}

