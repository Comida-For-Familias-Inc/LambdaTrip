import requests
import logging
import json
import os
from typing import Optional, Dict, Any
from datetime import datetime
from .country_codes import COUNTRY_CODES

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, continue without it
    pass

logger = logging.getLogger()

# Google Weather API configuration
GOOGLE_GEOCODING_API_KEY = os.getenv("GOOGLE_GEOCODING_API_KEY")
GOOGLE_WEATHER_API_KEY = os.getenv("GOOGLE_WEATHER_API_KEY")
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_WEATHER_URL = "https://weather.googleapis.com/v1/currentConditions:lookup"

# API Configuration
RESTCOUNTRIES_BASE_URL = "https://restcountries.com/v3.1"
SMART_TRAVELLER_BASE_URL = "https://smartraveller.kevle.xyz/api/"

# Maps.co Geocoding API configuration
GEOCODE_API_KEY = os.getenv("GEOCODE_API_KEY")

def geocode_city_country(query: str) -> Dict[str, Optional[str]]:
    try:
        base_url = "https://geocode.maps.co/search"
        params = {"q": query, "format": "json", "addressdetails": 1, "limit": 1}
        if GEOCODE_API_KEY:
            params["api_key"] = GEOCODE_API_KEY
        response = requests.get(
            base_url,
            params=params,
            timeout=15,
            headers={"User-Agent": "LambdaTrip/1.0 (contact@example.com)"}
        )
        response.raise_for_status()
        results = response.json() or []
        if not results:
            return {"city": None, "country": None}

        top = results[0]
        address = top.get("address", {}) or {}
        city = (
            address.get("city") or address.get("town") or address.get("village")
            or address.get("hamlet") or address.get("municipality")
            or address.get("suburb") or address.get("county")
        )
        country = address.get("country")
        country_code = (address.get("country_code") or "").upper() or None

        if (not city or not country) and top.get("display_name"):
            parts = [p.strip() for p in top["display_name"].split(",") if p.strip()]
            if parts:
                country = country or parts[-1]
                if not city and len(parts) >= 3:
                    city = parts[-4] if len(parts) >= 4 else parts[-3]

        return {"city": city, "country": country, "country_code": country_code}
    except requests.RequestException:
        logger.warning(f"Geocoding request failed for '{query}'")
        return {"city": None, "country": None, "country_code": None}
    except Exception:
        logger.error(f"Unexpected error during geocoding for '{query}'")
        return {"city": None, "country": None, "country_code": None}

def get_weather(city: str, country: str) -> Optional[Dict[str, Any]]:
    """
    Get weather information for a city using Google Weather API
    """
    if not GOOGLE_GEOCODING_API_KEY:
        logger.warning("Google Geocoding API key not configured")
        return None
    if not GOOGLE_WEATHER_API_KEY:
        logger.warning("Google Weather API key not configured")
        return None
    
    try:
        # Use Google Weather API
        location = f"{city},{country}"
        url = GOOGLE_GEOCODE_URL
        params = {
            "address": location,
            "key": GOOGLE_GEOCODING_API_KEY
        }
        
        # First, geocode the location
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        geocode_data = response.json()
        if not geocode_data.get('results'):
            logger.warning(f"No geocoding results for {location}")
            return None
        
        # Extract coordinates
        location_data = geocode_data['results'][0]['geometry']['location']
        lat = location_data['lat']
        lng = location_data['lng']
        
        # Get weather data using coordinates
        weather_params = {
            "key": GOOGLE_WEATHER_API_KEY,
            "location.latitude": lat,
            "location.longitude": lng
        }
        
        weather_response = requests.get(GOOGLE_WEATHER_URL, params=weather_params, timeout=10)
        weather_response.raise_for_status()
        
        weather_data = weather_response.json()
        
        # Parse weather data (Google's response structure)
        # See: https://developers.google.com/maps/documentation/weather/reference/rest/v1/currentConditions/lookup
        # Example fields: temperature, feelsLikeTemperature, weatherCondition, relativeHumidity, wind, precipitation, isDaytime, uvIndex
        try:
            # Google Weather API may return either a 'currentConditions' list or a flat dict
            if "currentConditions" in weather_data and weather_data["currentConditions"]:
                current = weather_data["currentConditions"][0]
            else:
                current = weather_data
        except (KeyError, IndexError):
            logger.error(f"Unexpected Google Weather API response: {weather_data}")
            return None

        # Extract relevant fields
        temperature = current.get("temperature", {}).get("degrees")
        feels_like = current.get("feelsLikeTemperature", {}).get("degrees")
        condition = current.get("weatherCondition", {}).get("type")
        condition_text = current.get("weatherCondition", {}).get("description", {}).get("text")
        humidity = current.get("relativeHumidity")
        wind_speed = current.get("wind", {}).get("speed", {}).get("value")
        precipitation_chance = current.get("precipitation", {}).get("probability", {}).get("percent")
        is_daytime = current.get("isDaytime")
        uv_index = current.get("uvIndex")

        # Format weather information
        weather_info = {
            "location": {
                "city": city,
                "country": country,
                "coordinates": {
                    "lat": lat,
                    "lng": lng
                }
            },
            "temperature": {
                "current": temperature,
                "feels_like": feels_like,
                "min": None,  # Google Weather API doesn't provide min/max in current conditions
                "max": None
            },
            "conditions": condition_text or condition or "Unknown conditions",
            "humidity": humidity,
            "wind_speed": wind_speed,
            "timestamp": datetime.now().timestamp(),
            # Additional Google Weather API fields
            "condition": condition,
            "condition_text": condition_text,
            "precipitation_chance": precipitation_chance,
            "is_daytime": is_daytime,
            "uv_index": uv_index
        }
        
        logger.info(f"Weather data retrieved for {city}, {country}")
        return weather_info
        
    except requests.RequestException as e:
        logger.error(f"Error getting weather data: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in weather API: {str(e)}")
        return None

