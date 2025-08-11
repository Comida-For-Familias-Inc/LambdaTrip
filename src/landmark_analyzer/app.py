import boto3
import json
import logging
import os
from datetime import datetime
import re

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize Bedrock client
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def lambda_handler(event, context):
    """
    Lambda function to analyze landmark data using Amazon Bedrock
    """
    try:
        # Initialize S3 client
        s3 = boto3.client('s3')
        
        # Get environment variables
        s3_bucket = os.environ.get('S3_BUCKET')
        
        # Extract analysis data from event
        if 'body' in event:
            # API Gateway sends body as a string, so we need to parse it
            if isinstance(event['body'], str):
                try:
                    body_data = json.loads(event['body'])
                    analysis_data = body_data.get('analysis_data', {})
                    s3_key = body_data.get('s3_key', '')
                except json.JSONDecodeError:
                    logger.error("Invalid JSON in request body")
                    raise ValueError("Invalid JSON in request body")
            else:
                # If body is already a dict (direct Lambda invocation)
                analysis_data = event['body'].get('analysis_data', {})
                s3_key = event['body'].get('s3_key', '')
        else:
            # Direct Lambda invocation without API Gateway
            analysis_data = event.get('analysis_data', {})
            s3_key = event.get('s3_key', '')
        
        # If no analysis data in event, try to get from S3
        if not analysis_data and s3_key:
            try:
                s3_response = s3.get_object(Bucket=s3_bucket, Key=s3_key)
                analysis_data = json.loads(s3_response['Body'].read())
                logger.info(f"Retrieved analysis data from S3: {s3_key}")
            except Exception as e:
                logger.error(f"Error retrieving data from S3: {str(e)}")
                return {
                    "statusCode": 500,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({
                        "error": f"Failed to retrieve analysis data: {str(e)}",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                }
        
        if not analysis_data:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({
                    "error": "No analysis data provided",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
        
        logger.info(f"Analyzing landmark: {analysis_data.get('landmark', {}).get('name', 'Unknown')}")
        
        # Step 1: Generate comprehensive travel analysis using Bedrock
        travel_analysis = analyze_with_bedrock(analysis_data)
        
        # Step 2: Generate travel recommendations
        recommendations = generate_recommendations(analysis_data, travel_analysis)
        
        # Step 3: Create final response
        final_result = {
            "landmark": analysis_data.get('landmark', {}),
            "weather": analysis_data.get('weather', {}),
            "country_info": analysis_data.get('country_info', {}),
            "travel_advisory": travel_analysis.get('travel_advisory', {}),
            "analysis": travel_analysis,
            "recommendations": recommendations,
            "image_url": analysis_data.get('image_url', ''),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Step 4: Store final result in S3
        final_result_key = f"landmark_analysis/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_final.json"
        
        # Skip S3 operations in local/development environment
        environment = os.getenv('ENVIRONMENT')
        if environment == 'local':
            logger.info(f"Environment: {environment} - skipping S3 upload. Would store at: s3://{s3_bucket}/{final_result_key}")
        else:
            s3.put_object(
                Bucket=s3_bucket,
                Key=final_result_key,
                Body=json.dumps(final_result, indent=2),
                ContentType='application/json'
            )
            logger.info(f"Final analysis stored at s3://{s3_bucket}/{final_result_key}")
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "landmark_name": analysis_data.get('landmark', {}).get('name', 'Unknown'),
                "analysis": travel_analysis,
                "recommendations": recommendations,
                "s3_key": final_result_key,
                "timestamp": datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in landmark analysis: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
        }

def analyze_with_bedrock(analysis_data):
    """
    Use Amazon Bedrock to analyze landmark and travel data
    """
    try:
        # Prepare the prompt for Bedrock
        prompt = create_analysis_prompt(analysis_data)
        
        # Use Claude 3 Haiku for analysis (more commonly available)
        model_id = "anthropic.claude-3-haiku-20240307-v1:0"
        
        # Alternative models if the above doesn't work:
        # model_id = "anthropic.claude-instant-v1"
        # model_id = "amazon.titan-text-express-v1"
        
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "system": "Respond with only valid JSON. No code fences, no explanations, no trailing commas.",
            "max_tokens": 3000,
            "messages": [
                { "role": "user", "content": prompt }
            ]
        }
        
        response = bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        analysis_text = response_body['content'][0]['text']
        
        # Parse the analysis into structured format
        structured_analysis = parse_bedrock_response(analysis_text)
        
        return structured_analysis
        
    except Exception as e:
        logger.error(f"Error calling Bedrock: {str(e)}")
        return {
            "summary": "Unable to generate AI analysis due to technical issues",
            "insights": [],
            "travel_tips": [],
            "best_visit_time": "Check weather data for optimal timing",
            "safety_rating": "3 - Moderate",
            "cultural_highlights": "See country information for cultural context",
            "travel_advisory": {
                "level": "Exercise normal precautions",
                "summary": "Travel advisory information unavailable due to technical issues",
                "recommendations": []
            }
        }

def create_analysis_prompt(analysis_data):
    """
    Create a comprehensive prompt for Bedrock analysis
    """
    landmark = analysis_data.get('landmark', {})
    weather = analysis_data.get('weather', {})
    country_info = analysis_data.get('country_info', {})
    
    prompt = f"""
You are a travel expert analyzing a landmark for a traveler. Please provide a comprehensive analysis based on the following data:

**LANDMARK INFORMATION:**
- Name: {landmark.get('name', 'Unknown')}
- Description: {landmark.get('description', 'No description available')}
- Confidence: {landmark.get('confidence', 0)}
- Location: {landmark.get('location', {})}

**WEATHER INFORMATION:**
{json.dumps(weather, indent=2) if weather else 'No weather data available'}

**COUNTRY INFORMATION:**
{json.dumps(country_info, indent=2) if country_info else 'No country data available'}

Please provide your analysis in the following JSON format:

{{
    "summary": "A brief 2-3 sentence summary of the landmark and its significance",
    "insights": [
        "Key insight about the landmark",
        "Cultural or historical significance",
        "Best time to visit based on weather",
        "Travel considerations based on country info"
    ],
    "travel_tips": [
        "Practical travel tip 1",
        "Practical travel tip 2",
        "Safety consideration if applicable",
        "Cultural etiquette tip if applicable"
    ],
    "best_visit_time": "Recommendation for best time to visit",
    "safety_rating": "1-5 rating with brief explanation",
    "cultural_highlights": "Key cultural aspects to know about",
    "travel_advisory": {{
        "level": "Travel safety level (e.g., Exercise normal precautions, Exercise increased caution, etc.)",
        "summary": "Brief travel safety summary for the country",
        "recommendations": ["Safety recommendation 1", "Safety recommendation 2"]
    }}
}}

Focus on providing actionable, practical advice for travelers. Consider weather conditions, cultural context, and safety information in your recommendations. Generate appropriate travel advisory information based on the country and current global conditions.
"""
    
    return prompt


def parse_bedrock_response(response_text):
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", response_text.strip(), flags=re.IGNORECASE|re.MULTILINE)
        # Remove trailing commas in objects/arrays
        cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
        # Normalize smart quotes
        cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")

        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_str = cleaned[start_idx:end_idx]
            return json.loads(json_str)
    except Exception:
        pass

    return {
        "summary": response_text[:200] + "..." if len(response_text) > 200 else response_text,
        "insights": ["Analysis completed successfully"],
        "travel_tips": ["Review the full analysis for detailed recommendations"],
        "best_visit_time": "Check weather data for optimal timing",
        "safety_rating": "3 - Moderate",
        "cultural_highlights": "See country information for cultural context",
        "travel_advisory": {"level": "Exercise normal precautions", "summary": "Travel advisory information unavailable", "recommendations": []}
    }

def generate_recommendations(analysis_data, travel_analysis):
    """
    Generate specific travel recommendations based on the analysis
    """
    recommendations = {
        "packing_tips": [],
        "timing_recommendations": [],
        "cultural_notes": [],
        "safety_advice": []
    }
    
    # Weather-based recommendations
    weather = analysis_data.get('weather', {})
    if weather:
        temp = weather.get('temperature', {})
        if temp:
            current_temp = temp.get('current', 0)
            if current_temp < 10:
                recommendations["packing_tips"].append("Pack warm clothing - temperatures are cold")
            elif current_temp > 25:
                recommendations["packing_tips"].append("Pack light clothing - temperatures are warm")
        
        conditions = weather.get('conditions', '')
        if 'rain' in conditions.lower():
            recommendations["packing_tips"].append("Bring rain gear - precipitation expected")
        elif 'sunny' in conditions.lower():
            recommendations["packing_tips"].append("Don't forget sunscreen and hat")
    
    # Country-based recommendations
    country_info = analysis_data.get('country_info', {})
    if country_info:
        currency = country_info.get('currencies', [{}])[0].get('name', '')
        if currency:
            recommendations["cultural_notes"].append(f"Local currency: {currency}")
        
        languages = country_info.get('languages', {})
        if languages:
            primary_language = list(languages.keys())[0] if languages else "English"
            recommendations["cultural_notes"].append(f"Primary language: {primary_language}")
    
    # Travel advisory recommendations from Bedrock analysis
    travel_advisory = travel_analysis.get('travel_advisory', {})
    if travel_advisory:
        level = travel_advisory.get('level', '')
        if any(keyword in level.lower() for keyword in ['increased caution', 'reconsider travel', 'do not travel']):
            recommendations["safety_advice"].append(f"Travel advisory level: {level}")
        
        advisory_recommendations = travel_advisory.get('recommendations', [])
        if advisory_recommendations:
            recommendations["safety_advice"].extend(advisory_recommendations[:2])  # Add first 2 recommendations
    
    # Timing recommendations from analysis
    if travel_analysis.get('best_visit_time'):
        recommendations["timing_recommendations"].append(travel_analysis['best_visit_time'])
    
    return recommendations 