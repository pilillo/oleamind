package models

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

// DateOnly is a custom type that accepts both date-only and datetime formats
type DateOnly struct {
	time.Time
}

// UnmarshalJSON implements custom JSON unmarshaling for DateOnly
func (d *DateOnly) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), "\"")
	if s == "null" || s == "" {
		d.Time = time.Time{}
		return nil
	}

	// Try parsing as date-only first (YYYY-MM-DD)
	t, err := time.Parse("2006-01-02", s)
	if err == nil {
		d.Time = t
		return nil
	}

	// Try parsing as datetime (RFC3339)
	t, err = time.Parse(time.RFC3339, s)
	if err == nil {
		d.Time = t
		return nil
	}

	return fmt.Errorf("invalid date format: %s", s)
}

// MarshalJSON implements custom JSON marshaling for DateOnly
func (d DateOnly) MarshalJSON() ([]byte, error) {
	if d.Time.IsZero() {
		return []byte("null"), nil
	}
	return []byte(fmt.Sprintf("\"%s\"", d.Time.Format("2006-01-02"))), nil
}

// Value implements the driver.Valuer interface for database storage
func (d DateOnly) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time, nil
}

// Scan implements the sql.Scanner interface for database retrieval
func (d *DateOnly) Scan(value interface{}) error {
	if value == nil {
		d.Time = time.Time{}
		return nil
	}
	if t, ok := value.(time.Time); ok {
		d.Time = t
		return nil
	}
	return fmt.Errorf("cannot scan %T into DateOnly", value)
}

