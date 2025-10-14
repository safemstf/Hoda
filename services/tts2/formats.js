/**
 * JSON format definitions for TTS integration (following webllm/src/formats.js)
 * Author: (your name)
 */

/**
 * Input format for TTS (Text-to-Speech) service
 *
 * @typedef {Object} TTSInput
 * @property {string} text - The text to be spoken
 * @property {string} [voice] - Voice selection (optional)
 * @property {string} [language] - Language code (optional)
 * @property {Object} [options] - Additional TTS options
 */
const TTS_INPUT_SCHEMA = {
  text: "string (required) - text to speak",
  voice: "string (optional) - voice selection",
  language: "string (optional) - language code, e.g., 'en-US'",
  options: "object (optional) - additional TTS options"
};

/**
 * Example TTS input
 */
const TTS_INPUT_EXAMPLE = {
  text: "Hello, how can I help you?",
  voice: "en-US-Wavenet-D",
  language: "en-US",
  options: {
    rate: 1.0,
    pitch: 0
  }
};

/**
 * Output format for TTS service
 *
 * @typedef {Object} TTSResult
 * @property {boolean} success - Whether the speech was generated
 * @property {string} [audioUrl] - URL or path to the generated audio
 * @property {string} [error] - Error message if failed
 * @property {Object} [meta] - Additional metadata
 */
const TTS_RESULT_SCHEMA = {
  success: "boolean (required)",
  audioUrl: "string (optional) - URL/path to audio",
  error: "string (optional) - error message",
  meta: "object (optional) - additional metadata"
};

/**
 * Example TTS result
 */
const TTS_RESULT_EXAMPLE = {
  success: true,
  audioUrl: "https://example.com/audio/hello.mp3",
  meta: {
    duration: 1.2,
    voice: "en-US-Wavenet-D"
  }
};

/**
 * Validation functions
 */
function validateTTSInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid TTS input: must be an object');
  }
  if (typeof input.text !== 'string' || !input.text.trim()) {
    throw new Error('Invalid TTS input: text is required and must be a non-empty string');
  }
  return true;
}

function validateTTSResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid TTS result: must be an object');
  }
  if (typeof result.success !== 'boolean') {
    throw new Error('Invalid TTS result: success is required and must be a boolean');
  }
  if (result.audioUrl && typeof result.audioUrl !== 'string') {
    throw new Error('Invalid TTS result: audioUrl must be a string if provided');
  }
  if (result.error && typeof result.error !== 'string') {
    throw new Error('Invalid TTS result: error must be a string if provided');
  }
  return true;
}

module.exports = {
  TTS_INPUT_SCHEMA,
  TTS_INPUT_EXAMPLE,
  TTS_RESULT_SCHEMA,
  TTS_RESULT_EXAMPLE,
  validateTTSInput,
  validateTTSResult
};
