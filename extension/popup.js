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
  chrome.runtime.sendMessage({ type: 'firebase-auth-state' }, (response) => {
    if (response && response.signedIn && response.user) {
      updateUIForSignedInUser(response.user);
    } else {
      updateUIForSignedOutUser();
    }
  });
}

// Google Sign-In using background script with offscreen document
function signInWithGoogle() {
  // Show loading state
  if (signInButton) {
    signInButton.textContent = 'Signing in...';
    signInButton.disabled = true;
    signInButton.classList.add('loading');
  }
  
  // Use background script to handle auth via offscreen document
  chrome.runtime.sendMessage({ type: 'firebase-signin' }, (response) => {
    // Reset button state
    if (signInButton) {
      signInButton.innerHTML = `
        <svg class="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      `;
      signInButton.disabled = false;
      signInButton.classList.remove('loading');
    }
    
    if (response && response.success && response.user) {
      updateUIForSignedInUser(response.user);
      
      // Refresh auth state after a short delay to ensure storage is updated
      setTimeout(() => {
        checkAuthState();
      }, 100);
    } else {
      console.error('Sign-in error:', response && response.error ? response.error : 'Unknown error');
      alert('Sign-in failed: ' + (response && response.error ? response.error : 'Unknown error'));
    }
  });
}

// Sign Out
function signOut() {
  chrome.runtime.sendMessage({ type: 'firebase-signout' }, (response) => {
    if (response && response.success) {
      updateUIForSignedOutUser();
    } else {
      console.error('Sign-out error:', response && response.error ? response.error : 'Unknown error');
      alert('Sign-out failed: ' + (response && response.error ? response.error : 'Unknown error'));
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
    
    userInfo.innerHTML = `
      <div class="user-avatar">${initials}</div>
      <div class="user-email">${user.email}</div>
      <div class="user-welcome">Welcome back!</div>
    `;
  }
  
  // Show upgrade button for now (you can add subscription logic later)
  if (upgradeButton) {
    upgradeButton.style.display = 'block';
  }
}

// Update UI for signed-out user
function updateUIForSignedOutUser() {
  if (signInButton) signInButton.style.display = 'block';
  const signOutButton = document.getElementById('google-signout');
  if (signOutButton) signOutButton.classList.add('hidden');
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="auth-status">
        <div class="status-text">Sign in to track your usage</div>
        <div class="status-subtitle">Get personalized travel insights</div>
      </div>
    `;
  }
  if (usageInfo) usageInfo.innerHTML = '';
  if (upgradeButton) upgradeButton.style.display = 'none';
}

// Show usage count (remaining)
function showUsageCount(used) {
  if (usageCountSection && usageCountValue) {
    const remaining = Math.max(0, USAGE_QUOTA - used);
    usageCountValue.textContent = remaining;
    usageCountSection.style.display = 'flex';
  }
}

// Example: Fetch usage count from storage or background (replace with real logic)
function fetchUsageCount() {
  // Placeholder: Replace with real fetch logic
  // Example: chrome.runtime.sendMessage({type: 'get-usage-count'}, ...)
  // For now, just show a static value
  showUsageCount(12); // Example: 12 used, so 18 left
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Check auth state when popup opens
  checkAuthState();
  fetchUsageCount();
  
  if (signInButton) {
    signInButton.addEventListener('click', signInWithGoogle);
  }
  
  const signOutButton = document.getElementById('google-signout');
  if (signOutButton) {
    signOutButton.addEventListener('click', signOut);
  }
  
  if (upgradeButton) {
    upgradeButton.addEventListener('click', () => {
      // Open payment page (you can customize this URL)
      chrome.tabs.create({ url: 'https://lambdatrip.web.app/payment' });
    });
  }
}); 