# WebLLM Service

Local-first natural language processing for accessibility commands using WebLLM.

## Overview

This service provides intent recognition for visually impaired users, allowing them to control a web browser using natural language commands. It runs entirely in the browser with no external API calls, ensuring privacy and offline functionality.

## Features

- **Local-First Processing**: All processing happens in the browser, no cloud APIs required
- **Privacy-First**: Configurable privacy settings with strict local-only mode
- **Natural Language Understanding**: Interprets everyday language into structured commands
- **Accessibility-Focused**: Designed specifically for visually impaired users
- **Offline Support**: Works without internet connection once model is loaded

## Supported Intent Categories

1. **Navigation**: scroll, go back, forward, etc.
2. **Reading**: read page, stop, pause, resume
3. **Form Actions**: fill fields, submit forms (with confirmation)
4. **Zoom**: zoom in/out, increase/decrease text size
5. **Find Content**: search for elements, find buttons/links
6. **Link Actions**: list links, open links
7. **Help**: get command help

## Installation

```bash
npm install
npm run build:webllm  # Bundle WebLLM for Chrome extension use
```

**Important for Chrome Extensions:** Chrome extensions cannot resolve npm module specifiers (`@mlc-ai/web-llm`) directly. You must run `npm run build:webllm` to create a bundled version (`src/bundled-webllm.js`) that can be imported using relative paths. This bundled file is automatically used by `parser.js`.

## Usage

### Basic Example

```javascript
import { createParser, analyzeAccessibilityUtterance } from './src/index.js';

// Create and initialize parser
const parser = await createParser();

// Parse a command
const result = await analyzeAccessibilityUtterance('scroll down', null, parser);

console.log(result);
// {
//   intent: { intent: 'navigate', slots: { direction: 'down' }, confidence: 0.9, requiresConfirmation: false },
//   originalText: 'scroll down',
//   timestamp: 1234567890
// }
```

### With Privacy Settings

```javascript
const parser = await createParser({
  localOnly: true,           // Strict local-only mode
  allowCloudFallback: false, // No cloud fallback
  logInteractions: false     // Don't log interactions
});
```

### With Custom Model

```javascript
const parser = await createParser({}, {
  modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  temperature: 0.1,
  maxTokens: 200
});
```

## Model & Architecture

**Selected Model:** `Llama-3.2-1B-Instruct-q4f16_1-MLC`

- **Why WebLLM?** Runs entirely in browser (no server setup), truly offline, privacy-first
- **Why this model?** 1GB size, optimized for WebGPU, strong instruction-following
- **Alternative to Ollama:** WebLLM requires no installation, while Ollama needs separate server setup

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed decision rationale.

## Performance Targets

- Model loading: ~5-10 seconds (first time)
- Processing speed: <500ms per command
- Accuracy: >85% for natural language variations
- Memory usage: <2GB total

## Privacy & Security

- **Local-First**: All processing happens in the browser
- **No External Calls**: No data sent to external servers in local-only mode
- **User Control**: Privacy toggle gives users full control
- **Screen Reader Compatible**: Works with NVDA/JAWS

## Development

```bash
# Run linting
npm run lint

# Run tests
npm test

# Development mode
npm run dev

# Build WebLLM bundle for Chrome extension
npm run build:webllm
```

### Building for Chrome Extension

When using this service in a Chrome extension, you must bundle WebLLM first:

```bash
cd services/webllm
npm install
npm run build:webllm
```

This creates `src/bundled-webllm.js` which is automatically imported by `parser.js`. The bundle is excluded from git (see `.gitignore`) as it's generated code.

**Why bundling is needed:** Chrome extensions run in a sandboxed environment that doesn't support Node.js-style module resolution. The bundled file contains all WebLLM dependencies in a single ESM module that can be imported with relative paths.

## License

MIT
