# 🌍 LambdaTrip Chrome Extension

A powerful Chrome extension that analyzes landmarks in images using AI-powered travel insights.

## ✨ Features

- **Right-click Analysis**: Right-click any image to analyze landmarks
- **AI-Powered Insights**: Get intelligent travel recommendations
- **Real-time Weather**: Current weather conditions for the landmark location
- **Country Information**: Detailed country data and cultural insights
- **Travel Tips**: Practical advice for visiting the landmark
- **Beautiful UI**: Modern, responsive modal interface

## 🚀 Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download the extension files** to your computer
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable "Developer mode"** (toggle in top right)
4. **Click "Load unpacked"** and select the `extension` folder
5. **The extension is now installed!** 🎉

### Method 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store soon!

## 📖 How to Use

1. **Find a landmark image** on any website (Wikipedia, travel sites, etc.)
2. **Right-click** on the image
3. **Select "Analyze Landmark with LambdaTrip"** from the context menu
4. **Wait for analysis** (usually 3-5 seconds)
5. **Enjoy your travel insights!** 🌟

## 🎯 What You'll Get

### Landmark Information
- Landmark name and confidence level
- Location (city, country, coordinates)
- Historical and cultural significance

### Weather Data
- Current temperature and conditions
- Wind speed and humidity
- Best time to visit recommendations

### Country Information
- Official country name and flag
- Population and currency
- Languages and region details

### AI-Powered Analysis
- Intelligent summary of the landmark
- Key insights and cultural highlights
- Practical travel tips and safety advice
- Best visit time recommendations

## 🔧 Technical Details

- **API Endpoint**: Uses your LambdaTrip AWS API
- **Permissions**: Only accesses images you right-click
- **Privacy**: No data is stored locally
- **Performance**: Fast analysis with loading indicators

## 🛠️ Development

### File Structure
```
extension/
├── manifest.json      # Extension configuration
├── background.js      # Background service worker
├── content.js         # Content script for UI
├── styles.css         # Modal styling
├── popup.html         # Extension popup
└── README.md          # This file
```

### Customization

To use with your own API:
1. Update `API_BASE_URL` in `background.js`
2. Modify the API endpoints if needed
3. Adjust the response parsing in `content.js`

## 🐛 Troubleshooting

### Extension not working?
- Check that the extension is enabled in `chrome://extensions/`
- Ensure you're right-clicking on an actual image
- Check the browser console for error messages

### Analysis fails?
- The image might not contain a recognizable landmark
- Try a different image of the same landmark
- Check your API endpoint is working

### Modal doesn't appear?
- Refresh the webpage and try again
- Check that the extension has the necessary permissions

## 📞 Support

If you encounter any issues:
1. Check the browser console for error messages
2. Ensure your LambdaTrip API is running
3. Try with a known working image (like the Eiffel Tower)

## 🎉 Enjoy Your Travel Analysis!

This extension brings the power of your LambdaTrip API directly to your browser, making it easy to analyze any landmark image you encounter while browsing the web! 