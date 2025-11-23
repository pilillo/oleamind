package models

import "gorm.io/gorm"

type Farm struct {
	gorm.Model
	Name    string `json:"name"`
	Address string `json:"address"`
	
	// Ownership & Billing
	OwnerID            uint   `json:"ownerId"` // The user who owns and pays for this farm
	Owner              User   `json:"owner,omitempty" gorm:"foreignKey:OwnerID"`
	Tier               string `gorm:"default:'free'" json:"tier"` // free, premium, enterprise
	SubscriptionStatus string `gorm:"default:'active'" json:"subscriptionStatus"` // active, cancelled, past_due
	SubscriptionID     string `json:"subscriptionId,omitempty"` // Stripe/other payment provider ID
	BillingEmail       string `json:"billingEmail,omitempty"` // Email for billing notifications
	PaymentMethodID    string `json:"paymentMethodId,omitempty"` // Stored payment method
	
	// Relationships
	Users   []User   `gorm:"many2many:user_farms;" json:"users"`
	Parcels []Parcel `json:"parcels,omitempty"`
}

