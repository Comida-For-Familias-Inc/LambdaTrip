import boto3
import json
import logging
import os
import requests
from datetime import datetime
from urllib.parse import urlparse

# Import shared utilities
from shared.api_helpers import get_weather, get_country_info, get_travel_advisory

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Google Vision API configuration
GOOGLE_VISION_API_KEY = os.getenv("GOOGLE_VISION_API_KEY")
GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate"

def lambda_handler(event, context):
    """
    Lambda function to process landmark images using Google Vision API
    """
    try:
        # Initialize S3 client
        s3 = boto3.client('s3')
        
        # Get environment variables
        google_vision_api_key = os.environ.get('GOOGLE_VISION_API_KEY')
        s3_bucket = os.environ.get('S3_BUCKET')
        
        # Extract image URL from event
        if 'body' in event and isinstance(event['body'], dict):
            image_url = event['body'].get('image_url', '')
        else:
            image_url = event.get('image_url', '')
        
        if not image_url:
            raise ValueError("No image URL provided")
        
        logger.info(f"Processing image: {image_url}")
        
        # Step 1: Analyze image with Google Vision API
        vision_result = analyze_image_with_vision(image_url, google_vision_api_key)
        
        if not vision_result or not vision_result.get('landmarks'):
            return {
                "statusCode": 400,
                "body": {
                    "error": "No landmarks detected in the image",
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        
        # Get the first detected landmark
        landmark = vision_result['landmarks'][0]
        landmark_name = landmark.get('name', 'Unknown Landmark')
        location = landmark.get('location', {})
        
        logger.info(f"Detected landmark: {landmark_name}")
        
        # Step 2: Get weather information
        weather_info = None
        if location.get('city') and location.get('country'):
            weather_info = get_weather(location['city'], location['country'])
        
        # Step 3: Get country information
        country_info = None
        if location.get('country'):
            country_info = get_country_info(location['country'])
        
        # Step 4: Get travel advisory
        travel_advisory = None
        if location.get('country'):
            travel_advisory = get_travel_advisory(location['country'])
        
        # Step 5: Prepare result for Bedrock analysis
        analysis_data = {
            "landmark": {
                "name": landmark_name,
                "description": landmark.get('description', ''),
                "confidence": landmark.get('confidence', 0),
                "location": location
            },
            "weather": weather_info,
            "country_info": country_info,
            "travel_advisory": travel_advisory,
            "image_url": image_url
        }
        
        # Step 6: Store intermediate result in S3
        result_key = f"landmark_analysis/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_analysis.json"
        s3.put_object(
            Bucket=s3_bucket,
            Key=result_key,
            Body=json.dumps(analysis_data, indent=2),
            ContentType='application/json'
        )
        
        logger.info(f"Analysis data stored at s3://{s3_bucket}/{result_key}")
        
        return {
            "statusCode": 200,
            "body": {
                "landmark_detected": landmark_name,
                "analysis_data": analysis_data,
                "s3_key": result_key,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error in image processing: {str(e)}")
        return {
            "statusCode": 500,
            "body": {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        }

def analyze_image_with_vision(image_url, api_key):
    """
    Use Google Vision API to detect landmarks in the image
    """
    if not api_key:
        logger.warning("Google Vision API key not configured")
        return None
    
    try:
        # Prepare the request for Google Vision API
        vision_request = {
            "requests": [
                {
                    "image": {
                        "source": {
                            "imageUri": image_url
                        }
                    },
                    "features": [
                        {
                            "type": "LANDMARK_DETECTION",
                            "maxResults": 5
                        },
                        {
                            "type": "LABEL_DETECTION",
                            "maxResults": 10
                        }
                    ]
                }
            ]
        }
        
        # Call Google Vision API
        response = requests.post(
            f"{GOOGLE_VISION_URL}?key={api_key}",
            json=vision_request,
            timeout=30
        )
        response.raise_for_status()
        
        vision_data = response.json()
        
        # Extract landmark information
        landmarks = []
        if 'responses' in vision_data and vision_data['responses']:
            response_data = vision_data['responses'][0]
            
            # Process landmark annotations
            if 'landmarkAnnotations' in response_data:
                for landmark in response_data['landmarkAnnotations']:
                    landmark_info = {
                        "name": landmark.get('description', ''),
                        "confidence": landmark.get('score', 0),
                        "description": landmark.get('description', ''),
                        "location": {
                            "lat": landmark.get('locations', [{}])[0].get('latLng', {}).get('latitude'),
                            "lng": landmark.get('locations', [{}])[0].get('latLng', {}).get('longitude')
                        }
                    }
                    
                    # Try to extract city/country from landmark name
                    # This is a simple heuristic - in production you might use geocoding
                    if landmark_info["name"]:
                        landmark_info["location"]["city"] = extract_city_from_landmark(landmark_info["name"])
                        landmark_info["location"]["country"] = extract_country_from_landmark(landmark_info["name"])
                    
                    landmarks.append(landmark_info)
            
            # If no landmarks found, try to extract location from labels
            if not landmarks and 'labelAnnotations' in response_data:
                location_info = extract_location_from_labels(response_data['labelAnnotations'])
                if location_info:
                    landmarks.append({
                        "name": "Unknown Landmark",
                        "confidence": 0.5,
                        "description": "Location detected from image labels",
                        "location": location_info
                    })
        
        logger.info(f"Vision API detected {len(landmarks)} landmarks")
        return {"landmarks": landmarks}
        
    except requests.RequestException as e:
        logger.error(f"Error calling Google Vision API: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in Vision API: {str(e)}")
        return None

def extract_city_from_landmark(landmark_name):
    """
    Simple heuristic to extract city from landmark name
    """
    # Common landmark to city mappings
    landmark_cities = {
        "eiffel tower": "Paris",
        "tower bridge": "London",
        "big ben": "London",
        "statue of liberty": "New York",
        "taj mahal": "Agra",
        "sydney opera house": "Sydney",
        "christ the redeemer": "Rio de Janeiro",
        "machu picchu": "Cusco",
        "petra": "Petra",
        "great wall": "Beijing",
        "colosseum": "Rome",
        "acropolis": "Athens",
        "sagrada familia": "Barcelona",
        "brandenburg gate": "Berlin",
        "mount fuji": "Tokyo",
        "angkor wat": "Siem Reap"
    }
    
    landmark_lower = landmark_name.lower()
    for landmark, city in landmark_cities.items():
        if landmark in landmark_lower:
            return city
    
    return None

def extract_country_from_landmark(landmark_name):
    """
    Simple heuristic to extract country from landmark name
    """
    # Common landmark to country mappings
    landmark_countries = {
        "eiffel tower": "France",
        "tower bridge": "UK",
        "big ben": "UK",
        "statue of liberty": "USA",
        "taj mahal": "India",
        "sydney opera house": "Australia",
        "christ the redeemer": "Brazil",
        "machu picchu": "Peru",
        "petra": "Jordan",
        "great wall": "China",
        "colosseum": "Italy",
        "acropolis": "Greece",
        "sagrada familia": "Spain",
        "brandenburg gate": "Germany",
        "mount fuji": "Japan",
        "angkor wat": "Cambodia"
    }
    
    landmark_lower = landmark_name.lower()
    for landmark, country in landmark_countries.items():
        if landmark in landmark_lower:
            return country
    
    return None

def extract_location_from_labels(labels):
    """
    Extract location information from image labels
    """
    location_keywords = [
        "landmark", "monument", "building", "architecture", "city", "town",
        "mountain", "beach", "forest", "park", "garden", "museum", "temple",
        "church", "mosque", "palace", "castle", "bridge", "tower"
    ]
    
    for label in labels:
        description = label.get('description', '').lower()
        if any(keyword in description for keyword in location_keywords):
            return {
                "city": None,
                "country": None,
                "description": description
            }
    
    return None 