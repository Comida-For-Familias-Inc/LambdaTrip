import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDB2SxvMTUYNY53hhYOFqHLCD7zpoztt-Y",
  authDomain: "lambdatrip.firebaseapp.com",
  projectId: "lambdatrip",
  storageBucket: "lambdatrip.appspot.com",
  messagingSenderId: "105431370700",
  appId: "1:105431370700:web:5c0d29fc9a6686c207ab69",
  measurementId: "G-TB7ZWRP97W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// This gives you a reference to the parent frame, i.e. the offscreen document
const PARENT_FRAME = document.location.ancestorOrigins[0];

function sendResponse(result) {
  console.log('Sending response to parent:', result);
  window.parent.postMessage(JSON.stringify(result), PARENT_FRAME);
}

// Check user subscription status
async function checkUserSubscription(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        isSubscriber: userData.isSubscriber || false,
        subscriptionTier: userData.subscriptionTier || 'free',
        subscriptionEndDate: userData.subscriptionEndDate || null
      };
    } else {
      // Create new user document
      return {
        isSubscriber: false,
        subscriptionTier: 'free',
        subscriptionEndDate: null
      };
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
    return {
      isSubscriber: false,
      subscriptionTier: 'free',
      subscriptionEndDate: null
    };
  }
}

// Check current auth state
async function checkCurrentAuthState() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Stop listening after first check
      
      if (user) {
        console.log('User is already signed in:', user.email);
        const subscription = await checkUserSubscription(user.uid);
        resolve({ 
          user: user,
          subscription: subscription
        });
      } else {
        console.log('No user is signed in');
        resolve(null);
      }
    });
  });
}

// Listen for messages from the extension
window.addEventListener('message', function({data}) {
  console.log('Received message:', data);
  
  if (data.initAuth) {
    console.log('Starting Google Sign-In...');
    // Opens the Google sign-in page in a popup, inside of an iframe in the
    // extension's offscreen document.
    signInWithPopup(auth, provider)
      .then(async (result) => {
        console.log('Sign-in successful:', result.user);
        
        // Check subscription status
        const subscription = await checkUserSubscription(result.user.uid);
        
        sendResponse({ 
          user: result.user,
          subscription: subscription
        });
      })
      .catch((error) => {
        console.error('Sign-in failed:', error);
        sendResponse({ error: error });
      });
  }
  
  if (data.checkAuthState) {
    console.log('Checking current auth state...');
    checkCurrentAuthState()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error checking auth state:', error);
        sendResponse({ error: error });
      });
  }
});

// Auto-trigger authentication when page loads (for testing)
console.log('Auth page loaded, ready for authentication'); 