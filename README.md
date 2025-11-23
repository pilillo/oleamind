# OleaMind
An open source SaaS to manage your olive orchard.

## Features
🌿 1. Orchard & Field Management
- Create and manage olive parcels / plots (georeferenced).
- Record number of trees, age, cultivar, planting density.
- Register pruning operations, fertilization, soil amendments.
- Track irrigation strategies (deficit, scheduled, automated).

🛠 2. Asset & Input Management
Tools and machinery registry (tractors, sprayers, harvesting tools).
Inventory management for:
- fertilizers
- pesticides
- biological treatments
- irrigation supplies
- Cost tracking and alerts for low stock.

🛰 3. Satellite Imagery Integration
Using ESA Sentinel-2:
- NDVI, NDRE, SAVI vegetation indices
- Canopy vigor monitoring
- Stress detection
- Temporal comparison (week/month/year)
- Map overlays with orchard parcels

Implementation:
Download only the necessary satellite data, process indices (like NDVI), and serve images to your users without hosting a full tile server.

- Step 1 – Define the area
  * User draws or uploads the boundary of the olive orchard (GeoJSON, Shapefile, or coordinates). This becomes your bounding box for the satellite query.

- Step 2 – Query Sentinel-2 via ESA Copernicus API
  * Use Copernicus Open Access Hub or CDSE API. 
  * Search for: 
    a. Product type: L2A (bottom-of-atmosphere corrected)
    b. Date range: latest image(s)
    c. Cloud cover: preferably <20%
    d. Area: bounding box from Step 1
  * Output: Sentinel-2 product(s) in JP2 format for required bands.

- Step 3 – Download only necessary bands
  * For NDVI: B04 (Red) and B08 (NIR)
  * Optional: additional bands for NDWI, LAI, or red-edge indices.
Tip: Only download the small subset to minimize storage and bandwidth.

- Step 4 – Process satellite data
  * Use Python libraries like rasterio and numpy:
    a. Read the Red and NIR bands
    b. Calculate NDVI: (NIR - Red) / (NIR + Red)
  * Optional: calculate NDWI, SAVI, or other indices.
  * Output: a processed raster representing vegetation health.

- Step 5 – Generate images for the frontend
  * Export NDVI (or other indices) as:
    a. PNG, WebP, or JPEG
    b. Georeferenced optional (for GIS use)
  * These images are much smaller than raw JP2.

- Step 6 – Serve to users
  * Option A (cheap & simple): serve image files via your backend as overlay layers on Leaflet / Mapbox.
  * Option B (optional, costly): generate tiles (XYZ) for zoomable interactive maps.
  * Recommendation: For cost-efficiency, go with Option A — no tile server required.

- Step 7 – Caching & storage
  * Save processed images for reuse (e.g., 1–2 weeks, or 1 season per orchard).
  * Use a cheap cloud bucket — storage cost negligible.


🐛 4. Pest & Disease Decision Support (DSS)
Focused on olive-specific threats:

- Mosca olearia (Olive fruit fly)
  * Predictive risk model based on: temperature, humidity, fly development cycles
  * Alerts for intervention thresholds
  * Treatment suggestions (chemical, traps, biological options)

- Occhio di pavone (Spilocaea oleagina)
  * Wetness-duration and temperature-based infection model
  * Risk alerts after rain / humidity periods
  * Best treatment window recommendations

- Other olives diseases (optional later):
  * Verticillium wilt
  * Peacock spot
  * Olive knot
  * Anthracnose (Colletotrichum spp.)


💧 5. Irrigation Decision Support
Based on:
- local weather
- ET0 (Penman-Monteith)
- soil moisture sensors (if available)

Features:
- irrigation recommendations by plot
- deficit irrigation strategies
- alarms for water stress
- water-use analytics

📒 6. Work Logs & Compliance
- Digital phytosanitary register (sprays, dates, products).
- Fertilization register.
- Activity logs for labor & operations.
- Downloadable PDFs for compliance.

💸 7. Cost & Yield Tracking
- Track costs by plot (inputs, labor, machinery).
- Harvest logging (kg per plot, per cultivar).
- Yield prediction based on past years + weather patterns.
- Budgeting & profitability dashboards.

✅ 8. Mills and Olive Processing
- ✅ Track lots delivered to mills (Backend Complete)
- ✅ Traceability: parcel → harvest batch → oil tank (Backend Complete)
- ✅ Oil quality analysis (acidity, polyphenols, K232/K270) (Backend Complete)
- ✅ Automatic EVOO classification (EU Regulation 2568/91) (Backend Complete)
- ✅ Bottling and sales tracking (Backend Complete)
- ✅ Complete orchard-to-bottle traceability (Backend Complete)

