package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email              string     `gorm:"uniqueIndex;not null" json:"email"`
	Password           string     `gorm:"not null" json:"-"`
	FirstName          string     `json:"firstName"`
	LastName           string     `json:"lastName"`
	Active             bool       `gorm:"default:true" json:"active"`
	LastLogin          *time.Time `json:"lastLogin,omitempty"`
	EmailVerified      bool       `gorm:"default:false" json:"emailVerified"`
	VerificationToken  string     `json:"-"`
	ResetToken         string     `json:"-"`
	ResetTokenExpiry   *time.Time `json:"-"`
	
	// Relationships - Role is now in UserFarm join table (farm-scoped)
	Farms     []Farm     `gorm:"many2many:user_farms;" json:"farms,omitempty"`
	UserFarms []UserFarm `json:"userFarms,omitempty"` // Direct access to join table with roles
	
	// Legacy fields for backward compatibility
	Name  string `json:"name"` // Deprecated: use FirstName + LastName
	Role  string `json:"role,omitempty"` // Deprecated: use UserFarms[].Role instead
	FarmID *uint `json:"farmId,omitempty"` // Deprecated: use Farms relationship instead
	Tier   string `json:"tier,omitempty"` // Deprecated: use Farm.Tier instead
}

// Session represents an active user session
type Session struct {
	gorm.Model
	UserID    uint      `gorm:"not null;index" json:"userId"`
	User      User      `json:"user,omitempty"`
	Token     string    `gorm:"unique;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expiresAt"`
	IPAddress string    `json:"ipAddress,omitempty"`
	UserAgent string    `json:"userAgent,omitempty"`
}
