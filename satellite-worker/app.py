import logging
from flask import Flask, request, jsonify
import os
from aws_ndvi_processor import AWSNDVIProcessor

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize AWS NDVI processor (uses S3 Open Data - no credentials needed)
processor = AWSNDVIProcessor()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "mode": "mock" if processor.mock_mode else "production",
        "message": "Satellite worker is running"
    })

@app.route('/process', methods=['POST'])
def process():
    """
    Process satellite imagery and calculate NDVI for a parcel.
    
    Expected request body:
    {
        "bbox": <GeoJSON geometry>,
        "date_range": "YYYY-MM-DD" or "YYYY-MM-DD,YYYY-MM-DD"
    }
    """
    data = request.json
    bbox = data.get('bbox')
    date_range = data.get('date_range')
    
    if not bbox:
        logger.warning("Missing bbox parameter in request")
        return jsonify({
            "status": "error",
            "message": "Missing bbox parameter"
        }), 400
    
    logger.info("Received NDVI processing request", extra={
        "bbox_type": type(bbox).__name__,
        "date_range": date_range
    })
    
    # Process NDVI using the processor
    try:
        result = processor.process_parcel_ndvi(bbox, date_range)
        
        logger.info("NDVI processing completed successfully", extra={
            "status": result.get('status'),
            "ndvi_mean": result.get('ndvi_mean'),
            "pixels_count": result.get('pixels_count'),
            "product_date": result.get('product_date')
        })
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error processing NDVI", exc_info=True, extra={"error": str(e)})
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    logger.info("🛰️ Satellite Worker Starting", extra={
        "mock_mode": processor.mock_mode,
        "port": 5000
    })
    app.run(host='0.0.0.0', port=5000, debug=False)

