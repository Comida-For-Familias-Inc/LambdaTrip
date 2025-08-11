// Content script for LambdaTrip Chrome Extension
chrome.runtime.sendMessage({ type: 'log', message: '[LambdaTrip] Content script loaded on: ' + window.location.href });

let modal = null;
let isAnalyzing = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  chrome.runtime.sendMessage({ type: 'log', message: 'Content script received message: ' + JSON.stringify(request) });
  if (request.action === 'analyzeImage_click') {
    showAnalysisModal(request.imageUrl, request.usageInfo);
    sendResponse({ ack: true }); // immediate ack
    return; // NOT return true
  }
  sendResponse({ ack: true });
});

// Log when content script is fully ready
chrome.runtime.sendMessage({ type: 'log', message: '[LambdaTrip] Content script ready and listening for messages' });

function showAnalysisModal(imageUrl, usageInfo) {
  chrome.runtime.sendMessage({ type: 'log', message: 'showAnalysisModal called with: ' + imageUrl + ', ' + JSON.stringify(usageInfo) });
  if (isAnalyzing) return;
  
  isAnalyzing = true;
  
  // Create modal if it doesn't exist
  if (!modal) {
    createModal();
  }
  
  // // Show usage warning if applicable
  // if (usageInfo && usageInfo.warning && !usageInfo.isPremium) {
  //   showUsageWarning(usageInfo);
  // }
  
  // Show loading state
  showLoadingState(imageUrl);
  
  // Call background script to analyze image
  try {
    chrome.runtime.sendMessage({ type: 'log', message: 'Sending message to background script...' });
    chrome.runtime.sendMessage({
      action: 'analyzeImage_content',
      imageUrl: imageUrl
    }, (response) => {
      chrome.runtime.sendMessage({ type: 'log', message: 'Received response from background script: ' + JSON.stringify(response) });
      chrome.runtime.sendMessage({ type: 'log', message: 'Response type: ' + typeof response });
      chrome.runtime.sendMessage({ type: 'log', message: 'Response keys: ' + (response ? Object.keys(response) : 'null/undefined') });
      isAnalyzing = false;
      
      if (chrome.runtime.lastError) {
        chrome.runtime.sendMessage({ type: 'log', message: 'Extension error: ' + JSON.stringify(chrome.runtime.lastError) });
        showErrorState('Extension communication error. Please try again.');
        return;
      }
      
      if (response && response.success) {
        chrome.runtime.sendMessage({ type: 'log', message: 'Response data: ' + JSON.stringify(response.data) });
        showAnalysisResults(response.data, imageUrl);
      } else {
        chrome.runtime.sendMessage({ type: 'log', message: 'Analysis failed: ' + JSON.stringify(response) });
        showErrorState(response ? response.error : 'Unknown error occurred');
      }
    });
  } catch (error) {
    isAnalyzing = false;
    chrome.runtime.sendMessage({ type: 'log', message: 'Error sending message: ' + error.toString() });
    showErrorState('Failed to communicate with extension. Please try again.');
  }
}

