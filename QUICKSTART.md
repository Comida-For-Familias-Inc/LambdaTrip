# 🚀 LambdaTrip Quick Start Guide

Get LambdaTrip up and running in 5 minutes! This guide will help you deploy the landmark analysis system quickly.

## 🚀 Quick Deployment

### 1. Prerequisites (2 minutes)
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Install SAM CLI
brew install aws-sam-cli  # macOS
# or
pip install aws-sam-cli   # Python

# Configure AWS
aws configure
```

### 2. Get API Keys (2 minutes)

#### Google Vision API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Vision API
4. Create API key
5. Copy the key

#### Weather API (Choose one)
**Option A: Use Google Weather API**
- Use the same API key as Vision API

**Option B: Use OpenWeatherMap (Free)**
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Get your free API key

### 3. Deploy (1 minute)
```bash
# Clone and deploy
git clone <repository-url>
cd LambdaTrip

# Deploy with guided setup
sam deploy --guided
```

When prompted, enter:
- Stack Name: `lambdatrip`
- Region: `us-east-1` (or your preferred region)
- Google Vision API Key: `your_vision_api_key`
- Google Weather API Key: `your_weather_api_key`

## 🧪 Test Immediately

### Test with Eiffel Tower
```bash
# Get your API endpoint
API_URL=$(aws cloudformation describe-stacks --stack-name lambdatrip --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

# Test the system
curl -X POST $API_URL/analyze-image \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1200px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
  }'
```

### Expected Response
```json
{
  "statusCode": 200,
  "body": {
    "landmark_detected": "Eiffel Tower",
    "analysis_data": {
      "landmark": {
        "name": "Eiffel Tower",
        "location": {
          "city": "Paris",
          "country": "France"
        }
      },
      "weather": {
        "temperature": {"current": 18},
        "conditions": "partly cloudy"
      },
      "country_info": {
        "name": {"common": "France"},
        "currencies": [{"name": "Euro"}]
      }
    },
    "analysis": {
      "summary": "The Eiffel Tower is an iconic symbol of Paris...",
      "travel_tips": [
        "Visit early morning to avoid crowds",
        "Bring comfortable walking shoes"
      ]
    }
  }
}
```

## 🎯 What You Get

✅ **Landmark Detection**: Identifies landmarks from image URLs  
✅ **Weather Data**: Current weather at the landmark location  
✅ **Country Info**: Currency, languages, timezones, etc.  
✅ **Travel Advisories**: Safety information for the destination  
✅ **AI Analysis**: Personalized travel recommendations  
✅ **S3 Storage**: Automatic result storage and cleanup  

## 🔧 Customization

### Change Supported Landmarks
Edit `src/image_processor/app.py` to add more landmarks:
```python
landmark_cities = {
    "your landmark": "your city",
    "another landmark": "another city"
}
```

### Modify AI Analysis
Edit `src/landmark_analyzer/app.py` to customize Bedrock prompts:
```python
prompt = """
Your custom prompt here...
"""
```

### Add New APIs
Edit `src/shared/api_helpers.py` to integrate additional services:
```python
def get_custom_data(location):
    # Your custom API integration
    pass
```

## 🚨 Troubleshooting

### Common Issues

**"No landmarks detected"**
- Check image URL is accessible
- Verify Google Vision API key is valid
- Try a different landmark image

**"Weather API error"**
- Verify weather API key
- Check if location coordinates are valid

**"Bedrock access denied"**
- Ensure Bedrock is available in your region
- Check IAM permissions

### Quick Debug
```bash
# Check logs
sam logs -n ImageProcessorFunction --stack-name lambdatrip --tail

# Test locally
sam local invoke ImageProcessorFunction -e events/analyze-image-event.json
```

## 📊 Monitor Usage

### View Metrics
```bash
# Check Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=lambdatrip-ImageProcessorFunction-XXXXXXXXX \
  --start-time $(date -d '1 hour ago' --iso-8601=seconds) \
  --end-time $(date --iso-8601=seconds) \
  --period 300 \
  --statistics Sum
```

### Check S3 Usage
```bash
# List analysis results
aws s3 ls s3://landmark-analysis-lambdatrip-XXXXXXXXX/landmark_analysis/
```

## 💰 Cost Estimation

**Free Tier (Monthly)**
- Lambda: 1M requests, 400K GB-seconds
- S3: 5GB storage, 20K requests
- API Gateway: 1M requests

**Typical Usage (1000 requests/month)**
- Lambda: ~$0.20
- S3: ~$0.02
- API Gateway: ~$3.50
- **Total: ~$3.72/month**

## 🎉 Next Steps

1. **Integrate with your app**: Use the API endpoints in your frontend
2. **Add authentication**: Secure your API with API keys or JWT
3. **Scale up**: Add CloudFront, custom domains, monitoring
4. **Extend features**: Add more APIs, custom analysis, notifications

## 📞 Need Help?

1. Check the full [README.md](README.md) for detailed documentation
2. Review [SAM-DEPLOYMENT.md](SAM-DEPLOYMENT.md) for advanced deployment options
3. Check CloudWatch logs for error details
4. Test locally with `sam local invoke`

---

**You're all set! 🚀** Your LambdaTrip landmark analysis system is now live and ready to analyze travel destinations from images. 