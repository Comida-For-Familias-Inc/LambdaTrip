// Offscreen document for Firebase Auth
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

// Check Firestore subscription status
async function checkFirestoreSubscription(userId) {
  try {
    const subscriptionsRef = collection(db, 'customers', userId, 'subscriptions');
    const q = query(subscriptionsRef, where('status', 'in', ['active', 'trialing']));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const subscription = querySnapshot.docs[0].data();
      console.log('Found active subscription:', subscription);
      return {
        isPremium: true,
        subscriptionStatus: subscription.status,
        subscriptionId: querySnapshot.docs[0].id
      };
    } else {
      console.log('No active subscriptions found');
      return {
        isPremium: false,
        subscriptionStatus: null,
        subscriptionId: null
      };
    }
  } catch (error) {
    console.error('Error checking Firestore subscription:', error);
    return {
      isPremium: false,
      subscriptionStatus: null,
      subscriptionId: null,
      error: error.message
    };
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'firebase-signin') {
    signInWithPopup(auth, provider)
      .then((result) => {
        sendResponse({ user: result.user });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
  
  if (request.type === 'check-firestore-subscription') {
    checkFirestoreSubscription(request.userId)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
}); 