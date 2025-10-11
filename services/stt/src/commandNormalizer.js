/**
 * Command Normalizer for Hoda Voice Extension
 * Handles command variations and maps to intent schemas
 * Single source of truth: Uses INTENT_SCHEMAS
 * Author: mustafa (iterated)
 */

import { INTENT_SCHEMAS } from './intents-temporary.js';

export class CommandNormalizer {
    constructor() {
        // Build synonyms FIRST (needed by generateVariations)
        this.synonyms = this.buildSynonymMap() || {};
        // Then build patterns (uses synonyms)
        this.commandPatterns = this.buildCommandPatternsFromIntents();
    }

    /**
     * Build command patterns directly from INTENT_SCHEMAS
     * Compiles and returns RegExp objects per action with deduplication and defensive checks.
     */
    buildCommandPatternsFromIntents() {
        const patterns = {};
        const schemas = INTENT_SCHEMAS || {};
        if (!INTENT_SCHEMAS) {
            console.warn('INTENT_SCHEMAS is undefined — using empty schemas. Check your import/export path for ./intents-temporary.js');
        }

        for (const [intentName, intentSchema] of Object.entries(schemas)) {
            patterns[intentName] = {};

            // Guard missing examples array
            const examples = Array.isArray(intentSchema?.examples) ? intentSchema.examples : [];
            examples.forEach((example) => {
                try {
                    // Defensive: skip bad examples
                    if (example === null || example === undefined) return;
                    if (typeof example !== 'string' && !(example instanceof RegExp)) return;

                    // Create variations for common patterns (returns array of strings or RegExp)
                    const rawVariations = this.generateVariations(example);

                    // Use the example text as the action name (cleaned up)
                    const actionName = this.exampleToActionName(example);

                    if (!patterns[intentName][actionName]) {
                        patterns[intentName][actionName] = [];
                    }

                    const compiled = patterns[intentName][actionName];

                    // Add/compile all variations as RegExp patterns, dedupe by source+flags
                    const seen = new Set(compiled.map(r => `${r.source}::${r.flags}`));
                    rawVariations.forEach(variation => {
                        let regex;
                        if (variation instanceof RegExp) {
                            regex = variation;
                        } else {
                            // variation is a string: decide if it's intended as a raw-regex or a literal
                            const s = String(variation).trim();
                            // Heuristic: treat patterns with common regex tokens as raw regex
                            const looksLikeRegex = /\\d|\\.|\.\+|\(|\)|\?|\[|\]|\{|\}|\|/.test(s);
                            if (looksLikeRegex) {
                                try {
                                    // anchor loosely (allow in-sentence matches) but case-insensitive
                                    regex = new RegExp(s, 'i');
                                } catch (e) {
                                    // fall back to escaped literal
                                    regex = new RegExp('\\b' + this.escapeRegex(s) + '\\b', 'i');
                                }
                            } else {
                                // treat as literal phrase, add word boundaries to reduce false positives
                                const src = '\\b' + this.escapeRegex(s) + '\\b';
                                regex = new RegExp(src, 'i');
                            }
                        }

                        const key = `${regex.source}::${regex.flags}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            compiled.push(regex);
                        }
                    });
                } catch (err) {
                    console.error(`Error building patterns for intent "${intentName}" example:`, example, err);
                    // continue building other patterns
                }
            });
        }

        return patterns;
    }

    /**
     * Convert example command to action name
     * "scroll down" -> "scrollDown"
     */
    exampleToActionName(example) {
        // guard
        const ex = String(example || '').toLowerCase();
        return ex
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    /**
     * Generate variations for a command
     * Returns an array of strings or regex-like strings (not compiled)
     */
    generateVariations(example) {
        // Defensive guards: if example undefined/null, return empty list
        if (example === null || example === undefined) return [];

        const exampleStr = String(example).trim();
        if (!exampleStr) return [];

        const lowerExample = exampleStr.toLowerCase();

        // Start with original (raw string). We'll decide escaping/regex later in builder.
        const variations = [exampleStr];

        // Apply synonym substitutions - guard synonyms
        for (const [word, synonyms] of Object.entries(this.synonyms || {})) {
            if (typeof word !== 'string' || !Array.isArray(synonyms)) continue;
            if (lowerExample.includes(word)) {
                synonyms.forEach(synonym => {
                    const variant = lowerExample.replace(word, synonym);
                    variations.push(variant);
                });
            }
        }

        // Add common variations for specific patterns (strings, some with regex tokens intentionally)
        if (lowerExample.includes('scroll down')) {
            variations.push('go down', 'move down', 'page down', 'down');
        }
        if (lowerExample.includes('scroll up')) {
            variations.push('go up', 'move up', 'page up', 'up');
        }
        if (lowerExample.includes('scroll to top')) {
            variations.push('go to top', 'top of page', 'beginning', 'scroll all the way up');
        }
        if (lowerExample.includes('go back')) {
            variations.push('back', 'previous page', 'navigate back');
        }
        if (lowerExample.includes('zoom in')) {
            variations.push('make bigger', 'make it bigger', 'make text bigger', 'increase size', 'enlarge', 'bigger');
        }
        if (lowerExample.includes('zoom out')) {
            variations.push('make smaller', 'make it smaller', 'decrease size', 'reduce', 'smaller');
        }
        if (lowerExample.includes('reset zoom')) {
            variations.push('normal size', 'default size', 'normal zoom', 'default zoom', '100 percent');
        }
        if (lowerExample.includes('read')) {
            variations.push('read to me', 'start reading', 'read it', 'what does this say', 'what does it say');
        }
        if (lowerExample.includes('stop')) {
            variations.push('stop reading', 'be quiet', 'silence');
        }
        if (lowerExample.includes('pause')) {
            variations.push('pause reading', 'hold on', 'wait');
        }
        if (lowerExample.includes('list') && lowerExample.includes('link')) {
            variations.push('show links', 'show all links', 'what are the links', 'available links');
        }
        // these are intentionally regex-like strings to capture numbers/queries
        if (lowerExample.includes('open') && lowerExample.includes('link')) {
            variations.push('open link (\\d+)', 'click link (\\d+)', 'go to link (\\d+)', 'follow link (\\d+)');
        }
        if (lowerExample.includes('find')) {
            variations.push('find (.+)', 'search for (.+)', 'look for (.+)', 'where is (.+)', 'locate (.+)');
        }
        if (lowerExample.includes('click')) {
            variations.push('click (.+)', 'press (.+)', 'select (.+)');
        }
        if (lowerExample === 'help') {
            variations.push('what can you do', 'show commands', 'list commands', 'how do i', 'instructions');
        }

        // dedupe simple string list while preserving order
        const seen = new Set();
        const deduped = [];
        for (const v of variations) {
            const key = String(v);
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(v);
            }
        }

        return deduped;
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(str) {
        // Coerce to string to prevent errors when undefined/null is passed
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Build synonym map for better matching
     */
    buildSynonymMap() {
        return {
            scroll: ['move', 'navigate', 'go'],
            click: ['press', 'select', 'tap', 'open'],
            read: ['speak', 'say', 'tell'],
            stop: ['end', 'quit', 'cancel', 'close'],
            pause: ['hold', 'wait'],
            resume: ['continue', 'proceed', 'keep going'],
            zoom: ['magnify', 'size', 'scale'],
            find: ['search', 'locate', 'look for'],
            bigger: ['larger', 'increase', 'enlarge'],
            smaller: ['decrease', 'reduce', 'shrink']
        };
    }

    /**
     * Normalize command text
     * Handles variations and returns standardized command
     */
    normalize(text) {
        // Clean up text
        const cleaned = String(text || '').toLowerCase().trim();

        // Try to match against patterns
        const matched = this.matchCommand(cleaned);

        if (matched) {
            return {
                original: text,
                normalized: matched.command,
                intent: matched.intent,
                slots: matched.slots,
                confidence: matched.confidence
            };
        }

        // No match found
        return {
            original: text,
            normalized: cleaned,
            intent: 'unknown',
            slots: {},
            confidence: 0
        };
    }

    /**
     * Match command against patterns
     */
    matchCommand(text) {
        // Check each intent type
        for (const [intentType, actions] of Object.entries(this.commandPatterns || {})) {
            for (const [actionName, patterns] of Object.entries(actions || {})) {
                for (const pattern of patterns) {
                    try {
                        const match = text.match(pattern);
                        if (match) {
                            return {
                                intent: intentType,
                                command: actionName,
                                slots: this.extractSlots(match, actionName),
                                confidence: this.calculateMatchConfidence(text, pattern),
                                pattern: pattern
                            };
                        }
                    } catch (e) {
                        // malformed pattern should not stop matching other patterns
                        console.warn('Bad pattern skipped:', pattern, e);
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract slot values from regex match
     * Uses both the actionName context and captured groups. More tolerant than exact action-name checks.
     */
    extractSlots(match, actionName) {
        const slots = {};

        // If there are capture groups, try to interpret them:
        if (match.length > 1) {
            const g1 = match[1];

            if (g1 !== undefined && g1 !== null) {
                const g1Str = String(g1).trim();

                // If group looks numeric, it's likely a link index
                if (/^\d+$/.test(g1Str)) {
                    slots.linkNumber = parseInt(g1Str, 10);
                } else {
                    // If actionName or intent suggests a 'find' type, it's query text
                    if (actionName.toLowerCase().includes('find') || actionName.toLowerCase().includes('search') || /find|search|look/i.test(actionName)) {
                        slots.query = g1Str;
                    } else if (actionName.toLowerCase().includes('click') || actionName.toLowerCase().includes('press') || actionName.toLowerCase().includes('select') || /click|press|select/i.test(actionName)) {
                        // likely a click target
                        slots.target = g1Str;
                    } else if (actionName.toLowerCase().includes('open') && actionName.toLowerCase().includes('link')) {
                        // fallback: open link with named target
                        if (/^\d+$/.test(g1Str)) slots.linkNumber = parseInt(g1Str, 10);
                        else slots.target = g1Str;
                    } else {
                        // Generic fallback: attach as 'value'
                        slots.value = g1Str;
                    }
                }
            }
        }

        // Add action-specific inferred slots (from actionName itself)
        try {
            const lowerAction = String(actionName || '').toLowerCase();

            if (lowerAction.includes('scroll')) {
                const direction = lowerAction.replace('scroll', '').toLowerCase();
                // direction could be '' if example was 'scroll' alone
                if (direction) {
                    // normalize: remove leading non-letters
                    const d = direction.replace(/[^a-z]/g, '');
                    if (d) slots.direction = d;
                } else {
                    // If no direction in action name, but match text contains up/down words, try to guess
                    // (match input not available here; caller may fill)
                }
            }

            if (lowerAction.includes('zoom')) {
                const action = lowerAction.replace('zoom', '').toLowerCase().replace(/[^a-z]/g, '');
                if (action) slots.action = action;
            }
        } catch (e) {
            // harmless fallback
        }

        return slots;
    }

    /**
     * Calculate confidence score for a match
     */
    calculateMatchConfidence(text, pattern) {
        try {
            const match = text.match(pattern);
            if (!match) return 0;

            // Exact match = higher confidence
            if (match[0].toLowerCase() === text.toLowerCase()) return 1.0;

            // Partial match = lower confidence based on coverage
            const coverage = match[0].length / Math.max(1, text.length);
            // base score from coverage, capped slightly below 1
            return Math.min(0.95, coverage + 0.15);
        } catch (e) {
            return 0;
        }
    }

    /**
     * Get suggestions for unclear commands
     */
    getSuggestions(text) {
        const suggestions = [];
        const cleaned = String(text || '').toLowerCase();

        // Find partial matches
        for (const [intentType, actions] of Object.entries(this.commandPatterns || {})) {
            for (const [actionName, patterns] of Object.entries(actions || {})) {
                for (const pattern of patterns) {
                    const patternStr = String(pattern.source || '').toLowerCase();

                    // Check if any words match
                    const words = cleaned.split(/\s+/);
                    const hasPartialMatch = words.some(word =>
                        word.length > 3 && patternStr.includes(word)
                    );

                    if (hasPartialMatch) {
                        suggestions.push({
                            intent: intentType,
                            action: actionName,
                            example: this.getExampleForAction(intentType, actionName)
                        });
                    }
                }
            }
        }

        return suggestions.slice(0, 3); // Return top 3 suggestions
    }

    /**
     * Get example command for an action
     */
    getExampleForAction(intent, action) {
        // Look up in INTENT_SCHEMAS for the original example
        const intentSchema = INTENT_SCHEMAS[intent];
        if (!intentSchema) return action;

        // Find matching example
        for (const example of intentSchema.examples || []) {
            const exampleAction = this.exampleToActionName(example);
            if (exampleAction === action) {
                return example;
            }
        }

        // Fallback: return first example for this intent
        return (intentSchema.examples && intentSchema.examples[0]) || action;
    }

    /**
     * Validate if command is supported
     */
    isCommandSupported(text) {
        const normalized = this.normalize(text);
        return normalized.intent !== 'unknown';
    }

    /**
     * Get all available commands grouped by intent
     */
    getAllCommands() {
        const commands = {};

        for (const [intentName, intentSchema] of Object.entries(INTENT_SCHEMAS || {})) {
            commands[intentName] = (intentSchema.examples || []).map(example => ({
                action: this.exampleToActionName(example),
                example: example
            }));
        }

        return commands;
    }

    /**
     * Get command variations for testing
     */
    getVariations(intent, action) {
        const patterns = this.commandPatterns?.[intent]?.[action];
        if (!patterns) return [];

        return patterns.map(p => p.source.replace(/\\/g, '').replace(/\^|\$/g, ''));
    }
}

/**
 * Singleton instance for easy access
 */
let normalizerInstance = null;

export function getCommandNormalizer() {
    if (!normalizerInstance) {
        normalizerInstance = new CommandNormalizer();
    }
    return normalizerInstance;
}

/* ====== Quick dev-test snippet ======
Paste into console (after module load) to sanity-check:

try {
  const n = new CommandNormalizer();
  console.log('synonyms:', n.synonyms);
  console.log('intents:', Object.keys(n.commandPatterns));
  for (const [intent, actions] of Object.entries(n.commandPatterns)) {
    console.log(`Intent: ${intent}`);
    for (const [action, regs] of Object.entries(actions)) {
      console.log(`  ${action}:`, regs.map(r => r.toString()));
    }
  }

  // sample tests
  [['scroll down','navigate'], ['open link 2','link_action'], ['find login button','find_content']].forEach(([utter, _]) => {
    console.log('TEST:', utter, '=>', n.normalize(utter));
  });
} catch (e) {
  console.error('Normalizer init error', e);
}

======================================= */

