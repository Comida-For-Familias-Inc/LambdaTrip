// Background script for LambdaTrip Chrome Extension
const API_BASE_URL = 'https://tbj0hc15u4.execute-api.us-east-1.amazonaws.com/Stage';

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyzeLandmark',
    title: 'Analyze Landmark with LambdaTrip',
    contexts: ['image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'analyzeLandmark') {
    const imageUrl = info.srcUrl;
    
    // Send message to content script to show modal
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeImage',
      imageUrl: imageUrl
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.action === 'analyzeImage') {
    // Handle the API call asynchronously
    analyzeLandmarkImage(request.imageUrl)
      .then(result => {
        console.log('Analysis completed successfully:', result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('LambdaTrip API Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

async function analyzeLandmarkImage(imageUrl) {
  try {
    console.log('Starting analysis for:', imageUrl);
    
    // Step 1: Analyze image with ImageProcessorFunction
    const imageResponse = await fetch(`${API_BASE_URL}/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: imageUrl })
    });

    if (!imageResponse.ok) {
      throw new Error(`Image analysis failed: ${imageResponse.status} - ${imageResponse.statusText}`);
    }

    const imageData = await imageResponse.json();
    console.log('Image analysis completed:', imageData);
    
    // Step 2: Get AI analysis with LandmarkAnalyzerFunction
    const analysisResponse = await fetch(`${API_BASE_URL}/analyze-landmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        analysis_data: imageData.analysis_data 
      })
    });

    if (!analysisResponse.ok) {
      throw new Error(`AI analysis failed: ${analysisResponse.status} - ${analysisResponse.statusText}`);
    }

    const analysisData = await analysisResponse.json();
    console.log('AI analysis completed:', analysisData);
    
    return {
      imageAnalysis: imageData,
      aiAnalysis: analysisData
    };
    
  } catch (error) {
    console.error('LambdaTrip API Error:', error);
    throw error;
  }
} 