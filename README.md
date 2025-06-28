# 🗼 LambdaTrip - AI-Powered Landmark Analysis

LambdaTrip is an AWS Lambda-based AI travel assistant that analyzes landmark images to provide comprehensive travel information. Users simply provide an image URL of a landmark, and the system returns detailed travel insights including weather, country information, travel advisories, and AI-generated recommendations.

## 🚀 Features

- **🔍 Landmark Detection**: Uses Google Vision API to identify landmarks from images
- **🌤️ Weather Information**: Real-time weather data for the landmark location
- **🌍 Country Intelligence**: Comprehensive country information from RestCountries API
- **⚠️ Travel Advisories**: Safety information from Smart Traveller API
- **🤖 AI Analysis**: Amazon Bedrock-powered travel recommendations and insights
- **📊 Data Storage**: S3-based result storage with automatic cleanup

## 🏗️ Architecture

```
User Input (Image URL)
         ↓
┌─────────────────────┐
│  Image Processor    │ ← Google Vision API
│  Lambda Function    │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  Landmark Analyzer  │ ← Amazon Bedrock
│  Lambda Function    │
└─────────────────────┘
         ↓
┌─────────────────────┐
│  S3 Storage         │ ← Analysis Results
└─────────────────────┘
```

## 📋 Prerequisites

- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Python 3.11+
- API Keys:
  - Google Vision API Key
  - Google Weather API Key (or OpenWeatherMap API Key)

## 🛠️ Installation & Deployment

### 1. Clone the Repository
```bash
git clone <repository-url>
cd LambdaTrip
```

### 2. Install Dependencies
```bash
# Install uv (recommended)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or use pip
pip install -r src/image_processor/requirements.txt
pip install -r src/landmark_analyzer/requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file or set environment variables:
```bash
export GOOGLE_VISION_API_KEY="your_google_vision_api_key"
export GOOGLE_WEATHER_API_KEY="your_google_weather_api_key"
```

### 4. Deploy with SAM
```bash
# Build the application
sam build

# Deploy (first time)
sam deploy --guided

# Subsequent deployments
sam deploy
```

### 5. Get API Endpoints
After deployment, note the API Gateway endpoints from the CloudFormation outputs:
- `/analyze-image` - Process landmark images
- `/analyze-landmark` - Analyze landmark data (internal use)

## 🧪 Testing

### Local Testing
```bash
# Test image processing
sam local invoke ImageProcessorFunction -e events/analyze-image-event.json

# Test landmark analysis
sam local invoke LandmarkAnalyzerFunction -e events/analyze-landmark-event.json
```

### API Testing
```bash
# Get the API endpoint
API_URL=$(aws cloudformation describe-stacks --stack-name lambdatrip --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

# Test image analysis
curl -X POST $API_URL/analyze-image \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1200px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
  }'
```

## 📊 API Reference

### POST /analyze-image
Process a landmark image and return comprehensive analysis.

**Request Body:**
```json
{
  "image_url": "https://example.com/landmark-image.jpg"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "body": {
    "landmark_detected": "Eiffel Tower",
    "analysis_data": {
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
    },
    "analysis": {
      "summary": "The Eiffel Tower is an iconic symbol of Paris...",
      "insights": [
        "Best visited during spring or fall for pleasant weather",
        "Consider purchasing skip-the-line tickets"
      ],
      "travel_tips": [
        "Visit early morning to avoid crowds",
        "Bring comfortable walking shoes"
      ],
      "best_visit_time": "Spring (March-May) or Fall (September-November)",
      "safety_rating": "4 - Very Safe",
      "cultural_highlights": "French culture emphasizes politeness and formality"
    },
    "recommendations": {
      "packing_tips": ["Pack light clothing - temperatures are moderate"],
      "timing_recommendations": ["Spring (March-May) or Fall (September-November)"],
      "cultural_notes": ["Local currency: Euro", "Primary language: French"],
      "safety_advice": []
    },
    "s3_key": "landmark_analysis/20241220_143022_analysis.json",
    "timestamp": "2024-12-20T14:30:22.123Z"
  }
}
```

## 🔧 Configuration

### Environment Variables
- `GOOGLE_VISION_API_KEY`: Google Vision API key for landmark detection
- `GOOGLE_WEATHER_API_KEY`: Google Weather API key for weather data
- `S3_BUCKET`: S3 bucket for storing analysis results (auto-created)

### Supported Landmarks
The system includes mappings for popular landmarks:
- Eiffel Tower (Paris, France)
- Tower Bridge (London, UK)
- Statue of Liberty (New York, USA)
- Taj Mahal (Agra, India)
- Sydney Opera House (Sydney, Australia)
- Christ the Redeemer (Rio de Janeiro, Brazil)
- Machu Picchu (Cusco, Peru)
- Petra (Petra, Jordan)
- Great Wall (Beijing, China)
- Colosseum (Rome, Italy)
- And many more...

## 🏛️ Project Structure

```
LambdaTrip/
├── src/
│   ├── image_processor/          # Google Vision API integration
│   │   ├── app.py               # Main Lambda function
│   │   └── requirements.txt     # Dependencies
│   ├── landmark_analyzer/        # Amazon Bedrock integration
│   │   ├── app.py               # Main Lambda function
│   │   └── requirements.txt     # Dependencies
│   └── shared/                  # Shared utilities
│       ├── api_helpers.py       # API integration functions
│       └── country_codes.json   # Country code mappings
├── events/                      # Test events
│   ├── analyze-image-event.json
│   └── analyze-landmark-event.json
├── template.yaml               # SAM template
├── samconfig.toml             # SAM configuration
└── README.md                  # This file
```

## 🔒 Security

- All API keys are stored as environment variables
- S3 bucket has public access blocked
- IAM roles follow least privilege principle
- Automatic cleanup of old analysis data (30 days)

## 🚨 Troubleshooting

### Common Issues

1. **Google Vision API Errors**
   - Verify API key is valid and has Vision API enabled
   - Check image URL is accessible and in supported format

2. **Weather API Errors**
   - Ensure weather API key is configured
   - Verify location coordinates are valid

3. **Bedrock Access Issues**
   - Confirm Bedrock model access in your AWS region
   - Check IAM permissions for Bedrock invocation

4. **S3 Permission Errors**
   - Verify Lambda execution role has S3 permissions
   - Check bucket name and region configuration

### Debugging
```bash
# View CloudWatch logs
sam logs -n ImageProcessorFunction --stack-name lambdatrip --tail
sam logs -n LandmarkAnalyzerFunction --stack-name lambdatrip --tail
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Vision API for landmark detection
- Amazon Bedrock for AI analysis
- RestCountries API for country information
- Smart Traveller API for travel advisories
- OpenWeatherMap for weather data
