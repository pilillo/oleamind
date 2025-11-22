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
	Role               string     `gorm:"not null;default:'viewer'" json:"role"` // owner, agronomist, mill_operator, viewer
	FarmID             *uint      `gorm:"index" json:"farmId"`
	Farm               *Farm      `json:"farm,omitempty"`
	Active             bool       `gorm:"default:true" json:"active"`
	LastLogin          *time.Time `json:"lastLogin,omitempty"`
	EmailVerified      bool       `gorm:"default:false" json:"emailVerified"`
	VerificationToken  string     `json:"-"`
	ResetToken         string     `json:"-"`
	ResetTokenExpiry   *time.Time `json:"-"`
	Tier               string     `gorm:"default:'free'" json:"tier"` // free, premium
	
	// Legacy fields for backward compatibility
	Name  string `json:"name"` // Deprecated: use FirstName + LastName
	Farms []Farm `gorm:"many2many:user_farms;" json:"farms,omitempty"`
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
