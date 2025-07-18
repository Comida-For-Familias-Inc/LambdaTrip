// DOM elements
const signInButton = document.getElementById('google-signin');
const signOutButton = document.getElementById('google-signout');
const userInfo = document.getElementById('user-info');
const usageInfo = document.getElementById('usage-info');
const upgradeButton = document.getElementById('upgrade-button');
const usageCountSection = document.getElementById('usage-count');
const usageCountValue = document.getElementById('usage-count-value');
const refreshSubscriptionButton = document.getElementById('refresh-subscription');

const USAGE_QUOTA = 30; // Example quota, change as needed
const SUBSCRIPTION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Check authentication state via background script
function checkAuthState() {
  chrome.runtime.sendMessage({ type: 'firebase-auth-state' }, (response) => {
    if (response && response.signedIn && response.user) {
      updateUIForSignedInUser(response.user);
      // Check cached subscription status first, then refresh if needed
      checkCachedSubscriptionStatus(response.user.uid);
    } else {
      updateUIForSignedOutUser();
    }
  });
}

// Check cached subscription status with smart refresh
function checkCachedSubscriptionStatus(userId) {
  chrome.storage.local.get(['subscriptionCache', 'lastSubscriptionCheck'], (result) => {
    const now = Date.now();
    const lastCheck = result.lastSubscriptionCheck || 0;
    const cachedSubscription = result.subscriptionCache;
    
    // If cache is fresh (less than 5 minutes old), use it
    if (cachedSubscription && (now - lastCheck) < SUBSCRIPTION_CACHE_DURATION) {
      console.log('Using cached subscription status');
      if (cachedSubscription.isPremium) {
        updateUIForPremiumUser();
      } else {
        updateUIForFreeUser();
      }
    } else {
      // Cache is stale or doesn't exist, refresh from Firestore
      console.log('Refreshing subscription status from Firestore');
      refreshSubscriptionStatus(userId);
    }
  });
}

// Refresh subscription status from Firestore
function refreshSubscriptionStatus(userId) {
  chrome.runtime.sendMessage({ 
    type: 'check-firestore-subscription', 
    userId: userId 
  }, (response) => {
    if (response && !response.error) {
      // Cache the result
      const cacheData = {
        subscriptionCache: response,
        lastSubscriptionCheck: Date.now()
      };
      chrome.storage.local.set(cacheData);
      
      // Update UI
      if (response.isPremium) {
        updateUIForPremiumUser();
      } else {
        updateUIForFreeUser();
      }
    } else {
      console.error('Error refreshing subscription:', response?.error);
      // Fall back to cached data if available
      chrome.storage.local.get(['subscriptionCache'], (result) => {
        if (result.subscriptionCache) {
          if (result.subscriptionCache.isPremium) {
            updateUIForPremiumUser();
          } else {
            updateUIForFreeUser();
          }
        } else {
          updateUIForFreeUser();
        }
      });
    }
  });
}

// Force refresh subscription status (for testing or manual refresh)
function forceRefreshSubscription(userId) {
  chrome.storage.local.remove(['subscriptionCache', 'lastSubscriptionCheck'], () => {
    refreshSubscriptionStatus(userId);
  });
}

// Check subscription status from background script (legacy)
function checkSubscriptionStatus() {
  chrome.runtime.sendMessage({ type: 'check-subscription-status' }, (response) => {
    if (response && response.isPremium) {
      updateUIForPremiumUser();
    } else {
      updateUIForFreeUser();
    }
  });
}

// Update UI for premium user
function updateUIForPremiumUser() {
  if (usageInfo) {
    usageInfo.innerHTML = `
      <div class="premium-status">
        <div class="premium-text">⭐ Premium Member</div>
        <div class="premium-subtitle">Unlimited landmark analysis</div>
      </div>
    `;
  }
  
  if (usageCountSection) {
    usageCountSection.style.display = 'none';
  }
  
  if (upgradeButton) {
    upgradeButton.style.display = 'none';
  }
  
  // Show refresh button for signed-in users
  if (refreshSubscriptionButton) {
    refreshSubscriptionButton.style.display = 'block';
  }
}

// Update UI for free user
function updateUIForFreeUser() {
  if (usageInfo) {
    usageInfo.innerHTML = `
      <div class="usage-limit">
        <div class="usage-text">Free Plan</div>
        <div class="usage-subtitle">Limited to ${USAGE_QUOTA} analyses per month</div>
      </div>
    `;
  }
  
  if (usageCountSection) {
    usageCountSection.style.display = 'block';
  }
  
  if (upgradeButton) {
    upgradeButton.style.display = 'block';
  }
  
  // Show refresh button for signed-in users
  if (refreshSubscriptionButton) {
    refreshSubscriptionButton.style.display = 'block';
  }
  
  fetchUsageCount();
}

