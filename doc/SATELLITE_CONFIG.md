# Satellite Worker Configuration

This document describes the configurable parameters for the satellite data processing worker.

## Environment Variables

Configuration is done through environment variables in `docker-compose.yml`:
- **Worker service**: Controls satellite image processing
- **Backend service**: Controls caching behavior

## Backend Configuration

### PURGE_NDVI_CACHE_ON_STARTUP

Controls whether to delete all cached NDVI data from the database when the backend starts.

- **Default**: `false`
- **Options**: `true`, `false`, `1`, `0`
- **Recommendation**: 
  - Use `false` in production to preserve cached data
  - Use `true` during development/testing to always fetch fresh data
  - Use `true` when you want to force re-fetching all imagery (e.g., after changing scene selection mode)

```yaml
backend:
  environment:
    PURGE_NDVI_CACHE_ON_STARTUP: "false"
```

**Use Cases**:
- `false` (production): Preserves cache, respects TTL, uses stale-while-revalidate
- `true` (development): Always fetches fresh data, useful for testing different configurations
- `true` (one-time): Clear old cache after changing `SCENE_SELECTION_MODE` to ensure consistency

**Warning**: Setting this to `true` will delete ALL cached NDVI images for ALL users on every restart. Premium users will lose their historical data unless backed up separately.

---

## Worker Configuration

### NDVI_UPSCALE_FACTOR

Controls the upsampling of NDVI images for better polygon edge fitting.

- **Default**: `1` (no upsampling)
- **Options**: `1`, `2`, `3`, `5`, `10`
- **Recommendation**: 
  - Use `1` for fastest processing and lowest memory usage
  - Use `3-5` for better visual quality at polygon edges
  - Use `10` for maximum quality (slower, more memory)

```yaml
NDVI_UPSCALE_FACTOR: 1
```

### SCENE_SELECTION_MODE

Determines how the "best" Sentinel-2 scene is selected when multiple scenes are available.

- **Default**: `least_cloud`
- **Options**:
  - `least_cloud` - Prioritizes scenes with lowest cloud cover, then most recent
  - `most_recent` - Prioritizes newest scenes, then lowest cloud cover
  - `balanced` - Balances recency and cloud cover (60% cloud, 40% recency)

```yaml
SCENE_SELECTION_MODE: least_cloud
```

**Use Cases**:
- `least_cloud`: Best for scientific accuracy and vegetation analysis
- `most_recent`: Best for time-sensitive monitoring (e.g., recent treatments)
- `balanced`: Good compromise for general-purpose use

### SCENE_SEARCH_DAYS

Number of days to search back in time for satellite imagery.

- **Default**: `30`
- **Minimum**: `1`
- **Maximum**: Unlimited (but more scenes = slower search)
- **Recommendation**: 30-60 days for most use cases

```yaml
SCENE_SEARCH_DAYS: 30
```

**Note**: Sentinel-2 has a revisit time of ~5 days, so searching less than 10 days may result in no imagery being found.

## Logging

The worker uses structured logging with the following format:

```
%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

### Key Log Messages

1. **Scene Search**:
   - Lists all available Sentinel-2 scenes with date, cloud cover, and platform
   - Shows up to 10 scenes in detail

2. **Scene Selection**:
   - Clearly indicates which scene was selected and why
   - Shows selection mode, scene ID, date, cloud cover, and platform

3. **Processing Status**:
   - NDVI calculation progress
   - Success/error states with detailed context

### Viewing Logs

```bash
# View last 50 lines
docker logs oleamind-worker-1 --tail=50

# Follow logs in real-time
docker logs oleamind-worker-1 -f

# Search for specific scene selection
docker logs oleamind-worker-1 | grep "SELECTED SCENE"
```

## Example Configurations

### Production (Recommended)

```yaml
backend:
  environment:
    PURGE_NDVI_CACHE_ON_STARTUP: "false"

worker:
  environment:
    NDVI_UPSCALE_FACTOR: 3
    SCENE_SELECTION_MODE: least_cloud
    SCENE_SEARCH_DAYS: 30
```

### Development (Always Fresh Data)

```yaml
backend:
  environment:
    PURGE_NDVI_CACHE_ON_STARTUP: "true"

worker:
  environment:
    NDVI_UPSCALE_FACTOR: 1
    SCENE_SELECTION_MODE: most_recent
    SCENE_SEARCH_DAYS: 15
```

### High Quality (Scientific Analysis)

```yaml
backend:
  environment:
    PURGE_NDVI_CACHE_ON_STARTUP: "false"

