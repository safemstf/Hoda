/**
 * Intent Resolver - Smart routing between CommandNormalizer and WebLLM
 * WebLLM loads dynamically in background
 */

import { CommandNormalizer } from './commandNormalizer.js';

export class IntentResolver {
  constructor(options = {}) {
    this.normalizer = new CommandNormalizer();
    
    // WebLLM instance (auto-loads in background)
    this.llm = null;
    this.llmEnabled = false;
    this.llmLoading = false;
    this.llmLoadError = null;
    
    this.config = {
      useNormalizerFirst: options.useNormalizerFirst !== false,
      llmFallback: options.llmFallback !== false,
      llmTimeout: options.llmTimeout || 5000,
      simpleCommandMaxWords: options.simpleCommandMaxWords || 5,
      enableLLM: options.enableLLM !== false,
      autoLoadLLM: options.autoLoadLLM !== false,
      enableLogging: options.enableLogging !== false,
      
      privacy: options.privacy || {
        enableAnalytics: false,
        enableLogging: true,
        allowRemoteModels: false
      }
    };

    console.log('[IntentResolver] Initialized. Auto-loading LLM:', this.config.autoLoadLLM);

    // ✅ AUTO-LOAD WebLLM in background immediately
    if (this.config.autoLoadLLM && this.config.enableLLM) {
      this.startBackgroundLoad();
    }
  }

  startBackgroundLoad() {
    console.log('[IntentResolver] 🔄 Starting background WebLLM load...');
    
    this.loadWebLLM().then(() => {
      console.log('[IntentResolver] ✅ Background load complete');
    }).catch(err => {
      console.error('[IntentResolver] ❌ Background load failed:', err);
    });
  }

