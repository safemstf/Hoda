/**
 * JSON format definitions for STT/TTS integration
 * Author: syedhaliz
 */

/**
 * Input format from STT (Speech-to-Text) service
 *
 * @typedef {Object} STTInput
 * @property {string} text - The transcribed text from speech
 * @property {number} confidence - STT confidence score (0-1)
 * @property {string} [language] - Language code (e.g., 'en-US')
 * @property {number} [timestamp] - When the speech was captured
 * @property {Object} [context] - Optional page context information
 */
export const STT_INPUT_SCHEMA = {
  text: "string (required)",
  confidence: "number (required, 0-1)",
  language: "string (optional, e.g., 'en-US')",
  timestamp: "number (optional)",
  context: "object (optional)"
};

/**
 * Example STT input
 */
export const STT_INPUT_EXAMPLE = {
  text: "scroll down the page",
  confidence: 0.95,
  language: "en-US",
  timestamp: Date.now(),
  context: {
    url: "https://example.com",
    title: "Example Page"
  }
};

/**
 * Output format for TTS (Text-to-Speech) service
 *
 * @typedef {Object} TTSOutput
 * @property {string} text - The text to be spoken
 * @property {string} action - The action being performed
 * @property {boolean} success - Whether the intent was understood
 * @property {Object} intent - The parsed intent details
 * @property {number} confidence - Confidence in the interpretation
 * @property {boolean} requiresConfirmation - Whether user confirmation is needed
 * @property {string} [confirmationPrompt] - What to ask for confirmation
 */
export const TTS_OUTPUT_SCHEMA = {
  text: "string (required) - message to speak",
  action: "string (required) - action name",
  success: "boolean (required)",
  intent: "object (required) - parsed intent",
  confidence: "number (required, 0-1)",
  requiresConfirmation: "boolean (required)",
  confirmationPrompt: "string (optional)"
};

/**
 * Example TTS output
 */
export const TTS_OUTPUT_EXAMPLE = {
  text: "Scrolling down",
  action: "navigate",
  success: true,
  intent: {
    intent: "navigate",
    slots: { direction: "down" },
    confidence: 0.95
  },
  confidence: 0.95,
  requiresConfirmation: false
};

/**
 * Validation functions
 */

export function validateSTTInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid STT input: must be an object');
  }

  if (typeof input.text !== 'string' || !input.text.trim()) {
    throw new Error('Invalid STT input: text is required and must be a non-empty string');
  }

  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Invalid STT input: confidence must be a number between 0 and 1');
  }

  return true;
}

export function validateTTSOutput(output) {
  if (!output || typeof output !== 'object') {
    throw new Error('Invalid TTS output: must be an object');
  }

  if (typeof output.text !== 'string') {
    throw new Error('Invalid TTS output: text is required and must be a string');
  }

  if (typeof output.action !== 'string') {
    throw new Error('Invalid TTS output: action is required and must be a string');
  }

  if (typeof output.success !== 'boolean') {
    throw new Error('Invalid TTS output: success is required and must be a boolean');
  }

  if (!output.intent || typeof output.intent !== 'object') {
    throw new Error('Invalid TTS output: intent is required and must be an object');
  }

  if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
    throw new Error('Invalid TTS output: confidence must be a number between 0 and 1');
  }

  if (typeof output.requiresConfirmation !== 'boolean') {
    throw new Error('Invalid TTS output: requiresConfirmation is required and must be a boolean');
  }

  return true;
}
