package models

import "gorm.io/gorm"

type Farm struct {
	gorm.Model
	Name    string `json:"name"`
	Address string `json:"address"`
	Users   []User `gorm:"many2many:user_farms;" json:"users"`
}

