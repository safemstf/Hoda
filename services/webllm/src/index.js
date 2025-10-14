/**
 * WebLLM Service - Main entry point
 * Local-first natural language processing for accessibility commands
 * Author: syedhaliz
 */

// Core exports
export { IntentParser } from './parser.js';
export { INTENT_SCHEMAS } from './intents.js';
export { PrivacyManager } from './privacy.js';

// Integration API exports
export { WebLLMService, createService, processCommand } from './integration.js';

// Format exports
export {
  STT_INPUT_SCHEMA,
  STT_INPUT_EXAMPLE,
  TTS_OUTPUT_SCHEMA,
  TTS_OUTPUT_EXAMPLE,
  validateSTTInput,
  validateTTSOutput
} from './formats.js';

// Response generation exports
export {
  generateResponse,
  generateConfirmationResponse,
  generateErrorResponse
} from './response.js';

// Legacy API support
import { IntentParser } from './parser.js';
import { PrivacyManager } from './privacy.js';

/**
 * Create and initialize a new IntentParser instance (legacy)
 */
export async function createParser(privacySettings = {}, parserConfig = {}) {
  const privacyManager = new PrivacyManager(privacySettings);
  const parser = new IntentParser(privacyManager, parserConfig);
  await parser.initialize();
  return parser;
}

/**
 * Main API function for analyzing accessibility utterances (legacy)
 */
export async function analyzeAccessibilityUtterance(text, pageContext = null, parser = null) {
  if (!parser) {
    throw new Error('Parser instance required. Use createParser() first.');
  }

  return await parser.parseIntent(text, pageContext);
}
