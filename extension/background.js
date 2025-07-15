// Background script for LambdaTrip Chrome Extension
const API_BASE_URL = 'https://tbj0hc15u4.execute-api.us-east-1.amazonaws.com/Stage';

// Firebase Auth with Offscreen Document
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

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

// Check if offscreen document exists
async function hasOffscreenDocument() {
  const matchedClients = await self.clients.matchAll();
  const found = matchedClients.some(
    (c) => c.url === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
  );
  return found;
}

// Create offscreen document if needed
async function setupOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: 'Needed for Firebase Auth popup'
    });
  }
}

// Close offscreen document
async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

// Send message to offscreen document and wait for response
async function getAuthFromOffscreen() {
  await setupOffscreenDocument();
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({action: 'getAuth', target: 'offscreen'}, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Check current auth state from storage
async function checkAuthStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user'], (result) => {
      if (result.user) {
        resolve({signedIn: true, user: result.user});
      } else {
        resolve({signedIn: false, user: null});
      }
    });
  });
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeImage') {
    // Handle the API call asynchronously
    analyzeLandmarkImage(request.imageUrl)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('LambdaTrip API Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  // Firebase Auth handlers
  if (request.type === 'firebase-signin') {
    getAuthFromOffscreen()
      .then(user => {
        // Store user data in Chrome storage
        chrome.storage.local.set({user: user}, () => {
          sendResponse({success: true, user: user});
        });
      })
      .catch(err => {
        console.error('Sign-in error:', err);
        sendResponse({success: false, error: err.message});
      });
    return true; // Indicates async response
  }
  
  if (request.type === 'firebase-signout') {
    // Remove user data from Chrome storage
    chrome.storage.local.remove('user', () => {
      sendResponse({success: true});
    });
    return true;
  }
  
  if (request.type === 'firebase-auth-state') {
    checkAuthStateFromStorage()
      .then(result => {
        sendResponse(result);
      })
      .catch(err => {
        console.error('Auth state check error:', err);
        sendResponse({signedIn: false, user: null});
      });
    return true;
  }
});

async function analyzeLandmarkImage(imageUrl) {
  try {
    
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
    
    return {
      imageAnalysis: imageData,
      aiAnalysis: analysisData
    };
    
  } catch (error) {
    console.error('LambdaTrip API Error:', error);
    throw error;
  }
} 