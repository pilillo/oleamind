package models

// UserFarm represents the many-to-many relationship between users and farms
// with farm-scoped roles (a user can be owner of Farm A, agronomist of Farm B)
type UserFarm struct {
	UserID uint `gorm:"primaryKey" json:"userId"`
	FarmID uint `gorm:"primaryKey" json:"farmId"`
	Role   string `json:"role"` // owner, agronomist, mill_operator, viewer
	
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Farm Farm `gorm:"foreignKey:FarmID" json:"farm,omitempty"`
}

// TableName specifies the table name for GORM
func (UserFarm) TableName() string {
	return "user_farms"
}