📈 9. Analytics & Reporting
- Vegetation trends
- Spray history
- Irrigation water usage
- Yearly comparison reports
- Customizable dashboards

🔐 10. User & Farm Management
- Multi-farm access
- Roles (owner, worker, technician, agronomist)
- Farm sharing with consultants

## User Roles & Personas

OleaMind supports role-based access control with four distinct user roles, each designed for different stakeholders in the olive farming and processing workflow.

### 👑 Owner
**Who**: Farm owner, general manager, or system administrator

**Responsibilities**:
- Full system access and control
- User management (create, edit, deactivate users)
- Strategic decisions and oversight
- Financial and operational planning

**Access**:
- ✅ All sections (Dashboard, Parcels, Inventory, Operations, Harvest, Mills, Analytics)
- ✅ User Management (exclusive)
- ✅ All data creation, editing, and deletion

**Typical Tasks**:
- Manage team members and permissions
- Review analytics and reports
- Oversee harvest and milling operations
- Configure system settings
- Make strategic decisions based on data

---

### 🌾 Agronomist
**Who**: Agricultural specialist, farm manager, or crop consultant

**Responsibilities**:
- Field operations and crop management
- Harvest planning and execution
- Pest and disease management
- Irrigation and soil management
- Crop health monitoring

**Access**:
- ✅ Dashboard, Parcels, Inventory, Operations, Analytics (read/write)
- ✅ Harvest Management (exclusive with owner)
- ❌ No access to: Mills, User Management

**Typical Tasks**:
- Monitor parcel health (NDVI, weather, irrigation)
- Plan and log harvest operations
- Record pest/disease treatments
- Manage irrigation schedules
- Track yield and production data
- Create operation logs (pruning, fertilization, etc.)

---

### 🏭 Mill Operator
**Who**: Processing facility manager, mill technician, or quality control specialist

**Responsibilities**:
- Olive processing and milling operations
- Quality control and analysis
- Bottling and packaging
- Sales and delivery tracking
- Traceability management

**Access**:
- ✅ Dashboard, Parcels, Inventory, Operations, Analytics (read/write)
- ✅ Mills/Processing (exclusive with owner)
- ❌ No access to: Harvest Management, User Management

**Typical Tasks**:
- Record olive deliveries from farms
- Create and manage oil batches
- Perform quality analysis (acidity, polyphenols, etc.)
- Track bottling operations
- Manage sales and inventory
- Maintain traceability records

---

### 👁️ Viewer
**Who**: Investor, consultant, auditor, or read-only stakeholder

**Responsibilities**:
- Monitor and review operations
- Generate reports for analysis
- View data without making changes

**Access**:
- ✅ Dashboard, Parcels, Inventory, Operations, Analytics (read-only)
- ❌ No access to: Harvest Management, Mills, User Management
- ❌ Cannot create, edit, or delete data

**Typical Tasks**:
- View farm performance metrics
- Review harvest and yield data
- Check inventory levels
- Analyze operational history
- Export reports for external analysis

---

### Access Matrix

| Feature | Owner | Agronomist | Mill Operator | Viewer |
|---------|-------|------------|---------------|--------|
| Dashboard | ✅ Full | ✅ Full | ✅ Full | ✅ Read |
| Parcels | ✅ Full | ✅ Full | ✅ Full | ✅ Read |
| Inventory | ✅ Full | ✅ Full | ✅ Full | ✅ Read |
| Operations | ✅ Full | ✅ Full | ✅ Full | ✅ Read |
| Harvest | ✅ Full | ✅ Full | ❌ | ❌ |
| Mills | ✅ Full | ❌ | ✅ Full | ❌ |
| Analytics | ✅ Full | ✅ Full | ✅ Full | ✅ Read |
| User Management | ✅ Full | ❌ | ❌ | ❌ |

### Role Hierarchy

```
Owner (Full Control)
├── Agronomist (Field Operations)
├── Mill Operator (Processing Operations)
└── Viewer (Read-Only Access)
```

### Security Notes

- **Registration**: New users are automatically assigned the `viewer` role by default
- **Role Changes**: Only users with `owner` role can modify user roles and permissions
- **First User**: The first user registered in the system should be manually upgraded to `owner` role via database update (see security documentation)

---

## Architectural choice
- the web app should support multiple languages, the user can select one and from then on display that version at any return;

## Design constraints
- both frontend and backend functions will be unit tested
- **Logging**: Use Go's `log/slog` with JSON output for structured logging. No emojis in log messages.

## Implementation Status

### ✅ Completed Features

