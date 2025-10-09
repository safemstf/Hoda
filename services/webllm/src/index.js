/**
 * WebLLM Service - Main entry point
 * Local-first natural language processing for accessibility commands
 */

export { IntentParser } from './parser.js';
export { INTENT_SCHEMAS } from './intents.js';
export { PrivacyManager } from './privacy.js';

import { IntentParser } from './parser.js';
import { PrivacyManager } from './privacy.js';

/**
 * Create and initialize a new IntentParser instance
 */
export async function createParser(privacySettings = {}, parserConfig = {}) {
  const privacyManager = new PrivacyManager(privacySettings);
  const parser = new IntentParser(privacyManager, parserConfig);
  await parser.initialize();
  return parser;
}

/**
 * Main API function for analyzing accessibility utterances
 */
export async function analyzeAccessibilityUtterance(text, pageContext = null, parser = null) {
  if (!parser) {
    throw new Error('Parser instance required. Use createParser() first.');
  }

  return await parser.parseIntent(text, pageContext);
}
