# OleaMind Documentation

This directory contains feature documentation for the OleaMind application.

## Feature Documentation

### Core Features

- **[AREA_CALCULATION.md](./AREA_CALCULATION.md)** - Automatic parcel area calculation using PostGIS geography type
  - Real-world area measurements accounting for Earth's curvature
  - Implementation details and testing approach

- **[SATELLITE_CONFIG.md](./SATELLITE_CONFIG.md)** - Satellite imagery integration configuration
  - AWS S3 Sentinel-2 data access
  - NDVI calculation and caching
  - Configuration options (upscale factor, scene selection, cloud cover)

- **[WEATHER_INTEGRATION.md](./WEATHER_INTEGRATION.md)** - Weather service integration
  - Open-Meteo API integration
  - Current conditions and 24h forecasts
  - ET0 calculation for irrigation

### Decision Support Systems

- **[IRRIGATION_DSS_COMPLETE.md](./IRRIGATION_DSS_COMPLETE.md)** - Irrigation Decision Support System
  - Water balance calculations (ETc, rainfall, soil moisture)
  - Growth stage-aware crop coefficients
  - Smart recommendations with 4 urgency levels

- **[PEST_DSS_COMPLETE.md](./PEST_DSS_COMPLETE.md)** - Pest & Disease Decision Support
  - Risk assessment for Olive Fruit Fly and Peacock Spot
  - Weather-based risk calculation
  - Treatment recommendations and logging

### Operations & Processing

- **[HARVEST_MANAGEMENT_COMPLETE.md](./HARVEST_MANAGEMENT_COMPLETE.md)** - Harvest & Yield Tracking
  - Harvest logging with quality assessment
  - Yield statistics and predictions
  - Cost aggregation and profitability tracking

- **[MILLS_PROCESSING_COMPLETE.md](./MILLS_PROCESSING_COMPLETE.md)** - Mills & Olive Processing
  - Complete orchard-to-bottle traceability
  - Oil batch production and quality analysis
  - EU Regulation 2568/91 compliance
  - Bottling and sales tracking

## Document Naming Convention

- `*_COMPLETE.md` - Fully implemented feature documentation
- Other `.md` files - Configuration guides or technical documentation

## Contributing

When adding new features, create corresponding documentation in this folder describing:
- Feature overview and purpose
- Implementation details
- API endpoints (if applicable)
- Configuration options
- Testing approach
