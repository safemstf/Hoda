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
      temperature: config.temperature || 0.1,
      maxTokens: config.maxTokens || 200
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
    const intentList = Object.keys(INTENT_SCHEMAS)
      .map(key => {
        const schema = INTENT_SCHEMAS[key];
        return `- ${key}: ${schema.description}\n  Examples: ${schema.examples.join(', ')}`;
      })
      .join('\n');

    return `You are an accessibility assistant that interprets natural language commands for visually impaired users.

Available intents:
${intentList}

Task: Analyze the user's command and return a JSON object with this structure:
{
  "intent": "intent_name",
  "slots": { "key": "value" },
  "confidence": 0.0-1.0,
  "requiresConfirmation": true/false
}

Rules:
1. Choose the most appropriate intent from the list above
2. Extract relevant parameters into slots
3. Set confidence based on how clear the command is
4. Set requiresConfirmation to true for form submissions or navigation away from page
5. Return ONLY valid JSON, no additional text

User command: "${text}"

JSON response:`;
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
