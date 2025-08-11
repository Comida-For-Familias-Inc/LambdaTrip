// Background script for LambdaTrip Chrome Extension
const API_BASE_URL = 'https://tbj0hc15u4.execute-api.us-east-1.amazonaws.com/Stage';

// Firebase Auth with Offscreen Document
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Usage limit configuration
const USAGE_LIMIT = 30; // Monthly limit for free users
const USAGE_WARNING_THRESHOLD = 0.8; // Show warning at 80% of limit

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] Extension installed/updated, creating context menu');
  
  chrome.contextMenus.create({
    id: 'analyzeLandmark',
    title: 'Analyze Landmark with LambdaTrip',
    contexts: ['image']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[background] Error creating context menu:', chrome.runtime.lastError);
    } else {
      console.log('[background] Context menu created successfully');
    }
  });
});

// Also create context menu on startup (in case onInstalled doesn't fire)
chrome.runtime.onStartup.addListener(() => {
  console.log('[background] Extension started, ensuring context menu exists');
  
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'analyzeLandmark',
      title: 'Analyze Landmark with LambdaTrip',
      contexts: ['image']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[background] Error creating context menu on startup:', chrome.runtime.lastError);
      } else {
        console.log('[background] Context menu created successfully on startup');
      }
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('[background] Context menu clicked:', info.menuItemId);
  console.log('[background] Tab info:', tab);
  console.log('[background] Image URL:', info.srcUrl);
  
  if (info.menuItemId === 'analyzeLandmark') {
    console.log('[background] Processing analyzeLandmark request');
    
    // Check if tab is still valid
    if (!tab || !tab.id) {
      console.error('[background] Invalid tab for context menu click');
      return;
    }
    
    // Proceed directly with usage check and analysis
    checkUsageLimit().then((usageInfo) => {
      console.log('[background] Usage info:', usageInfo);
      
      if (usageInfo.canProceed) {
        console.log('[background] Sending analyzeImage message to tab:', tab.id);
        sendMessageWithInjection(tab.id, {
          action: 'analyzeImage_click',
          imageUrl: info.srcUrl,
          usageInfo: usageInfo
        }).then(() => {
          console.log('[background] Message sent successfully to tab');
        }).catch(err => {
          console.error('[background] Error sending message to tab:', err);
          // Fallback: direct analysis
          analyzeLandmarkImage(info.srcUrl).then(result => {
            console.log('[background] Direct analysis result:', result);
          }).catch(error => {
            console.error('[background] Direct analysis failed:', error);
          });
        });
      } else {
        console.log('[background] Usage limit reached, showing limit message');
        // Show blocking message
        sendMessageWithInjection(tab.id, {
          action: 'showUsageLimit',
          usageInfo: usageInfo
        }).then(() => {
          console.log('[background] Usage limit message sent successfully');
        }).catch(err => {
          console.error('[background] Error sending usage limit message:', err);
        });
      }
    }).catch(error => {
      console.error('[background] Error checking usage limit:', error);
      // Proceed anyway if usage check fails
      console.log('[background] Proceeding with analysis despite usage check error');
      sendMessageWithInjection(tab.id, {
        action: 'analyzeImage_click',
        imageUrl: info.srcUrl,
        usageInfo: { canProceed: true, isPremium: false }
      }).catch(err => {
        console.error('[background] Error sending message to tab after usage check failure:', err);
      });
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
  console.log('[background] Received message:', request);
  
  // Handle content script logs
  if (request.type === 'log') {
    console.log('[Content script log]', request.message);
    return;
  }
  
  // Handle content script ready signal
  if (request.action === 'contentScriptReady') {
    console.log('[background] Content script ready on:', request.url);
    sendResponse({ status: 'acknowledged' });
    return;
  }
  
  if (request.action === 'analyzeImage_content') {
    console.log('[background] Processing analyzeImage request for:', request.imageUrl);
    
    // Handle the API call asynchronously
    analyzeLandmarkImage(request.imageUrl)
      .then(result => {
        console.log('[background] API call successful, sending response to content script');
        console.log('[background] Response data:', result);
        sendResponse({ success: true, data: result });
        console.log('[background] Response sent successfully');
      })
      .catch(error => {
        console.error('[background] API call failed:', error);
        console.log('[background] Sending error response to content script');
        sendResponse({ success: false, error: error.message });
        console.log('[background] Error response sent successfully');
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
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
  
  // Usage limit check
  if (request.type === 'check-usage-limit') {
    checkUsageLimit()
      .then(usageInfo => {
        sendResponse(usageInfo);
      })
      .catch(err => {
        console.error('Usage limit check error:', err);
        sendResponse({canProceed: false, error: err.message});
      });
    return true;
  }
  
  // Reset usage (for testing purposes)
  if (request.type === 'reset-usage') {
    chrome.storage.local.remove(['usageData'], () => {
      sendResponse({success: true});
    });
    return true;
  }
});

// API call function
async function analyzeLandmarkImage(imageUrl) {
  try {
    console.log('[background] Starting analyzeLandmarkImage for:', imageUrl);
    
    // First API call to analyze the image
    console.log('[background] Making first API call to /analyze-image');
    const imageResponse = await fetch(`${API_BASE_URL}/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl
      })
    });

    console.log('[background] First API response status:', imageResponse.status);
    console.log('[background] First API response ok:', imageResponse.ok);

    if (!imageResponse.ok) {
      throw new Error(`Image analysis failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();  
    console.log('[background] First API response data:', imageData);
    
    // Second API call to get landmark analysis
    console.log('[background] Making second API call to /analyze-landmark');
    const landmarkResponse = await fetch(`${API_BASE_URL}/analyze-landmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysis_data: imageData.analysis_data
      })
    });

    console.log('[background] Second API response status:', landmarkResponse.status);
    console.log('[background] Second API response ok:', landmarkResponse.ok);

    if (!landmarkResponse.ok) {
      throw new Error(`Landmark analysis failed: ${landmarkResponse.status}`);
    }

    const landmarkData = await landmarkResponse.json();
    console.log('[background] Second API response data:', landmarkData);
    
    // Increment usage count
    console.log('[background] Incrementing usage count');
    await incrementUsage();

    console.log('[background] analyzeLandmarkImage completed successfully');
    
    // Return data in the structure expected by content script
    return {
      imageAnalysis: {
        landmark_detected: imageData.landmark_detected,
        analysis_data: imageData.analysis_data
      },
      aiAnalysis: {
        analysis: landmarkData.analysis,
        recommendations: landmarkData.recommendations
      }
    };
  } catch (error) {
    console.error('[background] Image analysis error:', error);
    console.error('[background] Error stack:', error.stack);
    throw error;
  }
} 

// Check usage limit and return usage information
async function checkUsageLimit() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user', 'usageData'], (result) => {
      const user = result.user;
      const usageData = result.usageData || { count: 0, month: null };
      
      // Check if user is premium
      const isPremium = user && user.firestoreStatus && user.firestoreStatus.isPremium;
      
      if (isPremium) {
        resolve({
          canProceed: true,
          isPremium: true,
          currentUsage: 0,
          limit: 'unlimited',
          warning: false
        });
        return;
      }
      
      // Check if we need to reset monthly usage
      const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
      if (usageData.month !== currentMonth) {
        // Reset usage for new month
        usageData.count = 0;
        usageData.month = currentMonth;
        chrome.storage.local.set({ usageData: usageData });
      }
      
      const currentUsage = usageData.count;
      const canProceed = currentUsage < USAGE_LIMIT;
      const warning = currentUsage >= Math.floor(USAGE_LIMIT * USAGE_WARNING_THRESHOLD);
      
      resolve({
        canProceed: canProceed,
        isPremium: false,
        currentUsage: currentUsage,
        limit: USAGE_LIMIT,
        warning: warning,
        remaining: USAGE_LIMIT - currentUsage
      });
    });
  });
}

// Increment usage count
async function incrementUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user', 'usageData'], (result) => {
      const user = result.user;
      const usageData = result.usageData || { count: 0, month: null };
      
      // Don't increment for premium users
      if (user && user.firestoreStatus && user.firestoreStatus.isPremium) {
        resolve();
        return;
      }
      
      // Check if we need to reset monthly usage
      const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
      if (usageData.month !== currentMonth) {
        usageData.count = 0;
        usageData.month = currentMonth;
      }
      
      usageData.count++;
      chrome.storage.local.set({ usageData: usageData }, () => {
        // Broadcast usage update
        chrome.runtime.sendMessage({ type: 'usage-updated', usageData: usageData });
        resolve();
      });
    });
  });
} 

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function sendMessageWithInjection(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (String(err?.message || '').includes('asynchronous response')) {
      // The listener returned true but didn’t call sendResponse; message still delivered.
      console.warn('[background] Ignoring benign async-response error.');
      return; // treat as success; do not inject/retry
    }
    // Real failure: inject then retry
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(()=>{});
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['styles.css'] }).catch(()=>{});
    await new Promise(r => setTimeout(r, 100));
    return chrome.tabs.sendMessage(tabId, message);
  }
} 