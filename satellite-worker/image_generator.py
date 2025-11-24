"""
Helper functions for generating colored overlay images for satellite indices.
"""
import numpy as np
import io
import base64
from PIL import Image


def generate_index_image(index_array, index_type='ndvi'):
    """
    Generate a colored image for any satellite index with transparency for masked areas.
    
    Args:
        index_array: numpy masked array of index values
        index_type: type of index ('ndvi', 'ndwi', 'ndmi', 'evi')
        
    Returns:
        base64 encoded PNG image string
    """
    try:
        # Create RGBA image (with alpha channel for transparency)
        height, width = index_array.shape
        rgba_image = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Handle masked array
        if hasattr(index_array, 'mask'):
            valid_mask = ~index_array.mask
            index_data = np.where(valid_mask, index_array.data, np.nan)
        else:
            index_data = index_array
            valid_mask = np.isfinite(index_data)
        
        # Color mapping based on index type
        for i in range(height):
            for j in range(width):
                if valid_mask[i, j]:
                    val = index_data[i, j]
                    
                    if index_type == 'ndvi' or index_type == 'evi' or index_type == 'savi':
                        # Vegetation indices: Red -> Yellow -> Green
                        rgba_image[i, j] = _vegetation_color(val)
                    elif index_type == 'ndwi':
                        # Water index: Red -> Yellow -> Cyan -> Blue
                        rgba_image[i, j] = _water_color(val)
                    elif index_type == 'ndmi':
                        # Moisture index: Brown -> Yellow -> Green -> Blue
                        rgba_image[i, j] = _moisture_color(val)
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
        print(f"Error generating {index_type} image: {e}")
        return None


def _vegetation_color(val):
    """
    Color mapping for vegetation indices (NDVI, EVI, SAVI).
    Red (stressed) -> Yellow (moderate) -> Green (healthy)
    """
    if val < 0.3:
        # Red to Yellow gradient (stressed to moderate)
        ratio = (val + 1) / 1.3  # Map [-1, 0.3] to [0, 1]
        return [255, int(255 * ratio), 0, 255]  # Opaque
    elif val < 0.6:
        # Yellow to Green gradient (moderate to healthy)
        ratio = (val - 0.3) / 0.3  # Map [0.3, 0.6] to [0, 1]
        return [int(255 * (1 - ratio)), 255, 0, 255]  # Opaque
    else:
        # Green (healthy)
        intensity = int(100 + (val - 0.6) * 387.5)  # Map [0.6, 1] to [100, 255]
        return [0, min(255, intensity), 0, 255]  # Opaque


def _water_color(val):
    """
    Color mapping for NDWI (water stress index).
    Red (severe stress) -> Yellow (moderate) -> Cyan (good) -> Blue (excellent)
    """
    if val < 0.0:
        # Red to Yellow (severe to moderate stress)
        ratio = (val + 1) / 1.0  # Map [-1, 0] to [0, 1]
        return [255, int(255 * ratio), 0, 255]
    elif val < 0.2:
        # Yellow to Cyan (moderate to good)
        ratio = val / 0.2  # Map [0, 0.2] to [0, 1]
        return [int(255 * (1 - ratio)), 255, int(255 * ratio), 255]
    elif val < 0.4:
        # Cyan to Blue (good to excellent)
        ratio = (val - 0.2) / 0.2  # Map [0.2, 0.4] to [0, 1]
        return [0, int(255 * (1 - ratio)), 255, 255]
    else:
        # Deep blue (excellent water content)
        intensity = max(100, int(255 * (1 - (val - 0.4) / 0.6)))
        return [0, 0, min(255, intensity + 50), 255]


def _moisture_color(val):
    """
    Color mapping for NDMI (moisture index).
    Brown (dry) -> Yellow (moderate) -> Green (good) -> Blue (wet)
    """
    if val < 0.0:
        # Brown to Yellow (dry to moderate)
        ratio = (val + 1) / 1.0  # Map [-1, 0] to [0, 1]
        return [165 + int(90 * ratio), int(100 + 155 * ratio), 42, 255]  # Brown to Yellow
    elif val < 0.3:
        # Yellow to Green (moderate to good)
        ratio = val / 0.3  # Map [0, 0.3] to [0, 1]
        return [int(255 * (1 - ratio)), 255, int(128 * ratio), 255]
    elif val < 0.5:
        # Green to Teal (good to very good)
        ratio = (val - 0.3) / 0.2  # Map [0.3, 0.5] to [0, 1]
        return [0, 255, int(128 + 127 * ratio), 255]
    else:
        # Teal to Blue (very good to saturated)
        ratio = (val - 0.5) / 0.5  # Map [0.5, 1.0] to [0, 1]
        return [0, int(255 * (1 - ratio)), 255, 255]
