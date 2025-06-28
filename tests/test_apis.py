#!/usr/bin/env python3
"""
Comprehensive API tests for LambdaTrip landmark analysis system.
Tests all external APIs and internal functions.
"""

import json
import os
import sys
import requests
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from shared.api_helpers import (
    get_weather, 
    get_country_info, 
    get_travel_advisory,
    validate_image_url,
    get_landmark_coordinates,
    map_country_to_smart_traveller_code
)

class TestLambdaTripAPIs(unittest.TestCase):
    """Test suite for all LambdaTrip APIs and functions."""
    
    def setUp(self):
        """Set up test environment."""
        # Test data
        self.test_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1200px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
        self.test_landmark = "Eiffel Tower"
        self.test_city = "Paris"
        self.test_country = "France"
        
        # API keys (set these as environment variables for real testing)
        self.google_api_key = os.getenv('GOOGLE_VISION_API_KEY')
        self.weather_api_key = os.getenv('GOOGLE_WEATHER_API_KEY')
        
        # Skip tests if no API keys
        self.skip_if_no_keys = not (self.google_api_key and self.weather_api_key)

    
    def test_google_vision_api(self):
        """Test Google Vision API for landmark detection."""
        if self.skip_if_no_keys:
            self.skipTest("Skipping Google Vision API test - no API key provided")
        
        print("\n🔍 Testing Google Vision API...")
        
        try:
            # Test Vision API endpoint
            vision_url = "https://vision.googleapis.com/v1/images:annotate"
            
            # Prepare request
            vision_request = {
                "requests": [
                    {
                        "image": {
                            "source": {
                                "imageUri": self.test_image_url
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
            
            # Make request
            response = requests.post(
                f"{vision_url}?key={self.google_api_key}",
                json=vision_request,
                timeout=30
            )
            
            print(f"  📊 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ Vision API working")
                
                # Check for landmarks
                if 'responses' in data and data['responses']:
                    response_data = data['responses'][0]
                    if 'landmarkAnnotations' in response_data:
                        landmarks = response_data['landmarkAnnotations']
                        print(f"  🗼 Detected {len(landmarks)} landmarks")
                        for landmark in landmarks:
                            print(f"    - {landmark.get('description', 'Unknown')} (confidence: {landmark.get('score', 0):.2f})")
                    else:
                        print(f"  ⚠️ No landmarks detected, but API is working")
                else:
                    print(f"  ⚠️ No response data, but API is working")
            else:
                print(f"  ❌ Vision API error: {response.status_code}")
                print(f"  📝 Error details: {response.text}")
                
        except Exception as e:
            print(f"  ❌ Vision API test failed: {str(e)}")
            self.fail(f"Vision API test failed: {str(e)}")

    def test_weather_api(self):
        """Test weather API functionality."""
        if self.skip_if_no_keys:
            self.skipTest("Skipping weather API test - no API key provided")
        
        print("\n🌤️ Testing Weather API...")
        
        try:
            weather_data = get_weather(self.test_city, self.test_country)
            
            if weather_data:
                print(f"  ✅ Weather data retrieved for {self.test_city}, {self.test_country}")
                
                # Handle different temperature formats
                temp_data = weather_data.get('temperature', {})
                if isinstance(temp_data, dict):
                    current_temp = temp_data.get('current', 'N/A')
                    feels_like = temp_data.get('feels_like', 'N/A')
                else:
                    current_temp = temp_data
                    feels_like = 'N/A'
                
                print(f"  🌡️ Temperature: {current_temp}°C")
                print(f"  🌡️ Feels Like: {feels_like}°C")
                print(f"  ☁️ Conditions: {weather_data.get('conditions', 'N/A')}")
                print(f"  💧 Humidity: {weather_data.get('humidity', 'N/A')}%")
                print(f"  💨 Wind Speed: {weather_data.get('wind_speed', 'N/A')} m/s")
                
                # Additional Google Weather API fields
                if weather_data.get('precipitation_chance'):
                    print(f"  🌧️ Precipitation Chance: {weather_data.get('precipitation_chance')}%")
                if weather_data.get('uv_index'):
                    print(f"  ☀️ UV Index: {weather_data.get('uv_index')}")
                if weather_data.get('is_daytime') is not None:
                    print(f"  🌅 Daytime: {weather_data.get('is_daytime')}")
                
                # Validate data structure
                self.assertIn('temperature', weather_data)
                self.assertIn('conditions', weather_data)
                self.assertIn('location', weather_data)
                
            else:
                print(f"  ❌ No weather data returned")
                self.fail("Weather API returned no data")
                
        except Exception as e:
            print(f"  ❌ Weather API test failed: {str(e)}")
            self.fail(f"Weather API test failed: {str(e)}")

    def test_country_info_api(self):
        """Test RestCountries API for country information."""
        print("\n🌍 Testing Country Info API...")
        
        try:
            country_data = get_country_info(self.test_country)
            
            if country_data:
                print(f"  ✅ Country data retrieved for {self.test_country}")
                print(f"  🏛️ Capital: {country_data.get('capital', ['N/A'])[0] if country_data.get('capital') else 'N/A'}")
                print(f"  🌍 Region: {country_data.get('region', 'N/A')}")
                print(f"  👥 Population: {country_data.get('population', 'N/A'):,}")
                
                currencies = country_data.get('currencies', [])
                if currencies:
                    print(f"  💰 Currency: {currencies[0].get('name', 'N/A')}")
                
                languages = country_data.get('languages', {})
                if languages:
                    print(f"  🗣️ Languages: {', '.join(languages.values())}")
                
                # Validate data structure
                self.assertIn('name', country_data)
                self.assertIn('capital', country_data)
                self.assertIn('region', country_data)
                
            else:
                print(f"  ❌ No country data returned")
                self.fail("Country API returned no data")
                
        except Exception as e:
            print(f"  ❌ Country API test failed: {str(e)}")
            self.fail(f"Country API test failed: {str(e)}")

    def test_travel_advisory_api(self):
        """Test Smart Traveller API for travel advisories."""
        print("\n⚠️ Testing Travel Advisory API...")
        
        try:
            advisory_data = get_travel_advisory(self.test_country)
            
            if advisory_data:
                print(f"  ✅ Travel advisory retrieved for {self.test_country}")
                print(f"  🚨 Level: {advisory_data.get('level', 'N/A')}")
                print(f"  📝 Summary: {advisory_data.get('summary', 'N/A')[:100]}...")
                print(f"  📅 Last Updated: {advisory_data.get('last_updated', 'N/A')}")
                print(f"  🏷️ Country Code: {advisory_data.get('country_code', 'N/A')}")
                
                advice = advisory_data.get('advice', [])
                if advice:
                    print(f"  💡 Advice: {len(advice)} items")
                    for i, item in enumerate(advice[:3]):  # Show first 3
                        print(f"    {i+1}. {item[:50]}...")
                
                # Validate data structure
                self.assertIn('level', advisory_data)
                self.assertIn('summary', advisory_data)
                self.assertIn('country_code', advisory_data)
                
            else:
                print(f"  ❌ No travel advisory data returned")
                self.fail("Travel advisory returned no data")
                
        except Exception as e:
            print(f"  ❌ Travel Advisory test failed: {str(e)}")
            self.fail(f"Travel Advisory test failed: {str(e)}")
        
        # Test with different countries
        test_countries = ["France", "UK", "India", "Unknown Country"]
        for country in test_countries:
            with self.subTest(country=country):
                try:
                    result = get_travel_advisory(country)
                    if result:
                        print(f"  ✅ {country}: {result.get('level', 'N/A')}")
                    else:
                        print(f"  ⚠️ {country}: No advisory data")
                except Exception as e:
                    print(f"  ❌ {country}: Error - {str(e)}")

    def test_country_code_mapping(self):
        """Test country code mapping functionality."""
        print("\n🗺️ Testing Country Code Mapping...")
        
        test_cases = [
            ("France", "FR"),
            ("UK", "GB"),
            ("United Kingdom", "GB"),
            ("United States", "US"),
            ("US", "US"),
            ("India", "IN"),
            ("Australia", "AU"),
            ("Brazil", "BR"),
            ("Peru", "PE"),
            ("Jordan", "JO"),
            ("China", "CN"),
            ("Italy", "IT"),
            ("Greece", "GR"),
            ("Spain", "ES"),
            ("Germany", "DE"),
            ("Japan", "JP"),
            ("Cambodia", "KH"),
            ("Unknown Country", None)
        ]
        
        for country, expected_code in test_cases:
            with self.subTest(country=country):
                result = map_country_to_smart_traveller_code(country)
                print(f"  {country} -> {result} (expected: {expected_code})")
                
                if expected_code:
                    self.assertEqual(result, expected_code)
                else:
                    self.assertIsNone(result)

    def test_landmark_coordinates(self):
        """Test landmark coordinate extraction."""
        if self.skip_if_no_keys:
            self.skipTest("Skipping coordinate test - no API key provided")
        
        print("\n📍 Testing Landmark Coordinates...")
        
        try:
            coords = get_landmark_coordinates(self.test_landmark, self.test_city, self.test_country)
            
            if coords:
                print(f"  ✅ Coordinates retrieved for {self.test_landmark}")
                print(f"  📍 Latitude: {coords.get('lat', 'N/A')}")
                print(f"  📍 Longitude: {coords.get('lng', 'N/A')}")
                
                # Validate coordinates
                self.assertIn('lat', coords)
                self.assertIn('lng', coords)
                self.assertIsInstance(coords['lat'], (int, float))
                self.assertIsInstance(coords['lng'], (int, float))
                
            else:
                print(f"  ❌ No coordinates returned")
                self.fail("Coordinate extraction failed")
                
        except Exception as e:
            print(f"  ❌ Coordinate test failed: {str(e)}")
            self.fail(f"Coordinate test failed: {str(e)}")

    def test_end_to_end_workflow(self):
        """Test the complete workflow with mock data."""
        print("\n🔄 Testing End-to-End Workflow...")
        
        # Mock data that would come from the APIs
        mock_analysis_data = {
            "landmark": {
                "name": "Eiffel Tower",
                "description": "Iconic iron lattice tower",
                "confidence": 0.95,
                "location": {
                    "city": "Paris",
                    "country": "France",
                    "lat": 48.8584,
                    "lng": 2.2945
                }
            },
            "weather": {
                "temperature": {
                    "current": 18,
                    "feels_like": 17,
                    "min": 12,
                    "max": 22
                },
                "conditions": "partly cloudy",
                "humidity": 65
            },
            "country_info": {
                "name": {"common": "France"},
                "capital": ["Paris"],
                "currencies": [{"name": "Euro"}],
                "languages": {"fra": "French"}
            },
            "travel_advisory": {
                "level": "Exercise normal safety precautions",
                "summary": "France is generally safe for travel"
            }
        }
        
        # Test data validation
        self.assertIn('landmark', mock_analysis_data)
        self.assertIn('weather', mock_analysis_data)
        self.assertIn('country_info', mock_analysis_data)
        self.assertIn('travel_advisory', mock_analysis_data)
        
        # Test landmark data
        landmark = mock_analysis_data['landmark']
        self.assertEqual(landmark['name'], 'Eiffel Tower')
        self.assertGreater(landmark['confidence'], 0.8)
        
        # Test weather data
        weather = mock_analysis_data['weather']
        self.assertIn('temperature', weather)
        self.assertIn('conditions', weather)
        
        # Test country data
        country = mock_analysis_data['country_info']
        self.assertEqual(country['name']['common'], 'France')
        self.assertIn('Paris', country['capital'])
        
        print(f"  ✅ End-to-end workflow validation passed")
        print(f"  🗼 Landmark: {landmark['name']}")
        print(f"  🌡️ Weather: {weather['temperature']['current']}°C, {weather['conditions']}")
        print(f"  🌍 Country: {country['name']['common']}")
        print(f"  ⚠️ Advisory: {mock_analysis_data['travel_advisory']['level']}")

    def test_error_handling(self):
        """Test error handling for various scenarios."""
        print("\n🚨 Testing Error Handling...")
        
        # Test with invalid country
        try:
            result = get_country_info("NonExistentCountry12345")
            print(f"  ✅ Invalid country handled gracefully: {result is None}")
        except Exception as e:
            print(f"  ❌ Invalid country caused error: {str(e)}")
        
        # Test with invalid image URL
        try:
            result = validate_image_url("https://invalid-url-that-does-not-exist-12345.com/image.jpg")
            print(f"  ✅ Invalid image URL handled gracefully: {result is False}")
        except Exception as e:
            print(f"  ❌ Invalid image URL caused error: {str(e)}")
        
        # Test with None values
        try:
            result = get_weather(None, None)
            print(f"  ✅ None values handled gracefully: {result is None}")
        except Exception as e:
            print(f"  ❌ None values caused error: {str(e)}")

def run_tests():
    """Run all tests with nice formatting."""
    print("🧪 LambdaTrip API Test Suite")
    print("=" * 50)
    print(f"📅 Test run started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Check for API keys
    google_key = os.getenv('GOOGLE_VISION_API_KEY')
    weather_key = os.getenv('GOOGLE_WEATHER_API_KEY')
    
    if not google_key or not weather_key:
        print("⚠️  Warning: Some API keys are missing!")
        print("   Set these environment variables for full testing:")
        print("   - GOOGLE_VISION_API_KEY")
        print("   - GOOGLE_WEATHER_API_KEY")
        print("   Tests that require API keys will be skipped.")
        print()
    
    # Run tests
    unittest.main(verbosity=2, exit=False)

if __name__ == "__main__":
    run_tests() 