// DOM elements
const signInButton = document.getElementById('google-signin');
const signOutButton = document.getElementById('google-signout');
const userInfo = document.getElementById('user-info');
const usageInfo = document.getElementById('usage-info');
const upgradeButton = document.getElementById('upgrade-button');
const usageCountSection = document.getElementById('usage-count');
const usageCountValue = document.getElementById('usage-count-value');

const USAGE_QUOTA = 30; // Example quota, change as needed

// Check authentication state via background script
  function checkAuthState() {
    chrome.runtime.sendMessage({ target: 'background', type: 'firebase-auth-state-popup' }, (response) => {
    if (response && response.signedIn && response.user) {
      updateUIForSignedInUser(response.user);
    } else {
      updateUIForSignedOutUser();
    }
  });
}

// Update UI for premium user
function updateUIForPremiumUser() {
  console.log('[popup] Updating UI for premium user');
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
  
}

// Update UI for free user
function updateUIForFreeUser() {
  console.log('[popup] Updating UI for free user');
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
  console.log('[popup] Updating UI for signed-in user');
  if (signInButton) signInButton.style.display = 'none';
  const signOutButton = document.getElementById('google-signout');
  if (signOutButton) signOutButton.classList.remove('hidden');
  
  if (userInfo) {
    // Create user avatar with initials
    const initials = user.displayName ? 
      user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) :
      user.email.split('@')[0].slice(0, 2).toUpperCase();
    
    // Check if user is premium from cached data
    chrome.storage.local.get(['user'], (result) => {
      const isPremium = result.user && result.user.firestoreStatus && result.user.firestoreStatus.isPremium;
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
  console.log('[popup] Updating UI for signed-out user');
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
  
  fetchUsageCount();
}

// Handle sign-in button click
if (signInButton) {
  signInButton.addEventListener('click', () => {
    if (signInButton.disabled) return; // Prevent double click
    signInButton.disabled = true;
    console.log('[popup] Sign-in button disabled');
    chrome.runtime.sendMessage({ target: 'background', type: 'firebase-signin-popup' }, (response) => {
      signInButton.disabled = false;
      console.log('[popup] Sign-in button enabled');
      if (response && response.success) {
        // Do not call checkAuthState();
        // UI will update via auth-state-changed event
      } else {
        if (response?.error?.code === 'auth/cancelled-popup-request') {
          alert('Please complete the previous sign-in popup before trying again.');
        }
        console.error('[popup] Sign-in failed:', response?.error);
      }
    });
  });
}

// Handle sign-out button click
if (signOutButton) {
  signOutButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ target: 'background', type: 'firebase-signout-popup' }, (response) => {
      if (response && response.success) {
          updateUIForSignedOutUser();
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


// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'auth-state-changed') {
    console.log('[popup] Received auth-state-changed:', request);
    if (request.user) {
      updateUIForSignedInUser(request.user);
    } else {
      updateUIForSignedOutUser();
    }
  }
  
  if (request.type === 'subscription-status-changed') {
    console.log('[popup] Received subscription-status-changed:', request);
    if (request.isPremium) {
      updateUIForPremiumUser();
    } else {
      updateUIForFreeUser();
    }
  }
  

}); 

document.addEventListener('DOMContentLoaded', () => {
  console.log('[popup] DOMContentLoaded');
  checkAuthState();
}); 