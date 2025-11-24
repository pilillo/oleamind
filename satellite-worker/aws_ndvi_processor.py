"""
NDVI Processing using AWS Sentinel-2 Open Data Registry
No authentication needed - completely free and open access!

This module uses:
- AWS S3 Open Data Registry for Sentinel-2 imagery
- STAC (SpatioTemporal Asset Catalog) API for scene discovery
- Direct S3 access via rasterio for efficient windowed reads
"""

import os
import io
import base64
import logging
import numpy as np
from datetime import datetime, timedelta

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config
    import rasterio
    from rasterio.session import AWSSession
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds
    from rasterio.features import geometry_mask
    from rasterio.transform import Affine
    from shapely.geometry import shape, mapping
    from shapely.ops import transform as shapely_transform
    import pystac_client
    from PIL import Image
    import pyproj
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    DEPENDENCIES_AVAILABLE = False
    logger.warning(f"Satellite processing dependencies not available: {e}")
    logger.warning("Running in mock mode. Install: boto3, rasterio, pystac-client, shapely, Pillow, pyproj")


class AWSNDVIProcessor:
    """
    NDVI processor using AWS Sentinel-2 Open Data.
    
    Benefits:
    - No authentication required (public data)
    - Fast S3 access
    - No rate limits
    - Efficient windowed reads (only downloads needed pixels)
    """
    
    def __init__(self):
        """Initialize processor with AWS S3 access (no credentials needed)."""
        self.mock_mode = not DEPENDENCIES_AVAILABLE
        
        if not self.mock_mode:
            # Configure boto3 for unsigned requests (public data)
            self.s3_client = boto3.client(
                's3',
                region_name='eu-central-1',
                config=Config(signature_version=UNSIGNED)
            )
            
            # STAC API endpoint for searching Sentinel-2 catalog
            self.stac_api = "https://earth-search.aws.element84.com/v1"
            print("AWS NDVI Processor initialized - using S3 Open Data")
        else:
            self.s3_client = None
            self.stac_api = None
            print("AWS NDVI Processor in MOCK mode")
    
    def search_sentinel2_stac(self, geojson, start_date, end_date, max_cloud_cover=30):
        """
        Search for Sentinel-2 scenes using STAC API.
        
        Args:
            geojson: GeoJSON geometry of the area of interest
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            max_cloud_cover: Maximum cloud cover percentage (0-100)
            
        Returns:
            List of matching STAC items
        """
        if self.mock_mode:
            return self._mock_search(geojson, start_date, end_date)
        
        try:
            # Connect to STAC catalog
            catalog = pystac_client.Client.open(self.stac_api)
            
            # Extract bounding box from GeoJSON
            geom = shape(geojson)
            bbox = list(geom.bounds)  # (minx, miny, maxx, maxy)
            
            logger.info(f"Searching STAC catalog", extra={
                "bbox": bbox,
                "start_date": start_date,
                "end_date": end_date,
                "max_cloud_cover": max_cloud_cover
            })
            
            # Search for Sentinel-2 L2A products
            search = catalog.search(
                collections=["sentinel-2-l2a"],
                bbox=bbox,
                datetime=f"{start_date}/{end_date}",
                query={"eo:cloud_cover": {"lt": max_cloud_cover}}
            )
            
            items = list(search.items())
            logger.info(f"Found {len(items)} Sentinel-2 scenes", extra={"scene_count": len(items)})
            return items
            
        except Exception as e:
            logger.error(f"Error searching STAC catalog", exc_info=True, extra={"error": str(e)})
            return []
    
    def generate_ndvi_image(self, ndvi_array):
        """
        Generate a colored NDVI image with transparency for masked areas.
        
        Args:
            ndvi_array: numpy masked array of NDVI values (-1 to 1)
            
        Returns:
            base64 encoded PNG image string
        """
        try:
            # Create RGBA image (with alpha channel for transparency)
            height, width = ndvi_array.shape
            rgba_image = np.zeros((height, width, 4), dtype=np.uint8)
            
            # Handle masked array
            if hasattr(ndvi_array, 'mask'):
                valid_mask = ~ndvi_array.mask
                ndvi_data = np.where(valid_mask, ndvi_array.data, np.nan)
            else:
                ndvi_data = ndvi_array
                valid_mask = np.isfinite(ndvi_data)
            
            # Color mapping for valid pixels
            for i in range(height):
                for j in range(width):
                    if valid_mask[i, j]:
                        ndvi_val = ndvi_data[i, j]
                        
                        if ndvi_val < 0.3:
                            # Red to Yellow gradient (stressed to moderate)
                            ratio = (ndvi_val + 1) / 1.3  # Map [-1, 0.3] to [0, 1]
                            rgba_image[i, j] = [255, int(255 * ratio), 0, 255]  # Opaque
                        elif ndvi_val < 0.6:
                            # Yellow to Green gradient (moderate to healthy)
                            ratio = (ndvi_val - 0.3) / 0.3  # Map [0.3, 0.6] to [0, 1]
                            rgba_image[i, j] = [int(255 * (1 - ratio)), 255, 0, 255]  # Opaque
                        else:
                            # Green (healthy)
                            intensity = int(100 + (ndvi_val - 0.6) * 387.5)  # Map [0.6, 1] to [100, 255]
                            rgba_image[i, j] = [0, min(255, intensity), 0, 255]  # Opaque
                    else:
                        # Fully transparent for masked pixels
                        rgba_image[i, j] = [0, 0, 0, 0]
            
            # Create PIL Image with alpha channel
            pil_image = Image.fromarray(rgba_image, mode='RGBA')
            
            # Scale up if image is very small (use NEAREST to preserve colors)
            if width < 100 or height < 100:
                scale_factor = max(100 // width, 100 // height, 2)
                new_size = (width * scale_factor, height * scale_factor)
                pil_image = pil_image.resize(new_size, Image.NEAREST)
            
            # Convert to base64
            buffer = io.BytesIO()
            pil_image.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            print(f"Error generating NDVI image: {e}")
            return None
    
    def calculate_ndvi_from_s3(self, item, geojson):
        """
        Calculate all indices from Sentinel-2 bands stored on S3 and generate colored overlay images.
        
        Args:
            item: STAC item with band URLs
            geojson: GeoJSON geometry to clip to
            
        Returns:
            dict with all index statistics and images
        """
        if self.mock_mode:
            return self._mock_ndvi()
        
        try:
            from image_generator import generate_index_image
            
            # Get band URLs from STAC item
            blue_url = item.assets['blue'].href    # Band 2 (10m resolution)
            green_url = item.assets['green'].href  # Band 3 (10m resolution)
            red_url = item.assets['red'].href      # Band 4 (10m resolution)
            nir_url = item.assets['nir'].href      # Band 8 (10m resolution)
            swir_url = item.assets['swir16'].href  # Band 11 (20m resolution, for NDMI)
            
            print(f"Reading bands from S3...")
            print(f"BLUE: {blue_url[:80]}...")
            print(f"GREEN: {green_url[:80]}...")
            print(f"RED: {red_url[:80]}...")
            print(f"NIR: {nir_url[:80]}...")
            print(f"SWIR: {swir_url[:80]}...")
            
            # Create AWS session for rasterio (unsigned access)
            aws_session = AWSSession(
                boto3.Session(),
                requester_pays=False
            )
            
            # Get geometry bounds in WGS84 (EPSG:4326)
            geom = shape(geojson)
            bounds_wgs84 = geom.bounds  # (minx, miny, maxx, maxy)
            
            print(f"WGS84 bounds: {bounds_wgs84}")
            
            with rasterio.Env(aws_session):
                # Read BLUE band
                with rasterio.open(blue_url) as blue_src:
                    print(f"Raster CRS: {blue_src.crs}")
                    bounds_raster = transform_bounds('EPSG:4326', blue_src.crs, *bounds_wgs84)
                    window = from_bounds(*bounds_raster, transform=blue_src.transform)
                    blue = blue_src.read(1, window=window, masked=True)
                    window_transform = blue_src.window_transform(window)
                    window_shape = blue.shape
                    raster_crs = blue_src.crs
                
                # Read GREEN band
                with rasterio.open(green_url) as green_src:
                    bounds_raster = transform_bounds('EPSG:4326', green_src.crs, *bounds_wgs84)
                    window = from_bounds(*bounds_raster, transform=green_src.transform)
                    green = green_src.read(1, window=window, masked=True)
                
                # Read RED band
                with rasterio.open(red_url) as red_src:
                    bounds_raster = transform_bounds('EPSG:4326', red_src.crs, *bounds_wgs84)
                    window = from_bounds(*bounds_raster, transform=red_src.transform)
                    red = red_src.read(1, window=window, masked=True)
                    print(f"RED band shape: {red.shape}")
                
                # Read NIR band
                with rasterio.open(nir_url) as nir_src:
                    bounds_raster = transform_bounds('EPSG:4326', nir_src.crs, *bounds_wgs84)
                    window = from_bounds(*bounds_raster, transform=nir_src.transform)
                    nir = nir_src.read(1, window=window, masked=True)
                    print(f"NIR band shape: {nir.shape}")
                
                # Read SWIR band (20m resolution - will be resampled)
                with rasterio.open(swir_url) as swir_src:
                    bounds_raster = transform_bounds('EPSG:4326', swir_src.crs, *bounds_wgs84)
                    window = from_bounds(*bounds_raster, transform=swir_src.transform)
                    swir = swir_src.read(1, window=window, masked=True)
                    # Resample SWIR to match 10m bands using nearest neighbor
                    from scipy.ndimage import zoom
                    scale_factor = (red.shape[0] / swir.shape[0], red.shape[1] / swir.shape[1])
                    swir = zoom(swir.filled(0), scale_factor, order=0)  # order=0 = nearest neighbor
                    swir = np.ma.masked_array(swir, mask=red.mask if hasattr(red, 'mask') else False)
                    print(f"SWIR band resampled to shape: {swir.shape}")
            
            # Calculate indices (add epsilon to avoid division by zero)
            eps = 1e-8
            
            # NDVI = (NIR - Red) / (NIR + Red)
            ndvi = (nir.astype(float) - red.astype(float)) / (nir.astype(float) + red.astype(float) + eps)
            
            # NDWI = (Green - NIR) / (Green + NIR)
            ndwi = (green.astype(float) - nir.astype(float)) / (green.astype(float) + nir.astype(float) + eps)
            
            # NDMI = (NIR - SWIR) / (NIR + SWIR)
            ndmi = (nir.astype(float) - swir.astype(float)) / (nir.astype(float) + swir.astype(float) + eps)
            
            # EVI = 2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))
            evi = 2.5 * ((nir.astype(float) - red.astype(float)) / 
                        (nir.astype(float) + 6 * red.astype(float) - 7.5 * blue.astype(float) + 1))
            
            # SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L=0.5
            L = 0.5
            savi = ((nir.astype(float) - red.astype(float)) / 
                   (nir.astype(float) + red.astype(float) + L)) * (1 + L)
            
            # --- UPSAMPLING for all indices ---
            upscale_factor = int(os.getenv('NDVI_UPSCALE_FACTOR', '3'))
            
            # Upsample all index arrays
            ndvi_high_res = np.repeat(np.repeat(ndvi, upscale_factor, axis=0), upscale_factor, axis=1)
            ndwi_high_res = np.repeat(np.repeat(ndwi, upscale_factor, axis=0), upscale_factor, axis=1)
            ndmi_high_res = np.repeat(np.repeat(ndmi, upscale_factor, axis=0), upscale_factor, axis=1)
            evi_high_res = np.repeat(np.repeat(evi, upscale_factor, axis=0), upscale_factor, axis=1)
            
            new_transform = window_transform * Affine.scale(1/upscale_factor, 1/upscale_factor)
            new_shape = ndvi_high_res.shape
            
            # Transform the polygon geometry to raster CRS
            project = pyproj.Transformer.from_crs('EPSG:4326', raster_crs, always_xy=True)
            geom_raster_crs = shapely_transform(project.transform, geom)
            
            # Create mask for high-res arrays
            polygon_mask = geometry_mask(
                [geom_raster_crs],
                out_shape=new_shape,
                transform=new_transform,
                invert=False
            )
            
            # Apply mask to all high-res arrays
            if hasattr(ndvi, 'mask'):
                mask_high_res = np.repeat(np.repeat(ndvi.mask, upscale_factor, axis=0), upscale_factor, axis=1)
                final_mask = mask_high_res | polygon_mask
            else:
                final_mask = polygon_mask
            
            ndvi_masked = np.ma.masked_array(ndvi_high_res, mask=final_mask)
            ndwi_masked = np.ma.masked_array(ndwi_high_res, mask=final_mask)
            ndmi_masked = np.ma.masked_array(ndmi_high_res, mask=final_mask)
            evi_masked = np.ma.masked_array(evi_high_res, mask=final_mask)
            
            # Generate colored images for all indices
            print("Generating colored overlay images...")
            ndvi_image = generate_index_image(ndvi_masked, 'ndvi')
            ndwi_image = generate_index_image(ndwi_masked, 'ndwi')
            ndmi_image = generate_index_image(ndmi_masked, 'ndmi')
            evi_image = generate_index_image(evi_masked, 'evi')
            print("✓ All overlay images generated")
            
            # Calculate stats on ORIGINAL low-res data for all indices
            low_res_mask = geometry_mask(
                [geom_raster_crs],
                out_shape=window_shape,
                transform=window_transform,
                invert=False
            )
            
            # Apply mask to all indices
            for idx_array in [ndvi, ndwi, ndmi, evi, savi]:
                if hasattr(idx_array, 'mask'):
                    idx_array.mask = idx_array.mask | low_res_mask
                else:
                    idx_array = np.ma.masked_array(idx_array, mask=low_res_mask)
            
            # Calculate stats for each index
            def get_stats(arr):
                valid = arr[~arr.mask] if hasattr(arr, 'mask') else arr
                valid = valid[np.isfinite(valid)]
                if valid.size == 0:
                    return None
                return float(np.mean(valid))
            
            ndvi_valid = ndvi[~ndvi.mask] if hasattr(ndvi, 'mask') else ndvi
            ndvi_valid = ndvi_valid[np.isfinite(ndvi_valid)]

            if ndvi_valid.size == 0:
                print("No valid NDVI values after masking.")
                return {
                    "ndvi_mean": 0.0, "ndvi_std": 0.0, "ndvi_min": 0.0, "ndvi_max": 0.0,
                    "pixels_count": 0, "ndvi_image": None, "image_dimensions": "0x0px"
                }

            img_dims = f"{ndvi_high_res.shape[1]}x{ndvi_high_res.shape[0]}px"
            print(f"Indices calculated: NDVI={np.mean(ndvi_valid):.3f}, NDWI={get_stats(ndwi):.3f}, NDMI={get_stats(ndmi):.3f}, EVI={get_stats(evi):.3f}")

            # Calculate image bounds in WGS84
            minx = new_transform.c
            maxy = new_transform.f
            maxx = minx + (new_shape[1] * new_transform.a)
            miny = maxy + (new_shape[0] * new_transform.e)
            
            if minx > maxx: minx, maxx = maxx, minx
            if miny > maxy: miny, maxy = maxy, miny

            img_bounds_wgs84 = transform_bounds(raster_crs, 'EPSG:4326', minx, miny, maxx, maxy)
            
            return {
                "ndvi_mean": float(np.mean(ndvi_valid)),
                "ndvi_std": float(np.std(ndvi_valid)),
                "ndvi_min": float(np.min(ndvi_valid)),
                "ndvi_max": float(np.max(ndvi_valid)),
                "pixels_count": int(ndvi_valid.size),
                "ndvi_image": ndvi_image,
                "image_dimensions": img_dims,
                "image_bounds": list(img_bounds_wgs84),
                # New indices with images
                "ndwi": get_stats(ndwi),
                "ndwi_image": ndwi_image,
                "ndmi": get_stats(ndmi),
                "ndmi_image": ndmi_image,
                "evi": get_stats(evi),
                "evi_image": evi_image,
                "savi": get_stats(savi),
            }
            
        except Exception as e:
            logger.error(f"Error calculating indices from S3", exc_info=True, extra={"error": str(e)})
            # Return mock data on error
            return self._mock_ndvi()
    
    def process_parcel_ndvi(self, geojson, date_range=None):
        """
        Process NDVI for a parcel using AWS S3 data.
        
        Args:
            geojson: GeoJSON geometry of the parcel
            date_range: Date string or range (defaults to last 30 days)
            
        Returns:
            dict with NDVI statistics and metadata
        """
        if self.mock_mode:
            return self._mock_process(geojson)
        
        # Parse date range (configurable default via env var)
        if not date_range:
            end_date = datetime.now()
            default_days = int(os.getenv('SCENE_SEARCH_DAYS', '30'))
            start_date = end_date - timedelta(days=default_days)
        else:
            try:
                dates = date_range.split(',')
                start_date = datetime.strptime(dates[0].strip(), '%Y-%m-%d')
                if len(dates) > 1:
                    end_date = datetime.strptime(dates[-1].strip(), '%Y-%m-%d')
                else:
                    end_date = datetime.now()
            except ValueError as e:
                logger.warning(f"Error parsing date range", exc_info=True, extra={"error": str(e)})
                end_date = datetime.now()
                start_date = end_date - timedelta(days=default_days)
        
        logger.info(f"Processing NDVI", extra={
            "start_date": start_date.date().isoformat(),
            "end_date": end_date.date().isoformat(),
            "search_days": (end_date - start_date).days
        })
        
        # Search for scenes
        items = self.search_sentinel2_stac(
            geojson,
            start_date.strftime('%Y-%m-%d'),
            end_date.strftime('%Y-%m-%d')
        )
        
        if not items:
            return {
                "status": "error",
                "message": "No Sentinel-2 imagery found for this location and date range",
                "info": "Try expanding your date range or check if the area is over water/polar regions"
            }
        
        # Log all available scenes for transparency
        logger.info("=" * 80)
        logger.info(f"AVAILABLE SENTINEL-2 SCENES", extra={"total_scenes": len(items)})
        logger.info("=" * 80)
        
        scenes_info = []
        for idx, item in enumerate(items[:10], 1):  # Show first 10
            item_date = item.properties['datetime'][:10]
            item_cloud = item.properties.get('eo:cloud_cover', 0)
            item_platform = item.properties.get('platform', 'Sentinel-2')
            scene_info = {
                "index": idx,
                "date": item_date,
                "cloud_cover": round(item_cloud, 1),
                "platform": item_platform,
                "scene_id": item.id
            }
            scenes_info.append(scene_info)
            logger.info(f"{idx}. {item_date} | Cloud: {item_cloud:5.1f}% | {item_platform} | {item.id}")
        
        if len(items) > 10:
            logger.info(f"... and {len(items) - 10} more scenes")
        logger.info("=" * 80)
        
        # Scene selection priority (configurable via env var)
        # Options: "least_cloud" (default), "most_recent", "balanced"
        selection_mode = os.getenv('SCENE_SELECTION_MODE', 'least_cloud')
        
        if selection_mode == 'most_recent':
            # Prioritize most recent, then least cloud
            best_item = min(items, key=lambda x: (
                -datetime.fromisoformat(x.properties['datetime'].replace('Z', '+00:00')).timestamp(),
                x.properties.get('eo:cloud_cover', 100)
            ))
        elif selection_mode == 'balanced':
            # Balanced: moderate cloud cover acceptable if more recent
            best_item = min(items, key=lambda x: (
                x.properties.get('eo:cloud_cover', 100) * 0.6 + 
                (-datetime.fromisoformat(x.properties['datetime'].replace('Z', '+00:00')).timestamp() / 86400 * 0.4)
            ))
        else:  # Default: "least_cloud"
            # Prioritize least cloud cover, then most recent
            best_item = min(items, key=lambda x: (
                x.properties.get('eo:cloud_cover', 100),
                -datetime.fromisoformat(x.properties['datetime'].replace('Z', '+00:00')).timestamp()
            ))
        
        selected_scene_info = {
            "selection_mode": selection_mode,
            "scene_id": best_item.id,
            "date": best_item.properties['datetime'][:10],
            "cloud_cover": round(best_item.properties.get('eo:cloud_cover', 0), 1),
            "platform": best_item.properties.get('platform', 'Sentinel-2')
        }
        
        logger.info("📡 SELECTED SCENE", extra=selected_scene_info)
        logger.info(f"   Scene ID: {best_item.id}")
        logger.info(f"   Date: {best_item.properties['datetime'][:10]}")
        logger.info(f"   Cloud cover: {best_item.properties.get('eo:cloud_cover', 0):.1f}%")
        logger.info(f"   Platform: {best_item.properties.get('platform', 'Sentinel-2')}")
        logger.info("=" * 80)
        
        # Calculate NDVI
        ndvi_stats = self.calculate_ndvi_from_s3(best_item, geojson)
        
        # Build response
        result = {
            "status": "success",
            "message": "NDVI calculated from AWS Sentinel-2 Open Data",
            **ndvi_stats,
            "product_date": best_item.properties['datetime'][:10],
            "cloud_cover": best_item.properties.get('eo:cloud_cover', 0),
            "satellite": best_item.properties.get('platform', 'Sentinel-2'),
            "scene_id": best_item.id,
            "data_source": "AWS S3 Open Data (sentinel-s2-l2a)",
        }
        
        # Add preview URL if available
        if 'thumbnail' in best_item.assets:
            result['preview_url'] = best_item.assets['thumbnail'].href
        
        return result
    
    def _mock_search(self, geojson, start_date, end_date):
        """Mock search for development."""
        print("MOCK: Simulating STAC search")
        return [{"mock": "item"}]
    
    def _mock_ndvi(self):
        """Mock NDVI calculation."""
        return {
            "ndvi_mean": 0.68,
            "ndvi_std": 0.12,
            "ndvi_min": 0.35,
            "ndvi_max": 0.85,
            "pixels_count": 15000
        }
    
    def _mock_process(self, geojson):
        """Mock processing for development."""
        print("MOCK MODE: Returning simulated NDVI data")
        return {
            "status": "success",
            "message": "NDVI processed (MOCK MODE - install dependencies for real processing)",
            "ndvi_mean": 0.68,
            "ndvi_std": 0.12,
            "ndvi_min": 0.35,
            "ndvi_max": 0.85,
            "pixels_count": 15000,
            "product_date": (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
            "cloud_cover": 15.2,
            "satellite": "Sentinel-2A",
            "scene_id": "S2A_MSIL2A_20251115T..._MOCK",
            "data_source": "AWS S3 Open Data (Mock Mode)",
            "info": "Install boto3, rasterio, pystac-client, and shapely to enable real satellite processing from AWS S3"
        }

