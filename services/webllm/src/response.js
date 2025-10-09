/**
 * Response generation for TTS consumption
 * Converts parsed intents into natural, speakable responses
 * Author: syedhaliz
 */

import { INTENT_SCHEMAS } from './intents.js';

/**
 * Response templates for each intent type
 * Keep responses concise (≤3 words for confirmations)
 */
const RESPONSE_TEMPLATES = {
  navigate: {
    scroll: {
      down: "Scrolling down",
      up: "Scrolling up",
      top: "Going to top",
      bottom: "Going to bottom"
    },
    back: "Going back",
    forward: "Going forward",
    default: "Navigating"
  },

  read: {
    start: "Reading page",
    stop: "Stopped reading",
    pause: "Paused",
    resume: "Resuming",
    default: "Reading"
  },

  form_action: {
    fill: "Filling field",
    submit: "Ready to submit. Confirm?",
    select: "Selecting option",
    default: "Form action"
  },

  zoom: {
    in: "Zooming in",
    out: "Zooming out",
    reset: "Reset zoom",
    increase: "Increasing size",
    decrease: "Decreasing size",
    default: "Adjusting zoom"
  },

  find_content: {
    found: "Found: {target}",
    searching: "Searching for {query}",
    notFound: "Not found: {query}",
    default: "Searching"
  },

  link_action: {
    list: "Listing links",
    open: "Opening {target}",
    click: "Clicking {target}",
    default: "Link action"
  },

  help: {
    default: "I can help with navigation, reading, forms, zoom, finding content, and links. What would you like?"
  },

  unknown: {
    default: "I didn't understand. Please try again."
  }
};

/**
 * Error response templates
 */
const ERROR_RESPONSES = {
  lowConfidence: "I'm not sure I understood. Did you say {text}?",
  noIntent: "I didn't catch that. Please try again.",
  error: "Sorry, something went wrong."
};

/**
 * Generate a natural language response for TTS
 */
export function generateResponse(parseResult) {
  const { intent, originalText } = parseResult;
  const { intent: intentType, slots, confidence, requiresConfirmation } = intent;

  // Handle unknown or low confidence
  if (intentType === 'unknown' || confidence < 0.6) {
    return {
      text: ERROR_RESPONSES.lowConfidence.replace('{text}', originalText),
      action: 'clarify',
      success: false,
      intent: intent,
      confidence: confidence,
      requiresConfirmation: false
    };
  }

  // Generate response text
  let responseText = generateResponseText(intentType, slots, requiresConfirmation);

  // Add confirmation prompt if needed
  let confirmationPrompt = null;
  if (requiresConfirmation) {
    confirmationPrompt = `Are you sure you want to ${intentType.replace('_', ' ')}?`;
  }

  return {
    text: responseText,
    action: intentType,
    success: true,
    intent: intent,
    confidence: confidence,
    requiresConfirmation: requiresConfirmation,
    ...(confirmationPrompt && { confirmationPrompt })
  };
}

/**
 * Generate response text based on intent and slots
 */
function generateResponseText(intentType, slots, requiresConfirmation) {
  const templates = RESPONSE_TEMPLATES[intentType] || RESPONSE_TEMPLATES.unknown;

  switch (intentType) {
    case 'navigate':
      if (slots.direction) {
        return templates.scroll[slots.direction] || templates.scroll.default || templates.default;
      }
      if (slots.action === 'back') return templates.back;
      if (slots.action === 'forward') return templates.forward;
      return templates.default;

    case 'read':
      if (slots.action) {
        return templates[slots.action] || templates.default;
      }
      return templates.start;

    case 'form_action':
      if (requiresConfirmation) {
        return templates.submit;
      }
      if (slots.action) {
        return templates[slots.action] || templates.default;
      }
      return templates.default;

    case 'zoom':
      if (slots.action) {
        return templates[slots.action] || templates.default;
      }
      return templates.default;

    case 'find_content':
      if (slots.query) {
        return templates.searching.replace('{query}', slots.query);
      }
      return templates.default;

    case 'link_action':
      if (slots.target) {
        return templates.open.replace('{target}', slots.target);
      }
      if (slots.action === 'list') {
        return templates.list;
      }
      return templates.default;

    case 'help':
      return templates.default;

    default:
      return RESPONSE_TEMPLATES.unknown.default;
  }
}

/**
 * Generate confirmation response
 */
export function generateConfirmationResponse(intent, confirmed) {
  if (confirmed) {
    return {
      text: "Confirmed",
      action: intent.intent,
      success: true,
      intent: intent,
      confidence: 1.0,
      requiresConfirmation: false
    };
  } else {
    return {
      text: "Cancelled",
      action: 'cancel',
      success: false,
      intent: intent,
      confidence: 1.0,
      requiresConfirmation: false
    };
  }
}

/**
 * Generate error response
 */
export function generateErrorResponse(error, originalText = '') {
  return {
    text: ERROR_RESPONSES.error,
    action: 'error',
    success: false,
    intent: {
      intent: 'unknown',
      slots: {},
      confidence: 0,
      requiresConfirmation: false
    },
    confidence: 0,
    requiresConfirmation: false,
    error: error.message
  };
}
