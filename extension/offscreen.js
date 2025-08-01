// Offscreen document message relay for Firebase Auth via iframe

const iframe = document.getElementById('auth-iframe');
let pendingResolvers = {};
let messageId = 0;

// Listen for messages from the iframe
window.addEventListener('message', (event) => {
  // Only try to parse if it looks like JSON (starts with '{' or '[')
  if (typeof event.data === 'string' && (event.data.trim().startsWith('{') || event.data.trim().startsWith('['))) {
    try {
      const data = JSON.parse(event.data);
      console.log('[offscreen] Received message from iframe:', data);
      if (data && data._messageId && pendingResolvers[data._messageId]) {
        pendingResolvers[data._messageId](data);
        delete pendingResolvers[data._messageId];
      }
    } catch (e) {
      // Only log if it was supposed to be JSON
      console.error('[offscreen] Error parsing message from iframe:', e, event.data);
    }
  } else {
    // Optionally, log or ignore non-JSON messages
    // console.log('[offscreen] Ignored non-JSON message from iframe:', event.data);
  }
});

function sendToIframe(message) {
  return new Promise((resolve) => {
    const id = ++messageId;
    pendingResolvers[id] = resolve;
    message._messageId = id;
    console.log('[offscreen] Sending message to iframe:', message);
    iframe.contentWindow.postMessage(message, '*');
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.target !== 'offscreen') {
    return; // Exit early, don't process this message
  }
  console.log('[offscreen] Received message from background:', request);
  if (request.type === 'firebase-signin-bg') {
    sendToIframe({ initAuth: true }).then((result) => {
      console.log('[offscreen] Result from iframe (initAuth):', result);
      sendResponse(result);
    });
    return true;
  }
  if (request.type === 'check-firestore-subscription-bg' && request.userId) {
    sendToIframe({ checkSubscription: true, userId: request.userId }).then((result) => {
      console.log('[offscreen] Result from iframe (checkSubscription):', result);
      sendResponse(result);
    });
    return true;
  }
  if (request.type === 'firebase-signout-bg') {
    sendToIframe({ signOut: true }).then((result) => {
      console.log('[offscreen] Result from iframe (signOut):', result);
      sendResponse(result);
    });
    return true;
  }
}); 