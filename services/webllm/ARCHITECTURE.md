# WebLLM Architecture Decision Record

## Decision: WebLLM vs Ollama

**Date:** 2025-10-09
**Status:** Accepted
**Deciders:** Development Team

### Context

We need a local-first natural language processing solution for interpreting accessibility commands in a browser extension for visually impaired users. Two main options were considered:

1. **WebLLM** - Browser-based LLM using WebGPU
2. **Ollama** - Local server-based LLM

### Decision

We have decided to use **WebLLM** for this project.

### Rationale

#### Why WebLLM:

1. **Zero Installation Complexity**
   - Runs entirely in the browser
   - No separate server installation required
   - Users only need to install the browser extension
   - Model downloads automatically to browser cache

2. **True Privacy-First Architecture**
   - All processing happens in the browser sandbox
   - No data leaves the user's device
   - No localhost server or network calls required
   - Aligns with accessibility user trust requirements

3. **Truly Offline**
   - Works completely offline once model is cached
   - No backend dependencies
   - No server uptime requirements

4. **Cross-Platform Compatibility**
   - Works on any platform with modern browser + WebGPU support
   - No OS-specific installation steps
   - Consistent behavior across platforms

5. **Browser Extension Integration**
   - Native integration with browser APIs
   - Uses browser's GPU acceleration via WebGPU
   - Simpler deployment and updates

#### Why NOT Ollama:

1. **Complex User Setup**
   - Requires separate Ollama installation
   - Users must run Ollama server in background
   - Additional system resource consumption

2. **Network Dependency**
   - Extension must make HTTP requests to localhost:11434
   - Requires server to be running
   - Potential CORS and security complications

3. **Accessibility Barriers**
   - Visually impaired users may struggle with Ollama installation
   - More points of failure (server crash, port conflicts, etc.)
   - Harder for caregivers to set up

### Consequences

#### Positive:
- Simpler user experience
- Better privacy guarantees
- Easier deployment and maintenance
- Lower support burden

#### Negative:
- Limited to WebGPU-compatible browsers
- Model size constraints (browser memory limits)
- Potentially slower than native Ollama on some hardware

### Model Selection

**Selected Model:** `Llama-3.2-1B-Instruct-q4f16_1-MLC`

#### Why This Model:

1. **Size:** ~1GB (manageable for browser download/caching)
2. **Performance:** Optimized for WebGPU execution
3. **Quality:** Llama 3.2 series has strong instruction-following capabilities
4. **Quantization:** q4f16_1 provides good balance of speed and accuracy
5. **MLC Compatibility:** Pre-compiled for MLC (Machine Learning Compilation) framework

#### Alternative Models Considered:

- **Phi-2** (~2.7GB) - Slightly larger but very capable
- **TinyLlama** (~600MB) - Smaller but potentially less accurate
- **Llama-3.2-3B** (~3GB) - More capable but too large for browser constraints

#### Model Specifications:

```javascript
{
  modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  size: '~1GB',
  context_length: 2048,
  quantization: 'q4f16_1',
  framework: 'MLC',
  runtime: 'WebGPU'
}
```

### Implementation Details

#### Configuration:

```javascript
const defaultConfig = {
  modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  temperature: 0.1,  // Low temperature for consistent intent extraction
  maxTokens: 200     // Short responses for intent classification
};
```

#### Performance Targets:

- **Model Load Time:** 5-10 seconds (first time)
- **Processing Time:** <500ms per command
- **Memory Usage:** <2GB total (model + runtime)
- **Accuracy:** >85% for natural language variations

### Browser Compatibility

**Minimum Requirements:**
- Browser with WebGPU support (Chrome 113+, Edge 113+)
- 4GB+ available RAM
- GPU with WebGPU capabilities

**Target Browsers:**
- Microsoft Edge (primary target for this project)
- Chrome/Chromium
- Future: Firefox (when WebGPU is stable)

### Future Considerations

- Monitor WebLLM updates for newer, more efficient models
- Consider model swapping based on user device capabilities
- Potential fallback to cloud-based LLM if WebGPU unavailable (with user consent)

### References

- [WebLLM Documentation](https://webllm.mlc.ai/)
- [MLC-LLM Project](https://mlc.ai/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Llama 3.2 Model Card](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct)
