# WebLLM Service Integration Guide

**Author:** syedhaliz
**Last Updated:** 2025-10-09

## Overview

This guide explains how to integrate the WebLLM service with STT (Speech-to-Text) and TTS (Text-to-Speech) services in the browser extension.

---

## JSON Format Specifications

### Input from STT Service

```javascript
{
  "text": "scroll down the page",           // Required: transcribed text
  "confidence": 0.95,                      // Required: 0-1
  "language": "en-US",                     // Optional: language code
  "timestamp": 1234567890,                 // Optional: when captured
  "context": {                             // Optional: page context
    "url": "https://example.com",
    "title": "Example Page"
  }
}
```

### Output for TTS Service

```javascript
{
  "text": "Scrolling down",                // Required: what to speak
  "action": "navigate",                    // Required: action type
  "success": true,                         // Required: understood?
  "intent": {                              // Required: parsed intent
    "intent": "navigate",
    "slots": { "direction": "down" },
    "confidence": 0.95
  },
  "confidence": 0.95,                      // Required: 0-1
  "requiresConfirmation": false,           // Required: needs confirm?
  "confirmationPrompt": null               // Optional: confirmation text
}
```

---

## Quick Start

### Simple Integration

```javascript
import { createService } from './services/webllm/src/index.js';

// 1. Initialize service
const service = await createService({
  privacy: {
    localOnly: true,
    allowCloudFallback: false
  }
});

// 2. Process command from STT
const sttInput = {
  text: "scroll down",
  confidence: 0.95
};

const ttsOutput = await service.processCommand(sttInput);

// 3. Send to TTS
console.log(ttsOutput.text);  // "Scrolling down"
```

### Full Integration Example

```javascript
import { WebLLMService } from './services/webllm/src/index.js';

class AccessibilityExtension {
  constructor() {
    this.webllm = null;
  }

  async initialize() {
    // Initialize WebLLM service
    this.webllm = new WebLLMService({
      modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      temperature: 0.1,
      privacy: {
        localOnly: true
      }
    });

    await this.webllm.initialize();
    console.log('[Extension] WebLLM ready');
  }

  // Called when STT service has transcribed speech
  async onSpeechTranscribed(sttData) {
    try {
      // Process with WebLLM
      const response = await this.webllm.processCommand(sttData);

      if (response.requiresConfirmation) {
        // Ask for confirmation
        await this.requestConfirmation(response);
      } else {
        // Execute action
        await this.executeAction(response);
      }

      // Speak response
      await this.speak(response.text);

    } catch (error) {
      console.error('[Extension] Error:', error);
      await this.speak("Sorry, something went wrong");
    }
  }

  async speak(text) {
    // Send to TTS service
    // Implementation depends on your TTS service
  }

  async executeAction(response) {
    // Execute the action in the browser
    switch (response.action) {
      case 'navigate':
        // Handle navigation
        break;
      case 'read':
        // Handle reading
        break;
      // ... other actions
    }
  }

  async requestConfirmation(response) {
    // Show confirmation dialog or wait for voice confirmation
  }
}

// Usage
const extension = new AccessibilityExtension();
await extension.initialize();
```

---

## API Reference

### WebLLMService Class

#### Constructor

```javascript
const service = new WebLLMService({
  modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',  // Model to use
  temperature: 0.1,                               // Sampling temperature
  maxTokens: 200,                                 // Max tokens to generate
  minConfidence: 0.6,                             // Min confidence threshold
  privacy: {
    localOnly: true,                              // Local-only mode
    allowCloudFallback: false,                    // Cloud fallback
    logInteractions: false                        // Log interactions
  }
});
```

#### Methods

**`async initialize()`**
- Initializes the service and loads the model
- Must be called before processing commands
- Returns: Promise<void>

**`async processCommand(sttInput)`**
- Processes a single command from STT
- Parameters: STT input object
- Returns: Promise<TTSOutput>

**`async processCommands(sttInputs)`**
- Batch processes multiple commands
- Parameters: Array of STT input objects
- Returns: Promise<TTSOutput[]>

**`getStatus()`**
- Get current service status
- Returns: { initialized, model, privacyMode, ready }

**`updatePrivacySettings(settings)`**
- Update privacy settings
- Parameters: { localOnly, allowCloudFallback, logInteractions }

**`async cleanup()`**
- Clean up resources
- Returns: Promise<void>

---

## Command Flow

```
User Voice → STT Service → WebLLM Service → TTS Service → Spoken Response
             │              │                │
             └─ JSON ──────→└─ Parse ───────→└─ JSON ────→
                             │
                             ├─ Intent Recognition
                             ├─ Slot Extraction
                             ├─ Confidence Check
                             └─ Response Generation
```

---

## Supported Intents

### 1. Navigate
- **Examples:** "scroll down", "go back", "page up"
- **Slots:** direction, action, target
- **Response:** "Scrolling down", "Going back"

### 2. Read
- **Examples:** "read this page", "stop reading", "pause"
- **Slots:** action, target
- **Response:** "Reading page", "Stopped reading"

### 3. Form Actions
- **Examples:** "submit form", "fill in username"
- **Slots:** action, field, value
- **Response:** "Filling field", "Ready to submit. Confirm?"
- **Confirmation:** Required for submit actions

