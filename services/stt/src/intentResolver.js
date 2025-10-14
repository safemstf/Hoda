/**
 * Intent Resolver - Smart routing between CommandNormalizer and WebLLM
 * Prep for WebLLM integration (next sprint)
 */

import { CommandNormalizer } from './commandNormalizer.js';

export class IntentResolver {
  constructor(options = {}) {
    this.normalizer = new CommandNormalizer();
    
    // WebLLM will be injected here later
    this.llm = null;
    this.llmEnabled = false;
    
    // Configuration
    this.config = {
      // When to use LLM vs normalizer
      useNormalizerFirst: options.useNormalizerFirst !== false,
      llmFallback: options.llmFallback !== false,
      llmTimeout: options.llmTimeout || 3000, // 3 second max
      
      // Complexity thresholds
      simpleCommandMaxWords: options.simpleCommandMaxWords || 5,
      
      // Feature flags
      enableLLM: options.enableLLM || false,
      enableLogging: options.enableLogging !== false
    };

    console.log('[IntentResolver] Initialized. LLM enabled:', this.config.enableLLM);
  }

  /**
   * Main entry point - resolve intent from text
   * This is what popup.js will call
   */
  async resolve(text, context = {}) {
    const startTime = Date.now();
    
    this.log('Resolving:', text);

    // STEP 1: Quick check with normalizer
    if (this.config.useNormalizerFirst) {
      const normalizerResult = this.normalizer.normalize(text);
      
      // If normalizer found a good match, use it (fast path)
      if (normalizerResult.intent !== 'unknown' && normalizerResult.confidence > 0.7) {
        this.log('✅ Normalizer resolved (fast):', normalizerResult.intent);
        
        return {
          source: 'normalizer',
          intent: normalizerResult.intent,
          slots: normalizerResult.slots,
          original: text,
          confidence: normalizerResult.confidence,
          processingTime: Date.now() - startTime
        };
      }
    }

    // STEP 2: Try WebLLM if enabled and available
    if (this.llmEnabled && this.llm) {
      this.log('⚡ Trying WebLLM...');
      
      try {
        const llmResult = await this.resolveLLM(text, context);
        
        if (llmResult && llmResult.intent !== 'unknown') {
          this.log('✅ WebLLM resolved:', llmResult.intent);
          
          return {
            source: 'llm',
            intent: llmResult.intent,
            slots: llmResult.slots,
            original: text,
            confidence: llmResult.confidence || 0.9,
            reasoning: llmResult.reasoning,
            processingTime: Date.now() - startTime
          };
        }
      } catch (err) {
        console.error('[IntentResolver] LLM error:', err);
        // Fall through to normalizer fallback
      }
    }

    // STEP 3: Fallback to normalizer result (even if unknown)
    const normalizerResult = this.normalizer.normalize(text);
    
    this.log('⚠️ Fallback to normalizer:', normalizerResult.intent);
    
    return {
      source: 'normalizer_fallback',
      intent: normalizerResult.intent,
      slots: normalizerResult.slots,
      original: text,
      confidence: normalizerResult.confidence,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Resolve using WebLLM (placeholder for next sprint)
   * This will be implemented when WebLLM is added
   */
  async resolveLLM(text, context) {
    if (!this.llm) {
      throw new Error('WebLLM not initialized');
    }

    // TODO: Next sprint - implement WebLLM call
    // For now, this is a placeholder that shows the interface
    
    const prompt = this.buildLLMPrompt(text, context);
    
    // Race between LLM and timeout
    const llmPromise = this.llm.processIntent(prompt);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM timeout')), this.config.llmTimeout)
    );
    
    const result = await Promise.race([llmPromise, timeoutPromise]);
    
    return this.parseLLMResponse(result);
  }

  /**
   * Build prompt for WebLLM (ready for next sprint)
   */
  buildLLMPrompt(text, context) {
    // This will be the prompt sent to WebLLM
    return {
      userCommand: text,
      context: {
        previousCommand: context.previousCommand || null,
        currentUrl: context.currentUrl || null,
        timestamp: Date.now()
      },
      instructions: `
You are a voice command interpreter for a web accessibility assistant.
Analyze the user's command and return a structured intent.

Available intents:
- navigate: scroll, go back, go to top/bottom
- zoom: zoom in/out, reset zoom
- link_action: list links, open link by number
- read: read page, stop reading, pause, resume
- find_content: find/search for text
- help: show help
- stop: interrupt current action

Return JSON format:
{
  "intent": "navigate",
  "slots": {"direction": "down"},
  "confidence": 0.95,
  "reasoning": "User wants to scroll down the page"
}

User command: "${text}"
`.trim()
    };
  }

  /**
   * Parse WebLLM response (ready for next sprint)
   */
  parseLLMResponse(response) {
    // WebLLM should return structured JSON
    // This parses it into our format
    
    try {
      if (typeof response === 'string') {
        response = JSON.parse(response);
      }
      
      return {
        intent: response.intent || 'unknown',
        slots: response.slots || {},
        confidence: response.confidence || 0.8,
        reasoning: response.reasoning || null
      };
    } catch (err) {
      console.error('[IntentResolver] Failed to parse LLM response:', err);
      return null;
    }
  }

  /**
   * Check if command should use LLM based on complexity
   */
  isComplexCommand(text) {
    const wordCount = text.trim().split(/\s+/).length;
    
    // Simple heuristics (can be improved)
    const complexIndicators = [
      wordCount > this.config.simpleCommandMaxWords,
      /\b(find|search|locate|show me|where is)\b/i.test(text),
      /\b(and then|after that|next)\b/i.test(text), // Multi-step
      /\?/.test(text), // Questions
      text.length > 50 // Long text
    ];
    
    return complexIndicators.filter(Boolean).length >= 2;
  }

  /**
   * Initialize WebLLM (next sprint)
   */
  async initializeLLM(llmInstance) {
    console.log('[IntentResolver] Initializing WebLLM...');
    
    try {
      this.llm = llmInstance;
      
      // Wait for LLM to be ready
      if (this.llm.initialize) {
        await this.llm.initialize();
      }
      
      this.llmEnabled = true;
      this.config.enableLLM = true;
      
      console.log('[IntentResolver] ✅ WebLLM ready');
      return true;
      
    } catch (err) {
      console.error('[IntentResolver] Failed to initialize WebLLM:', err);
      this.llmEnabled = false;
      return false;
    }
  }

  /**
   * Disable WebLLM (fallback to normalizer only)
   */
  disableLLM() {
    console.log('[IntentResolver] Disabling WebLLM');
    this.llmEnabled = false;
    this.config.enableLLM = false;
  }

  /**
   * Enable WebLLM
   */
  enableLLM() {
    if (!this.llm) {
      console.warn('[IntentResolver] Cannot enable LLM - not initialized');
      return false;
    }
    
    console.log('[IntentResolver] Enabling WebLLM');
    this.llmEnabled = true;
    this.config.enableLLM = true;
    return true;
  }

  /**
   * Get suggestions from normalizer
   */
  getSuggestions(text) {
    return this.normalizer.getSuggestions(text);
  }

  /**
   * Get all available commands
   */
  getAllCommands() {
    return this.normalizer.getAllCommands();
  }

  /**
   * Get resolver stats
   */
  getStats() {
    return {
      llmEnabled: this.llmEnabled,
      llmAvailable: !!this.llm,
      normalizerPatterns: Object.keys(this.normalizer.commandPatterns || {}).length,
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[IntentResolver] Config updated:', this.config);
  }

  /**
   * Logging helper
   */
  log(...args) {
    if (this.config.enableLogging) {
      console.log('[IntentResolver]', ...args);
    }
  }
}

/**
 * Singleton instance
 */
let resolverInstance = null;

export function getIntentResolver(options) {
  if (!resolverInstance) {
    resolverInstance = new IntentResolver(options);
  }
  return resolverInstance;
}

export default IntentResolver;