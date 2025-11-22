package models

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PostGISGeoJSON json.RawMessage

// UnmarshalJSON implements json.Unmarshaler
func (j *PostGISGeoJSON) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*j = nil
		return nil
	}
	*j = PostGISGeoJSON(data)
	return nil
}

// MarshalJSON implements json.Marshaler
func (j PostGISGeoJSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return []byte(j), nil
}

// GormDataType tells GORM to use geometry type for this column
func (j PostGISGeoJSON) GormDataType() string {
	return "geometry(Geometry, 4326)"
}

// GormValue converts the Go value to a SQL expression
func (j PostGISGeoJSON) GormValue(ctx context.Context, db *gorm.DB) clause.Expr {
	if len(j) == 0 || string(j) == "null" {
		return clause.Expr{SQL: "NULL"}
	}
	return clause.Expr{
		SQL:  "ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)",
		Vars: []interface{}{string(j)},
	}
}

// Scan implements the sql.Scanner interface
func (j *PostGISGeoJSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New(fmt.Sprint("Failed to unmarshal GeoJSON value:", value))
	}

	*j = PostGISGeoJSON(bytes)
	return nil
}

// Value implements the driver.Valuer interface (fallback)
func (j PostGISGeoJSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

type ParcelVariety struct {
	gorm.Model
	ParcelID     uint           `json:"parcel_id"`
	Cultivar     string         `json:"cultivar"`      // e.g., Picual, Arbequina
	TreeCount    int            `json:"tree_count"`    // Number of trees
	Area         float64        `json:"area"`          // Area in hectares
	PlantingDate string         `json:"planting_date"` // YYYY-MM-DD
	Location     string         `json:"location"`      // Description of location (e.g., "North rows", "Rows 1-10")
	GeoJSON      PostGISGeoJSON `json:"geojson" gorm:"type:geometry(Geometry, 4326)"` // Optional: Exact positions (Points) or Zone (Polygon)
}

type Parcel struct {
	gorm.Model
	Name       string          `json:"name"`
	FarmID     uint            `json:"farm_id"`
	GeoJSON    PostGISGeoJSON  `json:"geojson" gorm:"type:geometry(Geometry, 4326)"`
	Area       float64         `json:"area"`        // Total area
	TreesCount int             `json:"trees_count"` // Total trees
	Varieties  []ParcelVariety `json:"varieties" gorm:"foreignKey:ParcelID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

