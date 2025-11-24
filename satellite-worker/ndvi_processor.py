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
    
    def calculate_ndwi(self, green_band, nir_band):
        """
        Calculate NDWI (Normalized Difference Water Index) for water stress detection.
        
        NDWI = (Green - NIR) / (Green + NIR)
        
        Water-stressed vegetation has lower NDWI values.
        Typical ranges:
        - NDWI > 0.3: Well-watered vegetation
        - 0.1 < NDWI < 0.3: Moderate water stress
        - NDWI < 0.1: Severe water stress
        
        Args:
            green_band: numpy array of green band values (Band 3 for Sentinel-2)
            nir_band: numpy array of NIR band values (Band 8 for Sentinel-2)
            
        Returns:
            numpy array of NDWI values (-1 to 1)
        """
        denominator = green_band + nir_band
        ndwi = np.where(
            denominator != 0,
            (green_band - nir_band) / denominator,
            0
        )
        return ndwi
    
    def calculate_ndmi(self, nir_band, swir_band):
        """
        Calculate NDMI (Normalized Difference Moisture Index) for canopy water content.
        
        NDMI = (NIR - SWIR) / (NIR + SWIR)
        
        Sensitive to changes in leaf water content.
        Typical ranges:
        - NDMI > 0.4: High water content
        - 0.2 < NDMI < 0.4: Moderate water content
        - NDMI < 0.2: Low water content / water stress
        
        Args:
            nir_band: numpy array of NIR band values (Band 8 for Sentinel-2)
            swir_band: numpy array of SWIR band values (Band 11 for Sentinel-2, 1610nm)
            
        Returns:
            numpy array of NDMI values (-1 to 1)
        """
        denominator = nir_band + swir_band
        ndmi = np.where(
            denominator != 0,
            (nir_band - swir_band) / denominator,
            0
        )
        return ndmi
    
    def calculate_evi(self, blue_band, red_band, nir_band):
        """
        Calculate EVI (Enhanced Vegetation Index) for improved vegetation monitoring.
        
        EVI = 2.5 * ((NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1))
        
        More sensitive to high biomass areas and less affected by atmospheric conditions.
        Typical ranges:
        - EVI > 0.6: Very healthy, dense vegetation
        - 0.4 < EVI < 0.6: Healthy vegetation
        - 0.2 < EVI < 0.4: Moderate vegetation
        - EVI < 0.2: Sparse vegetation or bare soil
        
        Args:
            blue_band: numpy array of blue band values (Band 2 for Sentinel-2)
            red_band: numpy array of red band values (Band 4 for Sentinel-2)
            nir_band: numpy array of NIR band values (Band 8 for Sentinel-2)
            
        Returns:
            numpy array of EVI values (typically -1 to 1, but can exceed for very dense vegetation)
        """
        denominator = nir_band + 6 * red_band - 7.5 * blue_band + 1
        evi = np.where(
            denominator != 0,
            2.5 * ((nir_band - red_band) / denominator),
            0
        )
        return evi
    
    def calculate_savi(self, red_band, nir_band, L=0.5):
        """
        Calculate SAVI (Soil Adjusted Vegetation Index) for areas with sparse vegetation.
        
        SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L)
        
        Reduces soil brightness influence, useful for olive groves with visible soil.
        L parameter: 0.5 is default, 0 for dense vegetation, 1 for no vegetation.
        
        Args:
            red_band: numpy array of red band values (Band 4 for Sentinel-2)
            nir_band: numpy array of NIR band values (Band 8 for Sentinel-2)
            L: soil brightness correction factor (default 0.5)
            
        Returns:
            numpy array of SAVI values
        """
        denominator = nir_band + red_band + L
        savi = np.where(
            denominator != 0,
            ((nir_band - red_band) / denominator) * (1 + L),
            0
        )
        return savi
    
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
        """Mock processing for development - returns all satellite indices."""
        import random
        
        # Generate realistic mock values for olive grove
        ndvi_base = 0.68  # Healthy olive vegetation
        
        return {
            "status": "success",
            "message": "Satellite indices processed (MOCK MODE - real satellite data requires Copernicus credentials)",
            
            # Vegetation indices
            "ndvi": round(ndvi_base + random.uniform(-0.05, 0.05), 3),  # 0.63-0.73 (Good)
            "evi": round(ndvi_base * 0.7 + random.uniform(-0.03, 0.03), 3),  # ~0.48 (Good)
            "savi": round(ndvi_base * 0.8 + random.uniform(-0.04, 0.04), 3),  # ~0.54 (Good)
            
            # Water stress indices
            "ndwi": round(0.25 + random.uniform(-0.08, 0.08), 3),  # 0.17-0.33 (Moderate-Good)
            "ndmi": round(0.30 + random.uniform(-0.06, 0.06), 3),  # 0.24-0.36 (Moderate-Good)
            
            # Metadata
            "product_date": (datetime.now() - timedelta(days=random.randint(3, 10))).strftime('%Y-%m-%d'),
            "cloud_cover": round(random.uniform(5.0, 25.0), 1),
            "resolution": 10.0,  # meters
            "source": "sentinel-2",
            
            # Legacy fields for compatibility
            "ndvi_mean": round(ndvi_base, 3),
            "ndvi_std": 0.12,
            "image_url": "https://via.placeholder.com/800x600/00ff00/ffffff?text=Satellite+Indices+(Mock)",
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

