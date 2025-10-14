# JSON Format Specifications for Services

**For:** STT, TTS, and WebLLM Integration
**Author:** syedhaliz
**Last Updated:** 2025-10-09

---

## STT → WebLLM Input Format

The STT (Speech-to-Text) service should output in this format:

```json
{
  "text": "scroll down the page",
  "confidence": 0.95,
  "language": "en-US",
  "timestamp": 1696867890123,
  "context": {
    "url": "https://example.com",
    "title": "Example Page"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ Yes | The transcribed text from speech |
| `confidence` | number | ✅ Yes | STT confidence score (0-1) |
| `language` | string | ❌ No | Language code (e.g., 'en-US') |
| `timestamp` | number | ❌ No | Unix timestamp when speech was captured |
| `context` | object | ❌ No | Current page context (url, title, etc.) |

---

## WebLLM → TTS Output Format

The WebLLM service will output in this format for TTS:

```json
{
  "text": "Scrolling down",
  "action": "navigate",
  "success": true,
  "intent": {
    "intent": "navigate",
    "slots": {
      "direction": "down"
    },
    "confidence": 0.95
  },
  "confidence": 0.95,
  "requiresConfirmation": false
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | ✅ Yes | The text to be spoken by TTS |
| `action` | string | ✅ Yes | Action type (navigate, read, zoom, etc.) |
| `success` | boolean | ✅ Yes | Whether the intent was understood |
| `intent` | object | ✅ Yes | Full parsed intent details |
| `confidence` | number | ✅ Yes | Confidence in interpretation (0-1) |
| `requiresConfirmation` | boolean | ✅ Yes | Whether user confirmation is needed |
| `confirmationPrompt` | string | ❌ No | What to ask for confirmation (if needed) |

---

## Example with Confirmation

When a high-risk action is detected:

```json
{
  "text": "Ready to submit. Confirm?",
  "action": "form_action",
  "success": true,
  "intent": {
    "intent": "form_action",
    "slots": {
      "action": "submit"
    },
    "confidence": 0.92
  },
  "confidence": 0.92,
  "requiresConfirmation": true,
  "confirmationPrompt": "Are you sure you want to submit form?"
}
```

---

## Error Response Format

When WebLLM doesn't understand or encounters an error:

```json
{
  "text": "I didn't understand. Please try again.",
  "action": "unknown",
  "success": false,
  "intent": {
    "intent": "unknown",
    "slots": {},
    "confidence": 0.0
  },
  "confidence": 0.0,
  "requiresConfirmation": false
}
```

---

## Complete Example Flow

### 1. User speaks: "scroll down"

### 2. STT Service Output →
```json
{
  "text": "scroll down",
  "confidence": 0.95,
  "language": "en-US",
  "timestamp": 1696867890123
}
```

### 3. WebLLM Service Output →
```json
{
  "text": "Scrolling down",
  "action": "navigate",
  "success": true,
  "intent": {
    "intent": "navigate",
    "slots": {
      "direction": "down"
    },
    "confidence": 0.95
  },
  "confidence": 0.95,
  "requiresConfirmation": false
}
```

### 4. TTS speaks: "Scrolling down"

---

## Validation Rules

### STT Input Validation
- `text` must be non-empty string
- `confidence` must be number between 0 and 1
- `language` must be valid BCP 47 language tag (if provided)
- `timestamp` must be valid Unix timestamp (if provided)

### TTS Output Validation
- `text` must be non-empty string
- `action` must be valid intent type
- `success` must be boolean
- `intent` must contain: intent, slots, confidence
- `confidence` must be number between 0 and 1
- `requiresConfirmation` must be boolean

---

## Supported Intent Types (action field)

1. **navigate** - Navigation commands (scroll, go back, forward)
2. **read** - Reading commands (read page, stop, pause, resume)
3. **form_action** - Form interactions (fill, submit, select)
4. **zoom** - Zoom/magnification (zoom in/out, make text bigger)
5. **find_content** - Search/find elements (find button, locate link)
6. **link_action** - Link interactions (list links, open link)
7. **help** - Help requests
8. **unknown** - Unrecognized command

---

## Implementation

### JavaScript Example (STT Service)

```javascript
// STT service outputs this format
const sttOutput = {
  text: transcribedText,
  confidence: recognitionConfidence,
  language: "en-US",
  timestamp: Date.now()
};

// Send to WebLLM service
sendToWebLLM(sttOutput);
```

### JavaScript Example (TTS Service)

```javascript
// Receive from WebLLM service
async function handleWebLLMOutput(output) {
  if (output.requiresConfirmation) {
    // Ask for confirmation first
    await speak(output.confirmationPrompt);
    // Wait for yes/no...
  } else {
    // Speak the response
    await speak(output.text);
    // Execute the action
    executeAction(output.action, output.intent.slots);
  }
}
```

---

## Files with Full Implementation

- **Format Definitions:** `services/webllm/src/formats.js`
- **Validation Functions:** `services/webllm/src/formats.js`
- **Integration Guide:** `services/webllm/INTEGRATION.md`
- **Code Examples:** `services/webllm/API_EXAMPLES.md`

---

## Questions?

See the WebLLM service documentation in `services/webllm/` for complete details.
