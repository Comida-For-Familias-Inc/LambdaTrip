// This URL must point to the public site
const FIREBASE_HOSTING_URL = 'https://lambdatrip.web.app/auth-tab.html';

const iframe = document.createElement('iframe');
iframe.src = FIREBASE_HOSTING_URL;
document.body.appendChild(iframe);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAuth' && message.target === 'offscreen') {
    function handleIframeMessage({data}) {
      try {
        // Filter out Firebase internal messages that start with '!_{'
        if (data.startsWith('!_{')) {
          return;
        }
        
        const parsedData = JSON.parse(data);
        window.removeEventListener('message', handleIframeMessage);
        sendResponse(parsedData.user);
      } catch (e) {
        console.error('Error parsing iframe message:', e);
      }
    }

    window.addEventListener('message', handleIframeMessage);
    iframe.contentWindow.postMessage({initAuth: true}, FIREBASE_HOSTING_URL);
    return true; // Indicates we will send a response asynchronously
  }
}); 