worker:
  environment:
    NDVI_UPSCALE_FACTOR: 10
    SCENE_SELECTION_MODE: least_cloud
    SCENE_SEARCH_DAYS: 60
```

## Scene Selection Examples

Given these available scenes:

```
1. 2024-11-20 | Cloud:  5.2% | Sentinel-2B
2. 2024-11-18 | Cloud:  8.1% | Sentinel-2A
3. 2024-11-15 | Cloud:  2.3% | Sentinel-2B
4. 2024-11-10 | Cloud: 15.7% | Sentinel-2A
```

- **least_cloud**: Selects #3 (2024-11-15, 2.3% cloud)
- **most_recent**: Selects #1 (2024-11-20, 5.2% cloud)
- **balanced**: Likely selects #1 or #2 depending on exact scoring

## Caching Behavior

The backend caches NDVI results in the database with the following logic:

- **Free Tier**: Stores only the latest image per parcel
- **Premium Tier**: Stores all historical images per parcel
- **TTL**: 5 days (configurable in backend)
- **Stale-While-Revalidate**: Shows stale data immediately, refreshes in background

**Important**: Even with caching, each request may select a different satellite scene if new imagery becomes available. Check the `product_date` in the response to verify which scene was used.

## Troubleshooting

### Different NDVI Images Between Requests

**Cause**: Different Sentinel-2 scenes are being selected.

**Solution**: 
1. Check the logs to see which scene was selected
2. Compare `product_date` in the response
3. Adjust `SCENE_SELECTION_MODE` to prioritize consistency
4. Consider reducing `SCENE_SEARCH_DAYS` to narrow the search window
5. Set `PURGE_NDVI_CACHE_ON_STARTUP: "true"` temporarily to clear old cache and force consistent re-fetching

### No Imagery Found

**Cause**: No scenes available in the search window.

**Solution**:
1. Increase `SCENE_SEARCH_DAYS` to 60 or 90
2. Check if the parcel is over water or polar regions (not covered by Sentinel-2)
3. Review logs for "Found 0 Sentinel-2 scenes" message

### Low-Quality NDVI Images

**Cause**: `NDVI_UPSCALE_FACTOR` is too low.

**Solution**:
1. Increase `NDVI_UPSCALE_FACTOR` to 3 or 5
2. Note: Native Sentinel-2 resolution is 10m per pixel
3. Upsampling doesn't add detail, just smooths edges

## Advanced: Date Range Override

You can override the date range per request by passing `date_range` in the API call:

```bash
# Single date (searches ±15 days)
curl -X POST http://localhost:8080/parcels/1/satellite \
  -H "Content-Type: application/json" \
  -d '{"date_range": "2024-11-15"}'

# Date range
curl -X POST http://localhost:8080/parcels/1/satellite \
  -H "Content-Type: application/json" \
  -d '{"date_range": "2024-11-01,2024-11-30"}'
```

This is useful for:
- Historical analysis
- Comparing specific dates
- Avoiding recently cloudy imagery

## Cache Management

### Clearing Cache

**Method 1: On Startup (Recommended for Testing)**
```yaml
# In docker-compose.yml
backend:
  environment:
    PURGE_NDVI_CACHE_ON_STARTUP: "true"
```

Then restart:
```bash
docker-compose restart backend
```

**Method 2: Manual SQL (Recommended for Production)**
```bash
# Clear all cache
docker exec oleamind-db-1 psql -U user -d oleamind -c "DELETE FROM satellite_data;"

# Clear cache for specific parcel
docker exec oleamind-db-1 psql -U user -d oleamind -c "DELETE FROM satellite_data WHERE parcel_id = 1;"

# Clear cache older than 30 days
docker exec oleamind-db-1 psql -U user -d oleamind -c "DELETE FROM satellite_data WHERE processed_at < NOW() - INTERVAL '30 days';"
```

**Method 3: Temporary Purge**
```bash
# One-time purge without editing docker-compose.yml
docker-compose stop backend
docker-compose run --rm -e PURGE_NDVI_CACHE_ON_STARTUP=true backend
docker-compose up -d backend
```

### When to Clear Cache

- **Development**: Set `PURGE_NDVI_CACHE_ON_STARTUP: "true"` to always test with fresh data
- **After Config Change**: Clear cache when changing `SCENE_SELECTION_MODE` to ensure consistent results
- **Corrupted Data**: If cached images appear incorrect or corrupted
- **Testing**: Verify new satellite imagery is being retrieved correctly
- **Production**: Use manual SQL to selectively clear stale or problematic cache entries

