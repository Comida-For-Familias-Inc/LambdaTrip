<p align="center">
  <img src="extension/icons/icon128.png" width="96" height="96" alt="LambdaTrip logo"/>
</p>

<h1 align="center">LambdaTrip</h1>
<p align="center"><b>AI-Powered Landmark Analysis & Chrome Extension</b></p>

---

## Features

- **Right-click Landmark Analysis:** Instantly analyze any image for landmarks via the Chrome extension.
- **AI-Powered Insights:** AWS Lambda backend integrates Google Vision API for landmark detection and Amazon Bedrock for travel analysis.
- **Comprehensive Results:** Get landmark name, location, weather, country info, travel advisories, and more—delivered directly in your browser.
- **Serverless & Secure:** All analysis is performed in the cloud using AWS Lambda, API Gateway, and S3.

---

## Architecture Overview

```
    User (Chrome Extension)
               │
               ▼
 ┌──────────────────────────────┐
 │        API Gateway           │
 │   (Receives image URL POST)  │
 └─────────────┬────────────────┘
               │
               ▼
 ┌───────────────────────────────┐
 │   Image Processor Lambda      │
 │  - Calls Google Vision API    │
 │  - Gets Weather, Country,     │
 │    and Travel Advisory APIs   │
 │  - Stores intermediate JSON   │
 │    in S3                      │
 │  - Invokes Landmark Analyzer  │
 └─────────────┬────────────────-┘
               │
               ▼
 ┌───────────────────────────────┐
 │   Landmark Analyzer Lambda    │
 │  - Calls Amazon Bedrock (AI)  │
 │  - Analyzes & enriches data   │
 │  - Stores final JSON in S3    │
 └─────────────┬────────────────-┘
               │
               ▼
 ┌───────────────────────────────┐
 │           S3 Bucket           │
 │   (Stores all analysis data)  │
 └─────────────┬────────────────-┘
               │
               ▼
 ┌──────────────────────────────┐
 │        API Gateway           │
 │   (Returns results to user)  │
 └─────────────┬────────────────┘
               │
               ▼
User (Chrome Extension Sidebar)
  (Displays results in modal)
```

---

### How it works:
1. **User** right-clicks an image in Chrome and sends the image URL to the backend via **API Gateway**.
2. **Image Processor Lambda**:
   - Calls **Google Vision API** for landmark detection.
   - Fetches weather, country, and travel advisory info from external APIs.
   - Stores intermediate results in **S3**.
   - Invokes **Landmark Analyzer Lambda** for deeper AI analysis.
3. **Landmark Analyzer Lambda**:
   - Uses **Amazon Bedrock** for AI-powered travel insights.
   - Stores final analysis in **S3**.
4. **API Gateway** returns the results to the Chrome extension.
5. **Chrome Extension** displays the results in a sidebar modal.

---

## Project Structure

```
LambdaTrip/
├── src/
│   ├── image_processor/          # Google Vision API integration
│   │   ├── app.py               # Main Lambda function
│   │   └── requirements.txt     # Dependencies
│   ├── landmark_analyzer/       # Amazon Bedrock integration
│   │   ├── app.py               # Main Lambda function
│   │   └── requirements.txt     # Dependencies
│   └── shared/                  # Shared utilities
│       ├── api_helpers.py       # API integration functions
│       └── country_codes.py     # Country code mappings
├── events/                      # Test events
├── extension/                   # Chrome extension frontend
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── styles.css
│   ├── popup.html
│   └── icons/
├── template.yaml                # SAM template
├── samconfig.toml               # SAM configuration
├── README.md                    # This file
└── ...
```

---

## Quick Start

### 1. **Deploy the Backend (Lambda Functions)**
- See the [Backend Deployment Guide](src/README.md) for full deployment instructions.
- Requires AWS CLI, SAM CLI, Python 3.11+, Docker (for local testing), and API keys for Google Vision, Weather, etc.
- **For local testing:** Copy `env.json.template` to `env.json` and add your API keys.

### 2. **Install the Chrome Extension**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` folder
4. The extension is now installed!

---

## How to Use the Extension

1. **Find an image** of a landmark on any website
2. **Right-click** the image
3. **Select "Analyze Landmark with LambdaTrip"** from the context menu
4. **View results** in the sidebar modal that slides in from the right

---

## What You'll Get

- **Landmark Information**: Name, confidence, and location (city/country)
- **Weather Data**: Current temperature, conditions, wind, humidity, day/night
- **Country Information**: Flag, official name, population, currency, language, region
- **Travel Advisory**: Level and summary for the country
- **AI Insights**: Key insights, travel tips, best time to visit, safety, and cultural highlights
- **Detected Text**: Any text found in the image


## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## ☁️ AWS Services Used

- **AWS Lambda**: Serverless compute for backend logic (Image Processor & Landmark Analyzer)
- **Amazon API Gateway**: Exposes REST API endpoints for the Chrome extension to interact with the backend
- **Amazon S3**: Stores intermediate and final analysis results as JSON
- **Amazon Bedrock**: Provides advanced AI/LLM analysis (Claude 3 Haiku)
- **AWS CloudFormation**: Manages infrastructure as code (via SAM template)
- **AWS SAM (Serverless Application Model)**: Simplifies deployment and local testing of serverless resources
- **AWS IAM**: Manages permissions and roles for Lambda functions and other resources
- **Amazon CloudWatch**: (Optional) For logging and monitoring Lambda execution

---

