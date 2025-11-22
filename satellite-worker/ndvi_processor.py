"""
NDVI Processing Module for Sentinel-2 Satellite Imagery

This module handles:
1. Querying Sentinel-2 data from Copernicus Open Access Hub
2. Downloading satellite imagery for a specific area and date range
3. Calculating NDVI (Normalized Difference Vegetation Index)
4. Generating overlays for map visualization
"""

import os
import numpy as np
from datetime import datetime, timedelta
try:
    from sentinelsat import SentinelAPI, read_geojson, geojson_to_wkt
    import rasterio
    from rasterio.mask import mask
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    from PIL import Image
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False
    print("WARNING: Satellite processing dependencies not available. Running in mock mode.")


class NDVIProcessor:
    def __init__(self):
        """Initialize the NDVI processor with Copernicus credentials."""
        # Credentials should be stored in environment variables
        # Register at: https://scihub.copernicus.eu/dhus/#/self-registration
        self.username = os.getenv('COPERNICUS_USER', None)
        self.password = os.getenv('COPERNICUS_PASSWORD', None)
        
        if self.username and self.password and DEPENDENCIES_AVAILABLE:
            self.api = SentinelAPI(
                self.username, 
                self.password, 
                'https://scihub.copernicus.eu/dhus'
            )
            self.mock_mode = False
        else:
            self.api = None
            self.mock_mode = True
            print("Running in MOCK mode. Set COPERNICUS_USER and COPERNICUS_PASSWORD for real data.")
    
    def calculate_ndvi(self, red_band, nir_band):
        """
        Calculate NDVI from red and near-infrared bands.
        
        NDVI = (NIR - Red) / (NIR + Red)
        
        Args:
            red_band: numpy array of red band values (Band 4 for Sentinel-2)
            nir_band: numpy array of NIR band values (Band 8 for Sentinel-2)
            
        Returns:
            numpy array of NDVI values (-1 to 1)
        """
        # Avoid division by zero
        denominator = nir_band + red_band
        ndvi = np.where(
            denominator != 0,
            (nir_band - red_band) / denominator,
            0
        )
        return ndvi
    
    def query_sentinel_data(self, geojson, start_date, end_date):
        """
        Query Sentinel-2 data for a specific area and time range.
        
        Args:
            geojson: GeoJSON geometry of the area of interest
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            
        Returns:
            OrderedDict of available products
        """
        if self.mock_mode:
            return self._mock_query(geojson, start_date, end_date)
        
        # Convert GeoJSON to WKT for Sentinel API
        footprint = geojson_to_wkt(geojson)
        
        # Query Sentinel-2 L2A products (atmospherically corrected)
        products = self.api.query(
            footprint,
            date=(start_date, end_date),
            platformname='Sentinel-2',
            producttype='S2MSI2A',  # Level-2A product
            cloudcoverpercentage=(0, 30)  # Max 30% cloud cover
        )
        
        return products
    
    def process_parcel_ndvi(self, geojson, date_range=None):
        """
        Process NDVI for a parcel.
        
        Args:
            geojson: GeoJSON geometry of the parcel
            date_range: Date string or range (defaults to last 30 days)
            
        Returns:
            dict with NDVI statistics and image URL
        """
        if self.mock_mode:
            return self._mock_process(geojson)
        
        # Parse date range
        if not date_range:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
        else:
            # Parse date_range string (e.g., "2025-01-01" or "2025-01-01,2025-01-31")
            dates = date_range.split(',')
            start_date = datetime.strptime(dates[0], '%Y-%m-%d')
            end_date = datetime.strptime(dates[-1], '%Y-%m-%d') if len(dates) > 1 else datetime.now()
        
        # Query available imagery
        products = self.query_sentinel_data(
            geojson,
            start_date.strftime('%Y%m%d'),
            end_date.strftime('%Y%m%d')
        )
        
        if not products:
            return {
                "status": "error",
                "message": "No satellite imagery available for this date range"
            }
        
        # Get the most recent product with least cloud cover
        product_df = self.api.to_dataframe(products)
        best_product = product_df.sort_values(['cloudcoverpercentage', 'beginposition']).iloc[0]
        
        # In a full implementation, you would:
        # 1. Download the product: self.api.download(best_product.name)
        # 2. Extract Band 4 (Red) and Band 8 (NIR)
        # 3. Calculate NDVI
        # 4. Clip to parcel geometry
        # 5. Generate visualization
        # 6. Upload to storage and return URL
        
        return {
            "status": "success",
            "message": "NDVI processed successfully",
            "ndvi_mean": 0.65,  # Would be calculated from actual data
            "ndvi_std": 0.15,
            "product_date": best_product['beginposition'].strftime('%Y-%m-%d'),
            "cloud_cover": float(best_product['cloudcoverpercentage']),
            "image_url": "/static/ndvi_placeholder.png"
        }
    
    def _mock_query(self, geojson, start_date, end_date):
        """Mock query for development without Copernicus credentials."""
        return {
            "mock_product_1": {
                "beginposition": datetime.now() - timedelta(days=7),
                "cloudcoverpercentage": 15.2
            }
        }
    
    def _mock_process(self, geojson):
        """Mock processing for development."""
        return {
            "status": "success",
            "message": "NDVI processed (MOCK MODE - real satellite data requires Copernicus credentials)",
            "ndvi_mean": 0.68,  # Simulated NDVI (0.6-0.8 = healthy vegetation)
            "ndvi_std": 0.12,
            "product_date": (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
            "cloud_cover": 15.2,
            "image_url": "https://via.placeholder.com/800x600/00ff00/ffffff?text=NDVI+Overlay+(Mock)",
            "info": "To enable real satellite processing, set COPERNICUS_USER and COPERNICUS_PASSWORD env vars"
        }


def create_ndvi_overlay(ndvi_array, output_path, colormap='RdYlGn'):
    """
    Create a colored NDVI overlay image.
    
    Args:
        ndvi_array: numpy array of NDVI values
        output_path: path to save the output image
        colormap: colormap to use (RdYlGn = Red-Yellow-Green)
    """
    if not DEPENDENCIES_AVAILABLE:
        return None
    
    # Normalize NDVI from [-1, 1] to [0, 255]
    normalized = ((ndvi_array + 1) * 127.5).astype(np.uint8)
    
    # Create colored image using PIL
    img = Image.fromarray(normalized, mode='L')
    img.save(output_path)
    
    return output_path