// Fetch usage count from storage
function fetchUsageCount() {
  chrome.storage.local.get(['usageCount'], (result) => {
    const count = result.usageCount || 0;
    if (usageCountValue) {
      usageCountValue.textContent = count;
    }
    
    // Show warning if approaching limit
    if (count >= USAGE_QUOTA * 0.8) {
      if (usageCountSection) {
        usageCountSection.classList.add('warning');
      }
    }
  });
}

// Update UI for signed-in user
function updateUIForSignedInUser(user) {
  if (signInButton) signInButton.style.display = 'none';
  const signOutButton = document.getElementById('google-signout');
  if (signOutButton) signOutButton.classList.remove('hidden');
  
  if (userInfo) {
    // Create user avatar with initials
    const initials = user.displayName ? 
      user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) :
      user.email.split('@')[0].slice(0, 2).toUpperCase();
    
    // Check if user is premium from cached data
    chrome.storage.local.get(['subscriptionCache'], (result) => {
      const isPremium = result.subscriptionCache && result.subscriptionCache.isPremium;
      const premiumBadge = isPremium ? '<span class="premium-badge">⭐ Premium</span>' : '';
      
      userInfo.innerHTML = `
        <div class="user-avatar">${initials}</div>
        <div class="user-email">${user.email}</div>
        <div class="user-welcome">Welcome back! ${premiumBadge}</div>
      `;
    });
  }
}

// Update UI for signed-out user
function updateUIForSignedOutUser() {
  if (signInButton) signInButton.style.display = 'block';
  const signOutButton = document.getElementById('google-signout');
  if (signOutButton) signOutButton.classList.add('hidden');
  
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="signin-prompt">
        <div class="signin-text">Sign in to access your features</div>
        <div class="signin-subtitle">Track usage and upgrade to premium</div>
      </div>
    `;
  }
  
  if (usageInfo) {
    usageInfo.innerHTML = `
      <div class="usage-limit">
        <div class="usage-text">Free Plan</div>
        <div class="usage-subtitle">Limited to ${USAGE_QUOTA} analyses per month</div>
      </div>
    `;
  }
  
  if (usageCountSection) {
    usageCountSection.style.display = 'block';
  }
  
  if (upgradeButton) {
    upgradeButton.style.display = 'block';
  }
  
  // Hide refresh button for signed-out users
  if (refreshSubscriptionButton) {
    refreshSubscriptionButton.style.display = 'none';
  }
  
  fetchUsageCount();
}

// Handle sign-in button click
if (signInButton) {
  signInButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'firebase-signin' }, (response) => {
      if (response && response.success) {
        updateUIForSignedInUser(response.user);
        // Check cached subscription after sign-in
        if (response.user.uid) {
          checkCachedSubscriptionStatus(response.user.uid);
        }
      } else {
        console.error('Sign-in failed:', response?.error);
      }
    });
  });
}

// Handle sign-out button click
if (signOutButton) {
  signOutButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'firebase-signout' }, (response) => {
      if (response && response.success) {
        // Clear subscription cache on sign-out
        chrome.storage.local.remove(['subscriptionCache', 'lastSubscriptionCheck'], () => {
          updateUIForSignedOutUser();
        });
      }
    });
  });
}

// Handle upgrade button click
if (upgradeButton) {
  upgradeButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://lambdatrip.firebaseapp.com/payment' });
  });
}

// Handle refresh subscription button click
if (refreshSubscriptionButton) {
  refreshSubscriptionButton.addEventListener('click', () => {
    chrome.storage.local.get(['user'], (result) => {
      if (result.user && result.user.uid) {
        // Show loading state
        refreshSubscriptionButton.innerHTML = `
          <svg class="feature-icon" viewBox="0 0 20 20" fill="currentColor" style="width: 14px; height: 14px;">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
          </svg>
          Refreshing...
        `;
        refreshSubscriptionButton.disabled = true;
        
        forceRefreshSubscription(result.user.uid);
        
        // Reset button after a short delay
        setTimeout(() => {
          refreshSubscriptionButton.innerHTML = `
            <svg class="feature-icon" viewBox="0 0 20 20" fill="currentColor" style="width: 14px; height: 14px;">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
            Refresh Status
          `;
          refreshSubscriptionButton.disabled = false;
        }, 2000);
      }
    });
  });
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'auth-state-changed') {
    if (request.user) {
      updateUIForSignedInUser(request.user);
      // Check cached subscription when auth state changes
      if (request.user.uid) {
        checkCachedSubscriptionStatus(request.user.uid);
      }
    } else {
      updateUIForSignedOutUser();
    }
  }
  
  if (request.type === 'subscription-status-changed') {
    if (request.isPremium) {
      updateUIForPremiumUser();
    } else {
      updateUIForFreeUser();
    }
  }
  
  // Handle manual refresh request
  if (request.type === 'refresh-subscription') {
    chrome.storage.local.get(['user'], (result) => {
      if (result.user && result.user.uid) {
        forceRefreshSubscription(result.user.uid);
      }
    });
  }
}); 