def get_country_info(country_name: str) -> Optional[Dict[str, Any]]:
    """
    Get country information using RestCountries API
    """
    try:
        # Search by country name
        url = f"{RESTCOUNTRIES_BASE_URL}/name/{country_name}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        countries_data = response.json()
        if not countries_data:
            logger.warning(f"No country data found for {country_name}")
            return None
        
        # Get the first (most relevant) result
        country_data = countries_data[0]
        
        # Format country information
        country_info = {
            "name": {
                "common": country_data.get('name', {}).get('common', ''),
                "official": country_data.get('name', {}).get('official', '')
            },
            "capital": country_data.get('capital', []),
            "region": country_data.get('region', ''),
            "subregion": country_data.get('subregion', ''),
            "population": country_data.get('population', 0),
            "currencies": list(country_data.get('currencies', {}).values()),
            "languages": country_data.get('languages', {}),
            "flags": {
                "png": country_data.get('flags', {}).get('png', ''),
                "svg": country_data.get('flags', {}).get('svg', '')
            },
            "timezones": country_data.get('timezones', []),
            "area": country_data.get('area', 0),
            "borders": country_data.get('borders', [])
        }
        
        logger.info(f"Country data retrieved for {country_name}")
        return country_info
        
    except requests.RequestException as e:
        logger.error(f"Error getting country data: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in country API: {str(e)}")
        return None

def get_travel_advisory(country_name: str, country_code: str) -> Optional[Dict[str, Any]]:
    """
    Get travel advisory information using Smart Traveller API
    """
    try:
        # Map country names to Smart Traveller country codes
        country_code = country_code if country_code else map_country_to_smart_traveller_code(country_name)
        if not country_code:
            logger.warning(f"No Smart Traveller code found for {country_name}")
            return None
        
        # Get travel advisory from Smart Traveller API
        url = f"{SMART_TRAVELLER_BASE_URL}advisory?country={country_code.lower()}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        advisory_data = response.json()
        
        # Format travel advisory information
        travel_advisory = {
            "country": country_name,
            "country_code": country_code,
            "level": advisory_data.get('level', 'Unknown'),
            "summary": advisory_data.get('summary', ''),
            "details": advisory_data.get('details', ''),
            "last_updated": advisory_data.get('last_updated', ''),
            "advice": advisory_data.get('advice', [])
        }
        
        logger.info(f"Travel advisory retrieved for {country_name}")
        return travel_advisory
        
    except requests.RequestException as e:
        logger.error(f"Error getting travel advisory: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in travel advisory API: {str(e)}")
        return None

def map_country_to_smart_traveller_code(country_name: str) -> Optional[str]:
    """
    Map country names to Smart Traveller API country codes
    """
    # Direct match (case-insensitive)
    for code_country, code in COUNTRY_CODES.items():
        if country_name.lower() == code_country.lower():
            return code
    
    # Partial match
    for code_country, code in COUNTRY_CODES.items():
        if country_name.lower() == code_country.lower() or code.lower() == country_name.lower():
            return code
    
    return None

def validate_image_url(image_url: str) -> bool:
    """
    Validate if the provided image URL is accessible
    """
    try:
        response = requests.head(image_url, timeout=10)
        return response.status_code == 200
    except:
        return False

def format_weather_summary(weather_data: Dict[str, Any]) -> str:
    """
    Format weather data into a human-readable summary
    
    Args:
        weather_data: Weather information dictionary
    
    Returns:
        Formatted weather summary string
    """
    if not weather_data:
        return "Weather information unavailable"
    
    temp = weather_data.get("temperature", "Unknown")
    description = weather_data.get("conditions", "Unknown conditions")
    humidity = weather_data.get("humidity", "Unknown")
    
    return f"{description.capitalize()}, {temp}°C, {humidity}% humidity" 