##API Usage Examples

**Author:** syedhaliz

### Example 1: Basic Usage

```javascript
import { createService } from './services/webllm/src/index.js';

// Initialize
const service = await createService();

// Process command
const result = await service.processCommand({
  text: "scroll down",
  confidence: 0.95
});

console.log(result.text);  // "Scrolling down"
```

### Example 2: STT/TTS Integration

```javascript
import { WebLLMService, STT_INPUT_EXAMPLE } from './services/webllm/src/index.js';

// Create service
const webllm = new WebLLMService({
  privacy: { localOnly: true }
});

await webllm.initialize();

// Receive from STT
const sttInput = {
  text: "find the login button",
  confidence: 0.92,
  language: "en-US",
  timestamp: Date.now()
};

// Process
const ttsOutput = await webllm.processCommand(sttInput);

// Send to TTS
console.log(ttsOutput);
/*
{
  text: "Searching for login button",
  action: "find_content",
  success: true,
  confidence: 0.92,
  requiresConfirmation: false
}
*/
```

### Example 3: Confirmation Flow

```javascript
// High-risk action
const result = await service.processCommand({
  text: "submit the form",
  confidence: 0.95
});

if (result.requiresConfirmation) {
  // Ask user
  console.log(result.confirmationPrompt);  // "Are you sure you want to submit form?"

  // Wait for "yes" or "no"
  const userSaidYes = true;  // From voice or UI

  if (userSaidYes) {
    // Execute the action
    executeFormSubmit();
  }
}
```

### Example 4: Error Handling

```javascript
try {
  const result = await service.processCommand({
    text: "xyzabc unclear command",
    confidence: 0.95
  });

  if (!result.success) {
    // Handle unclear command
    console.log(result.text);  // "I didn't understand. Please try again."
  }
} catch (error) {
  console.error('Error:', error);
}
```

### Example 5: Format Validation

```javascript
import { validateSTTInput, validateTTSOutput } from './services/webllm/src/index.js';

// Validate before processing
try {
  validateSTTInput(sttData);
  const result = await service.processCommand(sttData);
  validateTTSOutput(result);
  // All valid, proceed
} catch (error) {
  console.error('Validation failed:', error.message);
}
```