#### 0. Dashboard (Farmer-Centric Overview)
- ✅ **Real-time statistics**: Total parcels, cultivated area, total trees, active operations
- ✅ **Actionable weather summary**: Irrigation recommendations, rain forecasts, temperature ranges
- ✅ **Recent activities**: Latest operations logged across all parcels
- ✅ **Smart alerts**: Low stock inventory items, irrigation needs based on weather
- ✅ **Decision support**: Shows what farmers need to do today, not just data
- ✅ **100% real data**: All information dynamically fetched from database (no mock data)

#### 1. Orchard & Field Management
- ✅ Create and manage georeferenced parcels with Leaflet map integration
- ✅ Record cultivar varieties with spatial tree placement (point-in-polygon validation)
- ✅ Multiple cultivars per parcel support
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ **Automatic area calculation from polygon geometry using PostGIS geography type**
  - Accurate real-world measurements accounting for Earth's curvature
  - Instant preview in frontend, precise calculation in backend
  - Comprehensive unit tests (see `doc/AREA_CALCULATION.md`)
- ✅ Tree counting from spatial data

#### 2. Asset & Input Management (Inventory)
- ✅ Full inventory CRUD operations
- ✅ Categories: fertilizers, pesticides, biological, irrigation, tools
- ✅ Fields: name, category, quantity, unit, minimum_stock, cost_per_unit, supplier, expiry_date
- ✅ Low stock alerts and filtering
- ✅ Search by name/supplier
- ✅ Category filtering
- ✅ Total inventory value calculation
- ✅ Expiry date tracking with visual indicators
- ✅ Professional UI with icons and status badges
- ✅ Backend unit tests (all passing)

#### 3. Satellite Imagery Integration
- ✅ AWS S3 Sentinel-2 L2A data access
- ✅ NDVI calculation (NIR - Red) / (NIR + Red)
- ✅ Configurable upsampling for image quality
- ✅ Precise polygon clipping to parcel boundaries
- ✅ NDVI map overlay with transparency
- ✅ Caching mechanism (hybrid stale-while-revalidate)
- ✅ User tier support (Free: single latest image, Premium: historical images)
- ✅ Configurable scene selection (least_cloud, most_recent, balanced)
- ✅ Cloud cover tracking
- ✅ Date range configuration for scene search
- ✅ Structured logging in Python worker
- ✅ Satellite acquisition date display in UI

#### 10. User & Farm Management
- ✅ User authentication (JWT-based signup/login)
- ✅ Basic farm model

### 🚧 Internationalization (i18n)
- ✅ React-i18next integration
- ✅ English and Italian translations
- ✅ Language switcher in sidebar
- ✅ LocalStorage persistence
- ✅ Fully translated Inventory page
- ✅ Fully translated Parcels page
- ✅ Fully translated Dashboard

#### 6. Work Logs & Compliance (Operations)
- ✅ Full CRUD operations for work logs
- ✅ Operation types: pruning, fertilization, irrigation, pest control, harvest
- ✅ Categories: phytosanitary, fertilization, maintenance, harvest
- ✅ Compliance fields: product name, active ingredient, quantity, unit
- ✅ Labor tracking: hours, workers, equipment
- ✅ Cost tracking per operation
- ✅ Status management: planned, completed, cancelled
- ✅ Filtering: by type, status, parcel
- ✅ Search functionality
- ✅ Phytosanitary register endpoint for compliance
- ✅ i18n support (EN/IT)
- ✅ Backend unit tests (all passing)
- ✅ Professional UI with icons and status badges

#### 🌤️ Weather Service Integration (Phase 1 Complete)
**Backend:**
- ✅ Open-Meteo API integration (free, no API key)
- ✅ Weather data model with caching (1-hour TTL)
- ✅ Automatic coordinate extraction from parcel geometry
- ✅ Current conditions: temperature, humidity, precipitation, wind, pressure, cloud cover
- ✅ ET0 (evapotranspiration) for irrigation calculations
- ✅ 24h forecast data
- ✅ API endpoints for weather data
- ✅ Batch weather refresh
- ✅ 30-day data retention
- ✅ Backend unit tests

**Frontend:**
- ✅ **Dashboard**: Actionable weather summary (parcels needing irrigation, rain forecast, frost warnings)
- ✅ **Parcels Page**: Detailed weather per selected parcel with decision support
- ✅ Irrigation recommendations (high ET0 + no rain)
- ✅ Treatment timing alerts (rain forecast)
- ✅ Frost risk warnings
- ✅ i18n support (EN/IT) for weather terms
- 📖 See `doc/WEATHER_INTEGRATION.md` for details

#### 5. Irrigation Decision Support
- ✅ Water balance calculations (ETc, rainfall, soil moisture)
- ✅ Growth stage-aware crop coefficients (Kc)
- ✅ Smart recommendations (4 urgency levels)
- ✅ Soil profile and irrigation system management
- ✅ Event logging and water usage statistics
- ✅ Dashboard alerts and Parcels page integration
- ✅ i18n support (EN/IT)
- ✅ Backend unit tests
- 📖 See `doc/IRRIGATION_DSS_COMPLETE.md` for details

