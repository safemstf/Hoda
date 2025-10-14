# WebLLM Testing Guide

## Prerequisites

- Modern browser with WebGPU support:
  - Chrome 113+ or Edge 113+ (recommended)
  - 4GB+ RAM available
  - GPU with WebGPU capabilities

## Running Tests

### 1. Start the Test Server

```bash
npm start
```

This will start a local HTTP server on `http://localhost:3000`

### 2. Interactive Testing

Open `http://localhost:3000` in your browser to access the interactive test interface.

**Features:**
- Model loading with progress tracking
- Performance metrics (load time, memory usage)
- Interactive command testing
- Quick test buttons for common commands
- JSON result display with processing time

**How to use:**
1. Wait for the model to load (5-15 seconds first time)
2. Enter a natural language command
3. Click "Test Command" to see results
4. View intent recognition output and processing time

### 3. Performance Benchmarking

Open `http://localhost:3000/benchmark.html` for automated performance testing.

**Features:**
- Runs 20 test commands automatically
- Measures processing time for each
- Calculates average, min, and max times
- Shows pass/fail status (target: <500ms)
- Displays overall statistics

**Test Commands Include:**
- Navigation: "scroll down", "go back", "page down"
- Reading: "read this page", "read to me", "stop reading"
- Finding: "find login button", "where is sign in"
- Zoom: "make text bigger", "zoom in"
- Forms: "submit form", "fill in username"
- Links: "list all links"
- Help: "help", "what can you do"

### 4. Model Selection Testing

The default model is `Llama-3.2-1B-Instruct-q4f16_1-MLC`.

To test with different models, modify the configuration in `test.html` or `benchmark.html`:

```javascript
const parser = await createParser({}, {
    modelId: 'YOUR-MODEL-ID-HERE',
    temperature: 0.1,
    maxTokens: 200
});
```

**Available models:**
- `Llama-3.2-1B-Instruct-q4f16_1-MLC` (default, ~1GB)
- `Llama-3.2-3B-Instruct-q4f16_1-MLC` (~3GB, more capable)
- `Phi-2-q4f16_1-MLC` (~2.7GB, alternative)

## Performance Targets

### Load Time
- **Target:** <15 seconds (first load)
- **Expected:** 5-10 seconds on good connection
- **Note:** Model is cached after first load

### Processing Time
- **Target:** <500ms per command
- **Expected:** 100-300ms on average
- **Measurement:** Time from input to parsed intent

### Memory Usage
- **Target:** <2GB total
- **Expected:** ~1-1.5GB
- **Note:** Varies by browser and model size

### Accuracy
- **Target:** >85% for natural language variations
- **Testing:** See "Test natural language variations" section

## Offline Testing

1. Load the page once with internet connection (to download model)
2. Model will be cached in browser
3. Disconnect from internet
4. Test should still work (verify offline functionality)

## Browser Console Testing

You can also test via browser console:

```javascript
import { createParser, analyzeAccessibilityUtterance } from './src/index.js';

// Initialize
const parser = await createParser();

// Test a command
const result = await analyzeAccessibilityUtterance('scroll down', null, parser);
console.log(result);
```

## Troubleshooting

### Model Not Loading
- Check browser supports WebGPU (chrome://gpu)
- Ensure sufficient memory available
- Check browser console for errors
- Try clearing browser cache

### Slow Performance
- Check GPU is being used (not CPU fallback)
- Close other tabs/applications
- Try smaller model (Llama-3.2-1B vs 3B)

### WebGPU Not Available
- Update browser to latest version
- Enable WebGPU flags if needed:
  - Chrome: `chrome://flags/#enable-unsafe-webgpu`
  - Edge: `edge://flags/#enable-unsafe-webgpu`

### CORS Errors
- Make sure to use the provided server (`npm start`)
- Don't open HTML files directly (file://)
- Server adds required CORS headers

## Next Steps

After verifying basic functionality:

1. **Test Natural Language Variations** (Task 5)
   - Test multiple phrasings for each intent
   - Measure accuracy rate
   - Document which variations work well

2. **Integration Testing** (Task 8)
   - Test with STT output
   - Test with TTS input format
   - Verify end-to-end pipeline

3. **Browser Compatibility**
   - Test in Edge (primary target)
   - Test in Chrome
   - Document any issues

## Test Results Template

Document your test results:

```markdown
## Test Results - [Date]

**Environment:**
- Browser: [name & version]
- OS: [operating system]
- GPU: [GPU model if known]

**Load Time:** [X] seconds
**Average Processing Time:** [X] ms
**Memory Usage:** [X] MB

**Sample Commands Tested:**
1. "scroll down" → [intent] ([X]ms)
2. "read this page" → [intent] ([X]ms)
3. ...

**Issues Found:**
- [list any issues]

**Notes:**
- [any observations]
```
