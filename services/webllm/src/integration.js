/**
 * Integration API for STT/TTS services
 * Main entry point for the WebLLM service in the extension
 * Author: syedhaliz
 */

import { IntentParser } from './parser.js';
import { PrivacyManager } from './privacy.js';
import { validateSTTInput, validateTTSOutput } from './formats.js';
import { generateResponse, generateErrorResponse } from './response.js';

/**
 * WebLLM Service - Main integration class
 */
export class WebLLMService {
  constructor(config = {}) {
    this.privacyManager = new PrivacyManager(config.privacy || {});
    this.parser = null;
    this.isInitialized = false;
    this.config = {
      modelId: config.modelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      temperature: config.temperature || 0.1,
      maxTokens: config.maxTokens || 200,
      minConfidence: config.minConfidence || 0.6
    };
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('[WebLLM Service] Initializing...');
    this.parser = new IntentParser(this.privacyManager, this.config);
    await this.parser.initialize();
    this.isInitialized = true;
    console.log('[WebLLM Service] Ready');
  }

  /**
   * Process input from STT service
   *
   * @param {Object} sttInput - Input from STT in standard format
   * @returns {Object} Output for TTS in standard format
   */
  async processCommand(sttInput) {
    try {
      // Validate input
      validateSTTInput(sttInput);

      // Ensure initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Parse the command
      const parseResult = await this.parser.parseIntent(
        sttInput.text,
        sttInput.context || null
      );

      // Generate response for TTS
      const ttsOutput = generateResponse(parseResult);

      // Validate output
      validateTTSOutput(ttsOutput);

      return ttsOutput;

    } catch (error) {
      console.error('[WebLLM Service] Error processing command:', error);
      return generateErrorResponse(error, sttInput?.text);
    }
  }

  /**
   * Batch process multiple commands
   */
  async processCommands(sttInputs) {
    const results = [];
    for (const input of sttInputs) {
      const result = await this.processCommand(input);
      results.push(result);
    }
    return results;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      model: this.config.modelId,
      privacyMode: this.privacyManager.isLocalOnly() ? 'local-only' : 'hybrid',
      ready: this.isInitialized
    };
  }

  /**
   * Update privacy settings
   */
  updatePrivacySettings(settings) {
    this.privacyManager.updateSettings(settings);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.parser) {
      await this.parser.cleanup();
    }
    this.isInitialized = false;
    console.log('[WebLLM Service] Cleaned up');
  }
}

/**
 * Create and initialize a WebLLM service instance
 */
export async function createService(config = {}) {
  const service = new WebLLMService(config);
  await service.initialize();
  return service;
}

/**
 * Simple function API for one-off commands
 */
export async function processCommand(sttInput, service = null) {
  if (!service) {
    throw new Error('Service instance required. Use createService() first.');
  }
  return await service.processCommand(sttInput);
}