### 4. Zoom
- **Examples:** "zoom in", "make text bigger", "reset zoom"
- **Slots:** action, amount
- **Response:** "Zooming in", "Increasing size"

### 5. Find Content
- **Examples:** "find login button", "search for contact"
- **Slots:** query, type
- **Response:** "Searching for login button"

### 6. Link Actions
- **Examples:** "list all links", "open first link"
- **Slots:** action, target
- **Response:** "Listing links", "Opening home"

### 7. Help
- **Examples:** "help", "what can you do"
- **Response:** Full capabilities description

---

## Error Handling

### Low Confidence

```javascript
// Input
{
  text: "schroll dwon",  // Typo or unclear
  confidence: 0.5
}

// Output
{
  text: "I'm not sure I understood. Did you say schroll dwon?",
  action: "clarify",
  success: false,
  requiresConfirmation: false
}
```

### Unknown Intent

```javascript
// Input
{
  text: "do something random",
  confidence: 0.9
}

// Output
{
  text: "I didn't understand. Please try again.",
  action: "unknown",
  success: false
}
```

### Processing Error

```javascript
// Output
{
  text: "Sorry, something went wrong.",
  action: "error",
  success: false,
  error: "Error message here"
}
```

---

## Confirmation Flow

For high-risk actions (form submission, navigation away):

```javascript
// 1. Initial command
const response = await service.processCommand({
  text: "submit the form",
  confidence: 0.95
});

console.log(response.requiresConfirmation);  // true
console.log(response.confirmationPrompt);    // "Are you sure you want to submit form?"

// 2. Wait for user confirmation (voice or UI)
// User says "yes" or "confirm"

// 3. Process confirmation
const confirmed = true;  // Based on user response
if (confirmed) {
  await executeAction(response);
}
```

---

## Testing

### Manual Testing

```javascript
import { createService, STT_INPUT_EXAMPLE } from './src/index.js';

const service = await createService();

// Test with example
const result = await service.processCommand(STT_INPUT_EXAMPLE);
console.log(result);

// Test custom command
const result2 = await service.processCommand({
  text: "read this page to me",
  confidence: 0.95
});
console.log(result2);
```

### Format Validation

```javascript
import { validateSTTInput, validateTTSOutput } from './src/index.js';

// Validate STT input
try {
  validateSTTInput({
    text: "scroll down",
    confidence: 0.95
  });
  console.log("Valid input");
} catch (error) {
  console.error("Invalid input:", error.message);
}

// Validate TTS output
try {
  validateTTSOutput(ttsOutput);
  console.log("Valid output");
} catch (error) {
  console.error("Invalid output:", error.message);
}
```

---

## Performance Considerations

### Load Time
- First load: ~5-15 seconds (downloads model)
- Subsequent loads: <1 second (cached)

### Processing Time
- Target: <500ms per command
- Average: ~200ms
- Use batch processing for multiple commands

### Memory Usage
- Model: ~1GB
- Runtime: ~500MB
- Total: ~1.5-2GB

### Optimization Tips
1. Initialize service once at extension startup
2. Reuse service instance for all commands
3. Use batch processing when possible
4. Clean up service when extension is unloaded

---

## Browser Compatibility

**Requirements:**
- Chrome/Edge 113+ with WebGPU support
- 4GB+ available RAM
- GPU with WebGPU capabilities

**Check WebGPU Support:**
```javascript
if ('gpu' in navigator) {
  console.log('WebGPU is supported');
} else {
  console.log('WebGPU is not supported');
  // Provide fallback or error message
}
```

---

## Privacy & Security

### Local-First Processing
- All processing happens in browser
- No data sent to external servers
- Model cached locally after first download

### Privacy Settings
```javascript
const service = new WebLLMService({
  privacy: {
    localOnly: true,           // Strict local-only mode
    allowCloudFallback: false, // No cloud fallback
    logInteractions: false     // Don't log user commands
  }
});
```

### Data Handling
- User commands are processed locally
- No command history is stored by default
- STT input text is not logged unless explicitly enabled

---

## Troubleshooting

### Service won't initialize
- Check WebGPU support: `chrome://gpu`
- Ensure sufficient memory available
- Clear browser cache and retry

### Slow processing
- Check GPU usage (should use GPU, not CPU)
- Close other tabs to free memory
- Consider using smaller model

### Low accuracy
- Check STT confidence scores
- Ensure clear, simple commands
- Provide context when available

---

## Example Integration Patterns

### Pattern 1: Voice-Only
```javascript
// User speaks → STT → WebLLM → Execute → TTS speaks result
voiceInput → transcribe() → processCommand() → execute() → speak()
```

### Pattern 2: Voice + Visual Confirmation
```javascript
// User speaks → STT → WebLLM → Show UI → User confirms → Execute
voiceInput → transcribe() → processCommand() → showDialog() → execute()
```

### Pattern 3: Batch Processing
```javascript
// Process multiple commands efficiently
const commands = [/* multiple STT inputs */];
const results = await service.processCommands(commands);
```

---

## Support

For questions or issues:
- Check TESTING.md for testing procedures
- Review ARCHITECTURE.md for design decisions
- See PROGRESS.md for implementation status

---

**Ready to integrate! See the examples above to get started.**
