# 🚀 LambdaTrip SAM Deployment Guide

This guide walks you through deploying the LambdaTrip landmark analysis system using AWS SAM (Serverless Application Model).

## 📋 Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Configure AWS CLI
aws configure
```

### 2. SAM CLI Setup
```bash
# Install SAM CLI
brew install aws-sam-cli  # macOS
# or
pip install aws-sam-cli   # Python

# Verify installation
sam --version
```

### 3. Required API Keys

#### Google Vision API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Vision API
4. Create credentials (API Key)
5. Restrict the key to Vision API only

#### Google Weather API (or OpenWeatherMap)
**Option A: Google Weather API**
1. Enable Google Weather API in Google Cloud Console
2. Use the same API key as Vision API

**Option B: OpenWeatherMap (Free)**
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Get your API key
3. Update the code to use OpenWeatherMap instead

## 🛠️ Deployment Steps

### 1. Clone and Setup
```bash
git clone <repository-url>
cd LambdaTrip

# Install dependencies
pip install -r src/image_processor/requirements.txt
pip install -r src/landmark_analyzer/requirements.txt
```

### 2. Configure SAM
```bash
# First-time deployment with guided setup
sam deploy --guided
```

During the guided setup, you'll be prompted for:
- **Stack Name**: `lambdatrip` (or your preferred name)
- **AWS Region**: Choose your preferred region (e.g., `us-east-1`)
- **Google Vision API Key**: Your Google Vision API key
- **Google Weather API Key**: Your weather API key
- **Confirm changes**: Review and confirm

### 3. Manual Deployment (Alternative)
If you prefer manual configuration:

```bash
# Build the application
sam build

# Deploy with parameters
sam deploy \
  --stack-name lambdatrip \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    GoogleVisionApiKey=your_vision_api_key \
    GoogleWeatherApiKey=your_weather_api_key
```

### 4. Verify Deployment
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name lambdatrip

# Get API endpoints
aws cloudformation describe-stacks \
  --stack-name lambdatrip \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

## 🧪 Testing the Deployment

### 1. Test Image Processing
```bash
# Get the API endpoint
API_URL=$(aws cloudformation describe-stacks --stack-name lambdatrip --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)

# Test with Eiffel Tower image
curl -X POST $API_URL/analyze-image \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1200px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
  }'
```

### 2. Test Local Development
```bash
# Test image processor locally
sam local invoke ImageProcessorFunction -e events/analyze-image-event.json

# Test landmark analyzer locally
sam local invoke LandmarkAnalyzerFunction -e events/analyze-landmark-event.json
```

### 3. Monitor Logs
```bash
# View real-time logs
sam logs -n ImageProcessorFunction --stack-name lambdatrip --tail
sam logs -n LandmarkAnalyzerFunction --stack-name lambdatrip --tail
```

## 🔧 Configuration Options

### Environment Variables
The following environment variables are automatically set:
- `S3_BUCKET`: Auto-created S3 bucket for analysis results
- `GOOGLE_VISION_API_KEY`: Your Google Vision API key
- `GOOGLE_WEATHER_API_KEY`: Your weather API key

### Custom Configuration
To customize the deployment:

1. **Modify template.yaml**:
   ```yaml
   # Change timeout or memory
   Globals:
     Function:
       Timeout: 120  # Increase timeout
       MemorySize: 1024  # Increase memory
   ```

2. **Add custom parameters**:
   ```yaml
   Parameters:
     CustomParameter:
       Type: String
       Description: Your custom parameter
   ```

## 🔒 Security Considerations

### IAM Permissions
The deployment creates an IAM role with minimal required permissions:
- S3 read/write access to the analysis bucket
- Bedrock model invocation
- CloudWatch Logs

### API Key Security
- API keys are stored as CloudFormation parameters (encrypted)
- Keys are passed to Lambda as environment variables
- Consider using AWS Secrets Manager for production

### S3 Bucket Security
- Public access is blocked
- Lifecycle policy automatically deletes old files (30 days)
- Bucket name includes stack name and account ID for uniqueness

## 📊 Monitoring and Troubleshooting

### CloudWatch Metrics
Monitor these key metrics:
- Lambda invocation count and duration
- Error rates
- S3 bucket usage
- API Gateway requests

### Common Issues

#### 1. Google Vision API Errors
```bash
# Check API key validity
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://vision.googleapis.com/v1/images:annotate
```

#### 2. Bedrock Access Issues
```bash
# Verify Bedrock access in your region
aws bedrock list-foundation-models --region us-east-1
```

#### 3. S3 Permission Errors
```bash
# Check Lambda execution role
aws iam get-role --role-name lambdatrip-LambdaExecutionRole-XXXXXXXXX
```

### Debugging Commands
```bash
# View stack events
aws cloudformation describe-stack-events --stack-name lambdatrip

# Check Lambda function configuration
aws lambda get-function --function-name lambdatrip-ImageProcessorFunction-XXXXXXXXX

# Test API Gateway
aws apigateway get-rest-apis
```

## 🚀 Production Deployment

### 1. Environment Separation
```bash
# Create separate stacks for different environments
sam deploy --stack-name lambdatrip-dev --parameter-overrides Environment=dev
sam deploy --stack-name lambdatrip-prod --parameter-overrides Environment=prod
```

### 2. Custom Domain
```bash
# Add custom domain to API Gateway
aws apigateway create-domain-name \
  --domain-name api.yourdomain.com \
  --certificate-arn your-certificate-arn
```

### 3. Monitoring Setup
```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "LambdaTrip-ErrorRate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5
```

## 🧹 Cleanup

### Remove the Stack
```bash
# Delete the entire stack
aws cloudformation delete-stack --stack-name lambdatrip

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete --stack-name lambdatrip
```

### Manual Cleanup
If automatic cleanup fails:
```bash
# Delete S3 bucket contents
aws s3 rm s3://landmark-analysis-lambdatrip-XXXXXXXXX --recursive

# Delete S3 bucket
aws s3 rb s3://landmark-analysis-lambdatrip-XXXXXXXXX

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /aws/lambda/lambdatrip-ImageProcessorFunction-XXXXXXXXX
aws logs delete-log-group --log-group-name /aws/lambda/lambdatrip-LandmarkAnalyzerFunction-XXXXXXXXX
```

## 📈 Scaling Considerations

### Performance Optimization
- **Memory**: Increase Lambda memory for faster execution
- **Timeout**: Adjust based on API response times
- **Concurrency**: Set reserved concurrency for predictable performance

### Cost Optimization
- **S3 Lifecycle**: Automatic cleanup reduces storage costs
- **Lambda Optimization**: Right-size memory allocation
- **API Gateway**: Consider usage plans for high traffic

## 🔄 Updates and Maintenance

### Update Dependencies
```bash
# Update requirements.txt files
pip install --upgrade boto3 requests

# Redeploy
sam build && sam deploy
```

### Update Code
```bash
# Make code changes
git add .
git commit -m "Update landmark analysis logic"

# Deploy changes
sam build && sam deploy
```

### Rollback
```bash
# Rollback to previous version
aws cloudformation rollback-stack --stack-name lambdatrip
```

---

## 📞 Support

For issues with this deployment:
1. Check CloudWatch logs first
2. Verify API keys and permissions
3. Review CloudFormation stack events
4. Test locally with `sam local invoke`

Happy deploying! 🚀 