/**
 * Intent Schemas - Clean, Logical, No Conflicts
 * Organized by action category with clear separation
 */

export const INTENT_SCHEMAS = {
  // ============================================================================
  // NAVIGATION: Moving within and between pages
  // ============================================================================
  navigate: {
    description: 'Navigation commands',
    slots: ['direction', 'amount', 'target'],
    examples: [
      // === SCROLL WITHIN PAGE ===
      // Incremental scrolling
      'scroll down',
      'scroll up',
      'page down',
      'page up',
      'down',        // Simple direction
      'up',          // Simple direction
      
      // Jump to page locations
      'scroll to top',
      'scroll to bottom',
      'top',         // Jump to top
      'bottom',      // Jump to bottom
      'go to top',
      'go to bottom',
      
      // === BROWSER HISTORY (Between pages) ===
      // Previous page in history
      'go back',
      'back',
      'previous page',
      'last page',
      
      // Next page in history (forward)
      'go forward',
      'forward', 
      'next page',
      
      // === PAGE ACTIONS ===
      // Reload current page
      'refresh',
      'reload',
      'refresh page',
      'reload page',
      
      // Go to site homepage
      'home',
      'go home',
      'home page'
    ]
  },

  // ============================================================================
  // READING: Text-to-speech controls
  // ============================================================================
  read: {
    description: 'Text-to-speech reading commands',
    slots: ['action', 'scope'],
    examples: [
      // Start reading
      'read page',
      'read this page',
      'read this',
      'start reading',
      'read from here',

      // Stop reading
      'stop reading',

      // Pause/Resume
      'pause',
      'pause reading',
      'resume',
      'resume reading',
      'continue reading',
      'continue',

      // Navigation
      'next paragraph',
      'previous paragraph',
      'skip paragraph',
      'back paragraph'
    ]
  },

  // ============================================================================
  // ZOOM: Page magnification
  // ============================================================================
  zoom: {
    description: 'Zoom and magnification commands',
    slots: ['action', 'amount'],
    examples: [
      // Zoom in
      'zoom in',
      'bigger',
      'make bigger',
      'increase size',
      
      // Zoom out
      'zoom out',
      'smaller',
      'make smaller',
      'decrease size',
      
      // Reset
      'reset zoom',
      'normal size',
      'default size'
    ]
  },

  // ============================================================================
  // LINKS: Link discovery and navigation
  // ============================================================================
  link_action: {
    description: 'Link interaction commands',
    slots: ['action', 'linkNumber', 'target'],
    examples: [
      // List links
      'list links',
      'show links',
      'what links',
      
      // Open by number
      'open link 1',
      'open link 2',
      'click link 1',
      
      // Open by name
      'open about',
      'click about'
    ]
  },

  // ============================================================================
  // FIND: Search within page
  // ============================================================================
  find_content: {
    description: 'Find text on current page',
    slots: ['query'],
    examples: [
      'find login',
      'search for contact',
      'where is submit',
      'locate menu'
    ]
  },

  // ============================================================================
  // STOP: Interrupt current action
  // ============================================================================
  stop: {
    description: 'Stop any current action',
    slots: [],
    examples: [
      'stop',
      'cancel',
      'halt'
    ]
  },

  // ============================================================================
  // HELP: Show available commands
  // ============================================================================
  help: {
    description: 'Help and command list',
    slots: [],
    examples: [
      'help',
      'what can you do',
      'show commands',
      'list commands'
    ]
  },

  // ============================================================================
  // FORM: Form interactions
  // ============================================================================
  form_action: {
    description: 'Form interaction commands',
    slots: ['action', 'field', 'value'],
    examples: [
      // Fill/Enter commands
      'fill username',
      'fill in username',
      'fill email',
      'enter password',
      'enter name',
      'type address',
      'type in message',
      'fill out form',
      'complete username',
      // Submit commands
      'submit',
      'submit form',
      'send form',
      'send',
      'post form',
      'submit the form',
      // Check/Select commands
      'check terms',
      'check the box',
      'check remember me',
      'uncheck subscribe',
      'select country',
      'select option',
      'choose shipping',
      'pick option',
      // List fields
      'list fields',
      'show fields',
      'what fields',
      'show form fields'
    ],
    requiresConfirmation: true
  }
};

/**
 * Intent priorities for command resolution
 * Higher priority = checked first
 */
export const INTENT_PRIORITIES = {
  stop: 100,        // Always check stop first
  help: 90,
  navigate: 80,     // Navigation is common
  read: 70,
  zoom: 60,
  link_action: 50,
  find_content: 40,
  form_action: 30
};

/**
 * Command mapping rules (for reference)
 * These guide how extractSlots() should interpret commands
 */
export const COMMAND_RULES = {
  // Scroll vs Browser Navigation
  scroll: {
    // ALWAYS scroll (never navigate between pages)
    triggers: ['scroll', 'page down', 'page up'],
    directions: {
      'down': 'scroll down',
      'up': 'scroll up',
      'top': 'jump to top',
      'bottom': 'jump to bottom'
    }
  },
  
  browser: {
    // ALWAYS browser history (never scroll)
    triggers: ['go back', 'go forward', 'previous page', 'next page', 'last page'],
    actions: {
      'back': 'history.back()',
      'forward': 'history.forward()',
      'previous page': 'history.back()',
      'next page': 'history.forward()'
    }
  },
  
  page: {
    // Page-level actions
    triggers: ['refresh', 'reload', 'home'],
    actions: {
      'refresh': 'location.reload()',
      'reload': 'location.reload()',
      'home': 'go to site root'
    }
  },
  
  ambiguous: {
    // Commands that need context
    'back': 'browser history back (NOT scroll up)',
    'forward': 'browser history forward (NOT scroll down)',
    'top': 'scroll to top of page',
    'bottom': 'scroll to bottom of page',
    'down': 'scroll down page',
    'up': 'scroll up page'
  }
};

// Export helpers
export function getIntentPriority(intent) {
  return INTENT_PRIORITIES[intent] || 0;
}

export function getAllIntents() {
  return Object.keys(INTENT_SCHEMAS);
}

export function getIntentSchema(intent) {
  return INTENT_SCHEMAS[intent] || null;
}

export function isValidIntent(intent) {
  return intent in INTENT_SCHEMAS;
}

export function getCommandRules() {
  return COMMAND_RULES;
}