function createModal() {
  modal = document.createElement('div');
  modal.id = 'lambdatrip-modal';
  modal.innerHTML = `
    <div class="lambdatrip-sidebar">
      <div class="lambdatrip-sidebar-header">
        <h2>LambdaTrip</h2>
        <button class="lambdatrip-close-btn">×</button>
      </div>
      <div class="lambdatrip-sidebar-body">
        <div id="lambdatrip-modal-content">
          <!-- Content will be dynamically inserted here -->
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add close functionality
  const closeBtn = modal.querySelector('.lambdatrip-close-btn');
  closeBtn.addEventListener('click', () => {
    closeModal();
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('lambdatrip-active')) {
      closeModal();
    }
  });
  
  // Make closeModal globally available
  window.closeModal = closeModal;
}

function showLoadingState(imageUrl) {
  chrome.runtime.sendMessage({ type: 'log', message: 'showLoadingState called with imageUrl: ' + imageUrl });
  const modalContent = document.getElementById('lambdatrip-modal-content');
  
  modalContent.innerHTML = `
    <div class="loading-section">
      <div class="loading-spinner"></div>
      <h3> Processing Image</h3>
      <p>Analyzing landmark details...</p>
      <div class="image-preview"></div>
    </div>
  `;

  // Safely create and append the image
  const previewDiv = modalContent.querySelector('.image-preview');
  const img = document.createElement('img');
  img.className = 'preview-image';
  img.alt = 'Image being analyzed';
  img.src = imageUrl;
  previewDiv.appendChild(img);

  modal.classList.add('lambdatrip-active');
}

function showAnalysisResults(data, imageUrl) {
  chrome.runtime.sendMessage({ type: 'log', message: 'showAnalysisResults called with data: ' + JSON.stringify(data) });
  chrome.runtime.sendMessage({ type: 'log', message: 'showAnalysisResults called with imageUrl: ' + imageUrl });
  
  const modalContent = document.getElementById('lambdatrip-modal-content');
  chrome.runtime.sendMessage({ type: 'log', message: 'modalContent element: ' + (modalContent ? 'found' : 'not found') });
  
  const { imageAnalysis, aiAnalysis } = data;
  chrome.runtime.sendMessage({ type: 'log', message: 'imageAnalysis: ' + JSON.stringify(imageAnalysis) });
  chrome.runtime.sendMessage({ type: 'log', message: 'aiAnalysis: ' + JSON.stringify(aiAnalysis) });
  
  // Extract landmark data from the correct structure
  const landmarkData = imageAnalysis.analysis_data?.landmark || {};
  const landmarkName = imageAnalysis.landmark_detected || landmarkData.name || 'Not detected';
  const confidence = landmarkData.confidence ? Math.round(landmarkData.confidence * 100) : 'N/A';
  const location = landmarkData.location;
  
  // Extract additional data
  const weather = imageAnalysis.analysis_data?.weather;
  const countryInfo = imageAnalysis.analysis_data?.country_info;
  const travelAdvisory = aiAnalysis?.analysis?.travel_advisory;
  
  // Format location string
  let locationString = '';
  if (location) {
    if (location.city && location.country) {
      locationString = `${location.city}, ${location.country}`;
    } else if (location.country) {
      locationString = location.country;
    } else if (location.city) {
      locationString = location.city;
    }
  }
  
  modalContent.innerHTML = `
    <div class="image-section">
      <div class="analyzed-image-wrapper"></div>
    </div>
    
    <div class="analysis-section">
      <div class="landmark-info">
        <h3>ℹ️ Landmark Information</h3>
        <p><strong>Name:</strong> ${landmarkName}</p>
        <p><strong>Confidence:</strong> ${confidence}%</p>
        ${locationString ? `<p><strong>📍 Location:</strong> ${locationString}</p>` : ''}
      </div>
      
      ${weather ? `
      <div class="weather-section">
        <h3>🌤️ Current Weather</h3>
        <div class="weather-info">
          <div class="weather-main">
            <span class="temp">${weather.temperature?.current || 'N/A'}°C</span>
            <span class="conditions">${weather.conditions || 'N/A'}</span>
          </div>
          <div class="weather-details">
            <span>💨 Wind: ${weather.wind_speed || 'N/A'} km/h</span>
            <span>💧 Humidity: ${weather.humidity || 'N/A'}%</span>
            <span>🌅 ${weather.is_daytime ? 'Day' : 'Night'}</span>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${countryInfo ? `
      <div class="country-section">
        <h3>🏛️ Country Information</h3>
        <div class="country-info">
          ${countryInfo.flags?.png ? `<img src="${countryInfo.flags.png}" alt="${countryInfo.name?.common} flag" class="country-flag">` : ''}
          <div class="country-details">
            <p><strong>${countryInfo.name?.official || 'N/A'}</strong></p>
            <p>👥 Population: ${countryInfo.population ? countryInfo.population.toLocaleString() : 'N/A'}</p>
            <p>💰 Currency: ${countryInfo.currencies ? Object.values(countryInfo.currencies)[0]?.name : 'N/A'}</p>
            <p>🗣️ Language: ${countryInfo.languages ? Object.values(countryInfo.languages)[0] : 'N/A'}</p>
            <p>🌍 Region: ${countryInfo.region || 'N/A'}</p>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${travelAdvisory ? `
      <div class="advisory-section">
        <h3>🛡️ Travel Advisory</h3>
        <div class="advisory-info">
          <p><strong>Level:</strong> ${travelAdvisory.level || 'N/A'}</p>
          <p><strong>Summary:</strong> ${travelAdvisory.summary || 'N/A'}</p>
          ${travelAdvisory.recommendations && travelAdvisory.recommendations.length > 0 ? `
          <div class="advisory-recommendations">
            <p><strong>Recommendations:</strong></p>
            <ul>
              ${travelAdvisory.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
      
      ${aiAnalysis?.analysis ? `
      <div class="ai-section">
        
        ${aiAnalysis.analysis.insights ? `
        <div class="insights-section">
          <h4>💡 Key Insights</h4>
          <ul class="insights-list">
            ${aiAnalysis.analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${aiAnalysis.analysis.travel_tips ? `
        <div class="tips-section">
          <h4>🎒 Travel Tips</h4>
          <ul class="tips-list">
            ${aiAnalysis.analysis.travel_tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${aiAnalysis.analysis.best_visit_time ? `
        <div class="timing-section">
          <h4>⏰ Best Time to Visit</h4>
          <p>${aiAnalysis.analysis.best_visit_time}</p>
        </div>
        ` : ''}
        
        ${aiAnalysis.analysis.safety_rating ? `
        <div class="safety-section">
          <h4>🛡️ Safety Rating</h4>
          <p>${aiAnalysis.analysis.safety_rating}/5</p>
        </div>
        ` : ''}
        
        ${aiAnalysis.analysis.cultural_highlights ? `
        <div class="cultural-section">
          <h4>🎭 Cultural Highlights</h4>
          <p>${aiAnalysis.analysis.cultural_highlights}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      ${imageAnalysis.text_content ? `
      <div class="text-content">
        <h3>📝 Detected Text</h3>
        <p>${imageAnalysis.text_content}</p>
      </div>
      ` : ''}
    </div>
  `;

  // Safely create and append the analyzed image
  const analyzedImageWrapper = modalContent.querySelector('.analyzed-image-wrapper');
  const analyzedImg = document.createElement('img');
  analyzedImg.className = 'analyzed-image';
  analyzedImg.alt = 'Analyzed landmark';
  analyzedImg.src = imageUrl;
  analyzedImageWrapper.appendChild(analyzedImg);

  modal.classList.add('lambdatrip-active');
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal activated with lambdatrip-active class' });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal classes: ' + modal.className });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal style right: ' + window.getComputedStyle(modal).right });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal style width: ' + window.getComputedStyle(modal).width });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal style height: ' + window.getComputedStyle(modal).height });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal style z-index: ' + window.getComputedStyle(modal).zIndex });
  chrome.runtime.sendMessage({ type: 'log', message: 'Modal style position: ' + window.getComputedStyle(modal).position });
}

function showErrorState(errorMessage) {
  const modalContent = document.getElementById('lambdatrip-modal-content');
  
  modalContent.innerHTML = `
    <div class="error-section">
      <div class="error-icon">
        ❌
      </div>
      <h3>Analysis Failed</h3>
      <p>${errorMessage}</p>
      <button class="retry-btn" onclick="window.closeModal()">Close</button>
    </div>
  `;
  
  modal.classList.add('lambdatrip-active');
}

function closeModal() {
  if (modal) {
    modal.classList.remove('lambdatrip-active');
    isAnalyzing = false; // Reset analyzing state when modal is closed
  }
}