#### 4. Pest & Disease Decision Support
- ✅ Risk assessment models for Olive Fruit Fly (Bactrocera oleae)
- ✅ Risk assessment models for Peacock Spot (Spilocaea oleagina)
- ✅ Weather-based risk calculation (temperature, humidity, precipitation)
- ✅ 5-level risk scoring (none, low, moderate, high, critical)
- ✅ Automatic risk assessment when viewing parcels
- ✅ Treatment recommendations (chemical, biological, cultural)
- ✅ Treatment logging and history
- ✅ Monitoring observations tracking
- ✅ Dashboard alerts for critical/high risk
- ✅ Parcels page "Sanitary Status" panel
- ✅ i18n support (EN/IT)
- ✅ Backend unit tests
- 📖 See `doc/PEST_DSS_COMPLETE.md` for details

#### 7. Cost & Yield Tracking
- ✅ Harvest logging (kg per plot/cultivar)
- ✅ Quality assessment (excellent, good, fair, poor)
- ✅ Yield statistics (per hectare, per tree)
- ✅ Cost aggregation (operations, harvest, treatment, irrigation)
- ✅ Revenue and profitability tracking
- ✅ ROI calculation
- ✅ Yield prediction based on historical averages
- ✅ Prediction accuracy tracking
- ✅ Full CRUD for harvest records
- ✅ Backend implementation complete
- 📖 See `doc/HARVEST_MANAGEMENT_COMPLETE.md` for details

#### 8. Mills & Olive Processing
**Complete (Backend + Frontend):**
- ✅ Mill management (facilities, certifications, capacity)
- ✅ Olive delivery tracking with quality metrics
- ✅ Oil batch production with source traceability
- ✅ Automatic yield percentage calculation
- ✅ Quality analysis (EU Regulation 2568/91 compliance)
- ✅ Automatic EVOO/Virgin/Lampante classification
- ✅ Bottling operations management
- ✅ Sales tracking and revenue management
- ✅ Complete orchard-to-bottle traceability
- ✅ Production statistics and analytics
- ✅ Monocultivar oil support
- ✅ DOP/IGP/Organic certification tracking
- ✅ Full UI with 6 tabs: Mills, Deliveries, Batches, Quality, Bottling, Sales
- 📖 See `doc/MILLS_PROCESSING_COMPLETE.md` for details

### 📋 Pending Features
- ⏳ 9. Analytics & Reporting (advanced dashboards beyond current implementation)

## Technology Stack

### Backend
- **Language**: Go 1.24.0
- **Framework**: Gin
- **Database**: PostgreSQL 15 + PostGIS 3.3
- **ORM**: GORM
- **Authentication**: JWT
- **Testing**: stretchr/testify

### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS 4.1.17
- **Mapping**: Leaflet 1.9.4 + react-leaflet 5.0.0
- **Drawing**: Leaflet Draw 1.0.4
- **Routing**: React Router 7.9.6
- **i18n**: react-i18next 15.2.0
- **Icons**: lucide-react 0.475.0

### Satellite Worker
- **Language**: Python 3
- **Framework**: Flask
- **Libraries**: rasterio, numpy, boto3, pystac-client, shapely, Pillow

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Services**: db, backend, frontend, satellite-worker

## Getting Started

1. **Prerequisites**: Docker and Docker Compose installed

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080
   - Satellite Worker: http://localhost:5000

4. **Run backend tests**:
   ```bash
   cd backend
   go test ./controllers -v
   ```

## Configuration

### Satellite Worker
See `doc/SATELLITE_CONFIG.md` for detailed configuration options:
- `NDVI_UPSCALE_FACTOR`: Image quality (1=native 10m, 2-3=recommended, 10=max)
- `SCENE_SELECTION_MODE`: least_cloud, most_recent, balanced
- `SCENE_SEARCH_DAYS`: Days to search back for imagery (default: 30)

### Backend
- `PURGE_NDVI_CACHE_ON_STARTUP`: true/false - Clear NDVI cache on startup

## i18n - Adding New Languages

1. Create new locale file: `frontend/src/i18n/locales/{lang_code}.json`
2. Copy structure from `en.json` or `it.json`
3. Translate all keys
4. Import and register in `frontend/src/i18n/config.ts`
5. Update language selector in `App.tsx`

Example translation file structure:
```json
{
  "nav": { "dashboard": "...", "parcels": "...", ... },
  "inventory": { "title": "...", "add_item": "...", ... },
  "parcels": { "title": "...", "add_parcel": "...", ... }
}
```