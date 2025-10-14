# WebLLM NLP Sandbox

A browser-based sandbox for testing WebLLM's natural language processing capabilities, specifically for converting natural language commands into structured JSON intents.

## Overview

This sandbox validates that WebLLM can:
1. Run locally in the browser
2. Parse natural-language commands into structured JSON intents  
3. Respond under 500ms (performance measurement ready)

## Setup

### Prerequisites
- Modern web browser with ES6 module support
- Local HTTP server (for CORS compliance)

### Installation

1. **Clone and navigate to the sandbox:**
   ```bash
   cd sandbox/webllm
   ```

2. **Start a local HTTP server:**
   
   **Option A: Using Python (if available)**
   ```bash
   python3 -m http.server 8000
   ```
   
   **Option B: Using Node.js http-server**
   ```bash
   npm install -g http-server
   http-server -p 8000
   ```
   
   **Option C: Using PHP (if available)**
   ```bash
   php -S localhost:8000
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

## Usage

1. **Wait for model loading** - The page will show "Loading model..." and then "Model loaded ✅" with details
2. **Test commands** - Use the text input or click the test buttons
3. **View results** - See both raw model output and parsed JSON intent

## File Structure

```
/sandbox/webllm/
├── index.html          # Main webpage with UI
├── main.js             # WebLLM integration and command processing
├── test-data.js        # Sample test commands
└── README.md           # This file
```

## Expected Outputs

### Example Commands and Expected JSON:

| Input | Expected JSON Output |
|-------|---------------------|
| "scroll down" | `{"intent":"scroll","direction":"down"}` |
| "find login" | `{"intent":"find","target":"login"}` |
| "read this" | `{"intent":"read","target":"this"}` |
| "zoom in" | `{"intent":"zoom","direction":"in"}` |
| "help me" | `{"intent":"help"}` |

### Model Information Displayed:
- Model ID (e.g., "Phi-2-q4f16_1")
- Load time in seconds
- Memory usage (if available)

## Technical Details

- **Model**: Attempts to load `Phi-2-q4f16_1` first, falls back to other lightweight models
- **CDN**: Uses `https://esm.run/webllm` for WebLLM import
- **Prompt Engineering**: Structured prompt template for consistent JSON output
- **Error Handling**: Graceful fallbacks and clear error messages

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure you're serving via HTTP server, not opening file directly
2. **Model Loading Fails**: Check browser console for specific error messages
3. **Slow Performance**: Model loading can take 10-30 seconds depending on connection
4. **Memory Issues**: Try refreshing if browser becomes unresponsive

### Browser Compatibility:
- Chrome/Chromium (recommended)
- Firefox
- Safari (may have limitations)
- Edge

## Performance Notes

- First model load: ~10-30 seconds
- Subsequent commands: Target <500ms response time
- Memory usage: Varies by model (~100-500MB)

## Development

To modify or extend:

1. **Add new test commands**: Edit `test-data.js`
2. **Modify prompt template**: Update the prompt in `processCommand()` function
3. **Change model**: Modify the `modelOptions` array in `loadModel()`
4. **UI improvements**: Edit `index.html` styles and structure


