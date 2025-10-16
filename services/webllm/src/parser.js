/**
 * WebLLM-based intent parser for natural language accessibility commands
 */

import * as webllm from '@mlc-ai/web-llm';
import { INTENT_SCHEMAS } from './intents.js';

export class IntentParser {
  constructor(privacyManager, config = {}) {
    this.privacyManager = privacyManager;
    this.config = {
      modelId: config.modelId || 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      temperature: config.temperature || 0.2,
      maxTokens: config.maxTokens || 150
    };
    this.engine = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the WebLLM engine
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.privacyManager.validateLocalMode('local-webllm');

    console.log(`Initializing WebLLM with model: ${this.config.modelId}`);

    this.engine = await webllm.CreateMLCEngine(this.config.modelId, {
      initProgressCallback: (progress) => {
        console.log(`Loading model: ${progress.text}`);
      }
    });

    this.isInitialized = true;
    console.log('WebLLM engine initialized successfully');
  }

  /**
   * Parse natural language text into structured intent
   */
  async parseIntent(text, pageContext = null) {
    if (!this.isInitialized || !this.engine) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    const prompt = this.buildPrompt(text, pageContext);

    const startTime = Date.now();
    const response = await this.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    const processingTime = Date.now() - startTime;
    console.log(`Processing time: ${processingTime}ms`);

    const result = this.parseResponse(response.choices[0].message.content || '{}');

    return {
      intent: result,
      originalText: text,
      timestamp: Date.now()
    };
  }

  /**
   * Build the prompt for intent recognition
   */
  buildPrompt(text, pageContext = null) {
    return `You are an intent classifier for accessibility commands. Classify the user's command into one of these intents:

INTENTS:
1. navigate - scrolling, going back/forward, page navigation
2. read - reading page content, stopping/pausing/resuming reading
3. find_content - finding buttons, links, text, searching
4. zoom - making text bigger/smaller, zooming in/out
5. form_action - filling forms, submitting, entering text
6. link_action - clicking links, listing links, opening links
7. help - asking for help, listing commands

EXAMPLES:
Input: "scroll down"
Output: {"intent": "navigate", "slots": {"direction": "down"}, "confidence": 0.95, "requiresConfirmation": false}

Input: "read this page"
Output: {"intent": "read", "slots": {"action": "start"}, "confidence": 0.95, "requiresConfirmation": false}

Input: "find login button"
Output: {"intent": "find_content", "slots": {"query": "login button"}, "confidence": 0.95, "requiresConfirmation": false}

Input: "make text bigger"
Output: {"intent": "zoom", "slots": {"action": "in"}, "confidence": 0.95, "requiresConfirmation": false}

Input: "submit form"
Output: {"intent": "form_action", "slots": {"action": "submit"}, "confidence": 0.95, "requiresConfirmation": true}

Input: "list all links"
Output: {"intent": "link_action", "slots": {"action": "list"}, "confidence": 0.95, "requiresConfirmation": false}

Input: "help"
Output: {"intent": "help", "slots": {}, "confidence": 0.95, "requiresConfirmation": false}

Now classify this command. Return ONLY valid JSON with no extra text.

Input: "${text}"
Output:`;
  }

  /**
   * Parse the LLM response into an Intent object
   */
  parseResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        intent: parsed.intent || 'unknown',
        slots: parsed.slots || {},
        confidence: parsed.confidence || 0.5,
        requiresConfirmation: parsed.requiresConfirmation || false
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return {
        intent: 'unknown',
        slots: {},
        confidence: 0.0,
        requiresConfirmation: false
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.engine) {
      // WebLLM doesn't have explicit cleanup, but we can null the reference
      this.engine = null;
      this.isInitialized = false;
    }
  }
}
