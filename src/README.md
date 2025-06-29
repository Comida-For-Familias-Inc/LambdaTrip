# LambdaTrip Backend Deployment Guide

This guide will help you deploy and operate the LambdaTrip landmark analysis backend using AWS SAM, Google Vision API, and Google Weather API.

---

## 📋 Prerequisites

- **AWS CLI** (configured)
- **SAM CLI**
- **Python 3.11+**
- **Docker** (for local testing)
- **API Keys:**
  - Google Vision API Key
  - Google Weather API Key

> **Note:** The backend also uses Amazon Bedrock, RestCountries, and a travel advisory API, but these do not require user-supplied API keys for deployment. See the main project README for details on all external APIs and their roles.

### Install Tools

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# SAM CLI
brew install aws-sam-cli  # macOS
# or
pip install aws-sam-cli   # Python

# uv (modern Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh
# or
pip install uv

# Docker (required for local testing)
# macOS: Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Linux: sudo apt-get install docker.io  # Ubuntu/Debian
# Windows: Install Docker Desktop from https://www.docker.com/products/docker-desktop

# Configure AWS
aws configure
```

---

## 🔑 Get API Keys

### Google Vision API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project, enable Vision API, create an API key.

### Google Weather API
- Use the same Google Cloud project as above.
- Enable the Google Weather API and use your API key.

---

## 🛠️ Deployment Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd LambdaTrip

# Install dependencies using uv (modern Python package manager)
uv sync
```

### 2. Deploy with SAM

```bash
sam deploy --guided
```
- Enter stack name (e.g., `lambdatrip`)
- Choose region (e.g., `us-east-1`)
- Enter your API keys when prompted

#### For subsequent deployments:
```bash
sam build
sam deploy
```

---

## ⚙️ Configuration

- **Environment Variables** (set automatically by SAM or via `.env`):
  - `GOOGLE_VISION_API_KEY`
  - `GOOGLE_WEATHER_API_KEY`
  - `S3_BUCKET` (auto-created)

---

## 🧪 Testing

### Local Lambda Testing

**Important:** For local testing, you need to provide environment variables including API keys. SAM uses Docker containers to simulate the Lambda runtime environment.

#### Prerequisites for Local Testing

1. **Docker must be running** - SAM local uses Docker containers to simulate Lambda
2. **Docker daemon accessible** - Ensure Docker is running and accessible to your user

#### Using env.json

1. Create an `env.json` file in the project root with your API keys:
```json
{
  "ImageProcessorFunction": {
    "GOOGLE_VISION_API_KEY": "your_google_vision_api_key_here",
    "GOOGLE_WEATHER_API_KEY": "your_google_weather_api_key_here", 
    "GOOGLE_GEOCODING_API_KEY": "your_google_geocoding_api_key_here",
    "S3_BUCKET": "test-landmark-analysis-bucket",
    "BEDROCK_MODEL_ID": "anthropic.claude-3-haiku-20240307-v1:0",
    "ENVIRONMENT": "local"
  },
  "LandmarkAnalyzerFunction": {
    "GOOGLE_VISION_API_KEY": "your_google_vision_api_key_here",
    "GOOGLE_WEATHER_API_KEY": "your_google_weather_api_key_here",
    "GOOGLE_GEOCODING_API_KEY": "your_google_geocoding_api_key_here", 
    "S3_BUCKET": "test-landmark-analysis-bucket",
    "BEDROCK_MODEL_ID": "anthropic.claude-3-haiku-20240307-v1:0",
    "ENVIRONMENT": "local"
  }
}
```

2. Test the functions:
```bash
# Test image processor
sam local invoke ImageProcessorFunction -e events/analyze-image-event.json --env-vars env.json

# Test landmark analyzer
sam local invoke LandmarkAnalyzerFunction -e events/analyze-landmark-event.json --env-vars env.json
```

### API Testing

```bash
# Get API endpoint
API_URL=$(aws cloudformation describe-stacks --stack-name lambdatrip --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

# Test with an image
curl -X POST $API_URL/analyze-image \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1200px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"}'
```

---

## 🧹 Cleanup

```bash
# Delete the stack and all resources
aws cloudformation delete-stack --stack-name lambdatrip
```

---

## 📈 Scaling & Cost

- **Free Tier:** Lambda, S3, and API Gateway are mostly free for low usage.
- **Typical Cost:** A few dollars/month for moderate usage.
- **Performance:** Increase Lambda memory/timeout as needed.

