/**
 * Intent types and schemas for accessibility commands
 */

/**
 * Intent schemas defining the structure for each intent type
 */
export const INTENT_SCHEMAS = {
  navigate: {
    description: 'Navigation commands (scroll, go back, forward, etc.)',
    slots: ['direction', 'amount', 'target'],
    examples: [
      'scroll down',
      'go back',
      'move page down',
      'page down',
      'scroll to top'
    ]
  },
  read: {
    description: 'Reading commands (read page, stop, pause, resume)',
    slots: ['target', 'action'],
    examples: [
      'read this page',
      'read to me',
      'what does this say',
      'stop reading',
      'pause'
    ]
  },
  form_action: {
    description: 'Form interaction commands',
    slots: ['action', 'field', 'value'],
    examples: [
      'fill in username',
      'submit form',
      'select option',
      'enter email address'
    ],
    requiresConfirmation: true
  },
  zoom: {
    description: 'Zoom and magnification commands',
    slots: ['action', 'amount'],
    examples: [
      'zoom in',
      'zoom out',
      'make text bigger',
      'increase size',
      'reset zoom'
    ]
  },
  find_content: {
    description: 'Find and search commands',
    slots: ['query', 'type'],
    examples: [
      'find login button',
      'where is sign in',
      'locate login',
      'find me articles about cooking',
      'search for contact'
    ]
  },
  link_action: {
    description: 'Link interaction commands',
    slots: ['action', 'target'],
    examples: [
      'list all links',
      'open first link',
      'click on about',
      'go to home page'
    ]
  },
  help: {
    description: 'Help and assistance commands',
    slots: [],
    examples: [
      'help',
      'what can you do',
      'list commands',
      'show me commands'
    ]
  }
};
