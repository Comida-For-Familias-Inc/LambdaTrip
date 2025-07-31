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
  console.log('[background] getAuthFromOffscreen called');
  return new Promise(async (resolve, reject) => {
    try {
      // Use the new check here
      const hasDocument = await chrome.offscreen.hasDocument();
      if (!hasDocument) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: ['IFRAME_SCRIPTING'],
          justification: 'Firebase Auth requires an offscreen document'
        });
        console.log('[background] Offscreen document created');
      } else {
        console.log('[background] Offscreen document already exists');
      }
      // Send message to offscreen document
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'firebase-signin-bg'
      }).then(response => {
        console.log('[background] Received response from offscreen for firebase-signin:', response);
        if (response && response.user) {
          resolve(response.user);
        } else {
          console.error('[background] No user returned from offscreen sign-in response:', response);
          reject(new Error('Sign-in failed'));
        }
      }).catch(err => {
        console.error('[background] Error sending message to offscreen:', err);
        reject(err);
      });
    } catch (err) {
      console.error('[background] Error creating offscreen document:', err);
      reject(err);
    }
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
    chrome.storage.local.get(['user'], (result) => {
      if (result.user && result.user.firestoreStatus) {
        resolve({
          isPremium: result.user.firestoreStatus.isPremium, 
          firestoreStatus: result.user.firestoreStatus
        });
      } else {
        resolve({isPremium: false, firestoreStatus: null});
      }
    });
  });
}

// Check Firestore subscription status directly
async function checkFirestoreSubscriptionDirect(userId) {
  return new Promise(async (resolve) => {
    try {
      // Check if offscreen document already exists
      const hasDocument = await chrome.offscreen.hasDocument();
      if (!hasDocument) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: ['IFRAME_SCRIPTING'],
          justification: 'Firebase Firestore requires an offscreen document'
        });
        console.log('[background] Offscreen document created for Firestore subscription check');
      } else {
        console.log('[background] Offscreen document already exists for Firestore subscription check');
      }
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'check-firestore-subscription-bg',
        userId: userId
      }).then(response => {
        resolve(response);
      }).catch(error => {
        console.error('Firestore check error:', error);
        resolve({isPremium: false, error: error.message});
      });
    } catch (error) {
      console.error('Offscreen document error:', error);
      resolve({isPremium: false, error: error.message});
    }
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
  if (request.target !== 'background') {
    return; // Exit early, don't process this message
  }
  // Firebase Auth handlers
  if (request.type === 'firebase-signin-popup') {
    console.log('[background] Received firebase-signin request');
    getAuthFromOffscreen()
      .then(user => {
        console.log('[background] getAuthFromOffscreen result:', user);
        if (user && user.uid) {
          // Store user data in Chrome storage
          chrome.storage.local.set({user: user}, () => {
            console.log('[background] User stored in chrome.storage.local:', user);
            sendResponse({success: true, user: user});
            // Broadcast auth state changed
            chrome.runtime.sendMessage({ type: 'auth-state-changed', user: user });
          });
        } else {
          console.error('[background] No user returned from sign-in.');
          sendResponse({success: false, error: 'No user returned from sign-in.'});
        }
      })
      .catch(err => {
        console.error('[background] Sign-in error:', err);
        sendResponse({success: false, error: err.message});
      });
    return true; // Indicates async response
  }
  
  if (request.type === 'firebase-signout-popup') {
    console.log('[background] Received firebase-signout request');
    // First, call Firebase Auth signOut via offscreen document
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'firebase-signout-bg'
    }).then(() => {
      // Then remove user data from Chrome storage
      chrome.storage.local.remove(['user', 'lastSubscriptionCheck'], () => {
        console.log('[background] User removed from chrome.storage.local');
        sendResponse({success: true});
        // Broadcast auth state changed
        chrome.runtime.sendMessage({ type: 'auth-state-changed', user: null });
      });
    }).catch(err => {
      console.error('[background] Firebase signOut error:', err);
      // Still remove local data even if Firebase signOut fails
      chrome.storage.local.remove(['user', 'lastSubscriptionCheck'], () => {
        sendResponse({success: true});
        chrome.runtime.sendMessage({ type: 'auth-state-changed', user: null });
      });
    });
    return true;
  }
  
  if (request.type === 'firebase-auth-state-popup') {
    console.log('[background] Received firebase-auth-state request');
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
    // This function is no longer needed as subscription info is in user object.
    // Keeping the structure for now, but it will do nothing.
    console.log('clear-subscription-cache request received, but no cache to clear.');
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
    chrome.storage.local.get(['user', 'usageCount'], (result) => {
      const user = result.user;
      const currentCount = result.usageCount || 0;
      
      // Only increment if user is not premium
      if (!user || !user.firestoreStatus || !user.firestoreStatus.isPremium) {
        chrome.storage.local.set({ usageCount: currentCount + 1 });
      }
    });

    return landmarkData;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
} 