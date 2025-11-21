# Page Reader Service

Intelligent voice page reading for Issue #7.

## Quick Start

```javascript
// The PageReader is automatically initialized in content.js
// Just use voice commands:
"read page"
"pause"
"resume"
"next paragraph"
"previous paragraph"
"stop reading"
```

## Modules

### ContentExtractor
Extracts main content from webpages, filters ads and navigation.

### ReadingStateManager
Tracks reading position and manages navigation.

### PageReader
Main controller coordinating extraction, state, and TTS.

## Features
- ✅ Intelligent content extraction
- ✅ Ad/navigation filtering
- ✅ Pause/resume support
- ✅ Paragraph navigation
- ✅ Visual highlighting
- ✅ Auto-scroll
- ✅ Error handling

## Integration
Integrated into content.js CommandExecutor. Modules loaded dynamically on first use.

See `ISSUE_7_VOICE_PAGE_READING.md` for complete documentation.
