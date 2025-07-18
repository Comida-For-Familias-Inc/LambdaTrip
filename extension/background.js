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
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeImage',
      imageUrl: info.srcUrl
    });
  }
});

// Firebase Auth functions
async function getAuthFromOffscreen() {
  return new Promise((resolve, reject) => {
    // Create offscreen document if it doesn't exist
    chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['AUTH'],
      justification: 'Firebase Auth requires an offscreen document'
    }).then(() => {
      // Send message to offscreen document
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'firebase-signin'
      }).then(response => {
        if (response && response.user) {
          resolve(response.user);
        } else {
          reject(new Error('Sign-in failed'));
        }
      }).catch(reject);
    }).catch(reject);
  });
}

async function checkAuthStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user'], (result) => {
      if (result.user) {
        resolve({ signedIn: true, user: result.user });
      } else {
        resolve({ signedIn: false, user: null });
      }
    });
  });
}

// Check subscription status from storage
async function checkSubscriptionStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user', 'subscriptionCache'], (result) => {
      if (result.user && result.subscriptionCache) {
        resolve({
          isPremium: result.subscriptionCache.isPremium, 
          firestoreStatus: result.subscriptionCache
        });
      } else {
        resolve({isPremium: false, firestoreStatus: null});
      }
    });
  });
}

// Check Firestore subscription status directly
async function checkFirestoreSubscriptionDirect(userId) {
  return new Promise((resolve) => {
    // Use the offscreen document to check Firestore
    chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['AUTH'],
      justification: 'Firebase Firestore requires an offscreen document'
    }).then(() => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'check-firestore-subscription',
        userId: userId
      }).then(response => {
        resolve(response);
      }).catch(error => {
        console.error('Firestore check error:', error);
        resolve({isPremium: false, error: error.message});
      });
    }).catch(error => {
      console.error('Offscreen document error:', error);
      resolve({isPremium: false, error: error.message});
    });
  });
}

// Clear subscription cache
function clearSubscriptionCache() {
  chrome.storage.local.remove(['subscriptionCache', 'lastSubscriptionCheck'], () => {
    console.log('Subscription cache cleared');
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
    // Remove user data and subscription cache from Chrome storage
    chrome.storage.local.remove(['user', 'subscriptionCache', 'lastSubscriptionCheck'], () => {
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
  
  // Subscription status check
  if (request.type === 'check-subscription-status') {
    checkSubscriptionStatus()
      .then(result => {
        sendResponse(result);
      })
      .catch(err => {
        console.error('Subscription status check error:', err);
        sendResponse({isPremium: false, firestoreStatus: null});
      });
    return true;
  }
  
  // Direct Firestore subscription check
  if (request.type === 'check-firestore-subscription') {
    checkFirestoreSubscriptionDirect(request.userId)
      .then(result => {
        sendResponse(result);
      })
      .catch(err => {
        console.error('Direct Firestore check error:', err);
        sendResponse({isPremium: false, error: err.message});
      });
    return true;
  }
  
  // Clear subscription cache
  if (request.type === 'clear-subscription-cache') {
    clearSubscriptionCache();
    sendResponse({success: true});
    return true;
  }
});

// API call function
async function analyzeLandmarkImage(imageUrl) {
  try {
    // First API call to analyze the image
    const imageResponse = await fetch(`${API_BASE_URL}/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl
      })
    });

    if (!imageResponse.ok) {
      throw new Error(`Image analysis failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    
    // Second API call to get landmark analysis
    const landmarkResponse = await fetch(`${API_BASE_URL}/analyze-landmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis_data: imageData
      })
    });

    if (!landmarkResponse.ok) {
      throw new Error(`Landmark analysis failed: ${landmarkResponse.status}`);
    }

    const landmarkData = await landmarkResponse.json();
    
    // Increment usage count for free users
    chrome.storage.local.get(['user', 'usageCount', 'subscriptionCache'], (result) => {
      const user = result.user;
      const currentCount = result.usageCount || 0;
      const isPremium = result.subscriptionCache && result.subscriptionCache.isPremium;
      
      // Only increment if user is not premium
      if (!user || !isPremium) {
        chrome.storage.local.set({ usageCount: currentCount + 1 });
      }
    });

    return landmarkData;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
} 