  async loadWebLLM() {
    if (this.llm && this.llmEnabled) {
      console.log('[IntentResolver] WebLLM already loaded');
      return true;
    }

    if (this.llmLoading) {
      console.log('[IntentResolver] ⏳ WebLLM already loading, waiting...');
      
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.llmLoading) {
            clearInterval(checkInterval);
            resolve(this.llm !== null);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 60000);
      });
    }

    this.llmLoading = true;
    console.log('[IntentResolver] 🚀 Loading WebLLM...');

    try {
      const startTime = Date.now();

      const isCached = await this.isWebLLMCached();
      if (isCached) {
        console.log('[IntentResolver] ⚡ Loading from cache...');
      } else {
        console.log('[IntentResolver] 📥 Downloading model (10-30s)...');
      }

      // ✅ DYNAMIC IMPORT - loads at runtime, not module load time
      const { createService } = await import('../../webllm/src/index.js');
      
      // Create WebLLM service
      this.llm = await createService(this.config.privacy);
      
      const loadTime = Date.now() - startTime;
      console.log(`[IntentResolver] ✅ WebLLM loaded in ${loadTime}ms (${isCached ? 'cached' : 'downloaded'})`);

      this.llmEnabled = true;
      this.llmLoading = false;
      this.llmLoadError = null;

      try {
        await chrome.storage.local.set({
          webllmReady: true,
          webllmLastLoad: Date.now(),
          webllmLoadTime: loadTime,
          webllmCached: isCached
        });
      } catch (e) {
        // Ignore storage errors
      }

      return true;

    } catch (err) {
      console.error('[IntentResolver] ❌ Failed to load WebLLM:', err);
      this.llmLoadError = err.message;
      this.llmLoading = false;
      this.llmEnabled = false;
      this.llm = null;
      
      try {
        await chrome.storage.local.set({
          webllmReady: false,
          webllmLoadError: err.message
        });
      } catch (e) {
        // Ignore
      }
      
      return false;
    }
  }

  async isWebLLMCached() {
    try {
      const databases = await indexedDB.databases();
      const hasCache = databases.some(db => 
        db.name.includes('webllm') || 
        db.name.includes('mlc') || 
        db.name.includes('tvmjs')
      );
      
      return hasCache;
    } catch (error) {
      console.warn('[IntentResolver] Could not check cache:', error);
      return false;
    }
  }

  async resolve(text, context = {}) {
    const startTime = Date.now();
    
    this.log('Resolving:', text);

    // STEP 1: Quick check with normalizer (fast path)
    if (this.config.useNormalizerFirst) {
      const normalizerResult = this.normalizer.normalize(text);
      
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

    // STEP 2: Normalizer failed - try WebLLM
    if (this.config.enableLLM) {
      this.log('⚠️ Normalizer failed, checking WebLLM...');
      
      try {
        if (this.llm && this.llmEnabled) {
          this.log('⚡ WebLLM available, using it...');
          
          const llmResult = await this.resolveLLM(text, context);
          
          if (llmResult && llmResult.intent !== 'unknown') {
            this.log('✅ WebLLM resolved:', llmResult.intent);
            
            return {
              source: 'llm',
              intent: llmResult.intent,
              slots: llmResult.slots || {},
              original: text,
              confidence: llmResult.confidence || 0.9,
              reasoning: llmResult.reasoning,
              processingTime: Date.now() - startTime
            };
          }
        } else if (this.llmLoading) {
          this.log('⏳ WebLLM still loading, returning unknown for now...');
        } else if (this.llmLoadError) {
          this.log('❌ WebLLM failed to load:', this.llmLoadError);
        } else {
          this.log('⚠️ WebLLM not loaded yet');
        }
      } catch (err) {
        console.error('[IntentResolver] WebLLM error:', err);
      }
    }

    // STEP 3: Both failed - return normalizer result (unknown)
    const normalizerResult = this.normalizer.normalize(text);
    
    this.log('❌ Returning unknown:', {
      llmAvailable: !!this.llm,
      llmLoading: this.llmLoading,
      llmError: this.llmLoadError
    });
    
    return {
      source: 'normalizer_fallback',
      intent: normalizerResult.intent,
      slots: normalizerResult.slots,
      original: text,
      confidence: normalizerResult.confidence,
      processingTime: Date.now() - startTime,
      llmStatus: {
        available: !!this.llm,
        loading: this.llmLoading,
        error: this.llmLoadError
      }
    };
  }

  async resolveLLM(text, context) {
    if (!this.llm) {
      throw new Error('WebLLM not initialized');
    }

    this.log('⚡ Calling WebLLM...');
    
    try {
      const llmResult = await Promise.race([
        this.llm.processCommand(text, {
          url: context.url || context.currentUrl,
          context: {
            previousCommand: context.previousCommand,
            recentTranscripts: context.recentTranscripts
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LLM timeout')), this.config.llmTimeout)
        )
      ]);
      
      return llmResult;
      
    } catch (err) {
      if (err.message === 'LLM timeout') {
        this.log('⏱️ WebLLM timed out');
      }
      throw err;
    }
  }

  isComplexCommand(text) {
    const wordCount = text.trim().split(/\s+/).length;
    
    const complexIndicators = [
      wordCount > this.config.simpleCommandMaxWords,
      /\b(find|search|locate|show me|where is)\b/i.test(text),
      /\b(and then|after that|next)\b/i.test(text),
      /\?/.test(text),
      text.length > 50
    ];
    
    return complexIndicators.filter(Boolean).length >= 2;
  }

  async initializeLLM(llmInstance = null) {
    console.log('[IntentResolver] initializeLLM called');
    
    if (llmInstance) {
      this.llm = llmInstance;
      this.llmEnabled = true;
      this.config.enableLLM = true;
      console.log('[IntentResolver] ✅ WebLLM ready (injected)');
      return true;
    }
    
    return await this.loadWebLLM();
  }

  disableLLM() {
    console.log('[IntentResolver] Disabling WebLLM');
    this.llmEnabled = false;
    this.config.enableLLM = false;
  }

  enableLLM() {
    console.log('[IntentResolver] Enabling WebLLM');
    this.config.enableLLM = true;
    
    if (this.llm) {
      this.llmEnabled = true;
      return true;
    }
    
    if (!this.llmLoading && !this.llmLoadError) {
      this.startBackgroundLoad();
    }
    
    return false;
  }

  getSuggestions(text) {
    return this.normalizer.getSuggestions(text);
  }

  getAllCommands() {
    return this.normalizer.getAllCommands();
  }

  getStats() {
    return {
      llmEnabled: this.llmEnabled,
      llmAvailable: !!this.llm,
      llmLoading: this.llmLoading,
      llmLoadError: this.llmLoadError,
      normalizerPatterns: Object.keys(this.normalizer.commandPatterns || {}).length,
      config: this.config
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('[IntentResolver] Config updated:', this.config);
  }

  log(...args) {
    if (this.config.enableLogging) {
      console.log('[IntentResolver]', ...args);
    }
  }
}

export default IntentResolver;