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
     * CLEAN generateVariations - Aligned with clean intent schema
     */
    generateVariations(example) {
        if (example === null || example === undefined) return [];
        const exampleStr = String(example).trim();
        if (!exampleStr) return [];
        const lowerExample = exampleStr.toLowerCase();
        const variations = [exampleStr];

        // Apply synonym substitutions first
        for (const [word, synonyms] of Object.entries(this.synonyms || {})) {
            if (typeof word !== 'string' || !Array.isArray(synonyms)) continue;
            if (lowerExample.includes(word)) {
                synonyms.forEach(synonym => {
                    const variant = lowerExample.replace(word, synonym);
                    variations.push(variant);
                });
            }
        }

        // ========================================================================
        // SCROLL VARIATIONS (within page)
        // ========================================================================

        // Scroll down
        if (lowerExample.includes('scroll down') || lowerExample === 'down') {
            variations.push(
                'page down',
                'down',
                'move down',
                'go down'
            );
        }

        // Scroll up
        if (lowerExample.includes('scroll up') || lowerExample === 'up') {
            variations.push(
                'page up',
                'up',
                'move up'
            );
        }

        // Scroll to top
        if (lowerExample.includes('top') && !lowerExample.includes('bottom')) {
            variations.push(
                'top',
                'scroll to top',
                'go to top',
                'beginning',
                'start'
            );
        }

        // Scroll to bottom
        if (lowerExample.includes('bottom')) {
            variations.push(
                'bottom',
                'scroll to bottom',
                'go to bottom',
                'end'
            );
        }

        // ========================================================================
        // BROWSER NAVIGATION (between pages)
        // ========================================================================

        // Go back / previous page
        if (lowerExample.includes('back') || lowerExample.includes('previous page')) {
            // Only add browser navigation variations
            variations.push(
                'go back',
                'back',
                'previous page',
                'last page'
            );
        }

        // Go forward / next page
        if (lowerExample.includes('forward') || lowerExample.includes('next page')) {
            variations.push(
                'go forward',
                'forward',
                'next page'
            );
        }

        // ========================================================================
        // PAGE ACTIONS
        // ========================================================================

        // Refresh
        if (lowerExample.includes('refresh') || lowerExample.includes('reload')) {
            variations.push(
                'refresh',
                'reload',
                'refresh page',
                'reload page'
            );
        }

        // Home
        if (lowerExample.includes('home')) {
            variations.push(
                'home',
                'go home',
                'home page'
            );
        }

        // ========================================================================
        // LINK ACTIONS
        // ========================================================================

        if (lowerExample.includes('list') && lowerExample.includes('link')) {
            variations.push(
                'list links',
                'show links',
                'what links'
            );
        }

        if (lowerExample.includes('open link')) {
            variations.push(
                'open link (\\d+)',
                'click link (\\d+)',
                'link (\\d+)'
            );
        }

        // ========================================================================
        // ZOOM ACTIONS
        // ========================================================================

        if (lowerExample.includes('zoom in') || lowerExample.includes('bigger')) {
            variations.push(
                'zoom in',
                'bigger',
                'make bigger',
                'increase size'
            );
        }

        if (lowerExample.includes('zoom out') || lowerExample.includes('smaller')) {
            variations.push(
                'zoom out',
                'smaller',
                'make smaller',
                'decrease size'
            );
        }

        if (lowerExample.includes('reset zoom')) {
            variations.push(
                'reset zoom',
                'normal size',
                'default size'
            );
        }

        // ========================================================================
        // READING ACTIONS
        // ========================================================================

        if (lowerExample.includes('read') && !lowerExample.includes('stop')) {
            variations.push(
                'read page',
                'read this',
                'start reading'
            );
        }

        if (lowerExample.includes('stop reading')) {
            variations.push(
                'stop reading',
                'stop'
            );
        }

        if (lowerExample.includes('pause')) {
            variations.push(
                'pause',
                'pause reading'
            );
        }

        if (lowerExample.includes('resume') || lowerExample.includes('continue')) {
            variations.push(
                'resume',
                'resume reading',
                'continue reading'
            );
        }

        // ========================================================================
        // FIND ACTIONS
        // ========================================================================

        if (lowerExample.includes('find')) {
            variations.push(
                'find (.+)',
                'search for (.+)',
                'where is (.+)',
                'locate (.+)'
            );
        }

        // ========================================================================
        // HELP
        // ========================================================================

        if (lowerExample === 'help') {
            variations.push(
                'help',
                'what can you do',
                'show commands',
                'list commands'
            );
        }

        // Deduplicate
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
     * Enhanced synonym map - ADD to buildSynonymMap()
     */
    buildSynonymMap() {
        return {
            scroll: ['move', 'navigate', 'go'],
            click: ['press', 'select', 'tap', 'open'],
            read: ['speak', 'say', 'tell'],
            stop: ['end', 'quit', 'cancel', 'close', 'halt'],
            pause: ['hold', 'wait'],
            resume: ['continue', 'proceed', 'keep going'],
            zoom: ['magnify', 'size', 'scale'],
            find: ['search', 'locate', 'look for', 'where is'],
            bigger: ['larger', 'increase', 'enlarge'],
            smaller: ['decrease', 'reduce', 'shrink'],
            // New additions
            back: ['previous', 'return', 'backward'],
            forward: ['next', 'ahead', 'onward'],
            refresh: ['reload', 'update'],
            home: ['homepage', 'main page', 'start']
        };
    }

    /**
     * PRECISE extractSlots - Rule-based slot extraction
     * Follows COMMAND_RULES from intents-temporary.js
     */
    extractSlots(match, actionName) {
        const slots = {};
        const matchedText = match[0].toLowerCase();

        console.log('[Normalizer] extractSlots:', matchedText, 'action:', actionName);

        // ========================================================================
        // STEP 1: Extract capture groups (for numbers, queries, etc.)
        // ========================================================================
        if (match.length > 1) {
            const g1 = match[1];
            if (g1 !== undefined && g1 !== null) {
                const g1Str = String(g1).trim();

                // Link numbers
                if (/^\d+$/.test(g1Str)) {
                    slots.linkNumber = parseInt(g1Str, 10);
                }
                // Search queries
                else if (actionName.toLowerCase().includes('find') ||
                    actionName.toLowerCase().includes('search') ||
                    actionName.toLowerCase().includes('locate')) {
                    slots.query = g1Str;
                }
                // Link targets
                else if (actionName.toLowerCase().includes('open') ||
                    actionName.toLowerCase().includes('click')) {
                    slots.target = g1Str;
                }
                // Generic value
                else {
                    slots.value = g1Str;
                }
            }
        }

        // ========================================================================
        // STEP 2: Extract navigation slots (STRICT RULES)
        // ========================================================================
        if (actionName.toLowerCase().includes('scroll') ||
            actionName.toLowerCase().includes('navigate') ||
            actionName.toLowerCase().includes('move') ||
            actionName.toLowerCase().includes('page') ||
            actionName.toLowerCase().includes('go')) {

            // --------------------------------------------------------------------
            // RULE 1: Browser History (HIGHEST PRIORITY)
            // These ALWAYS mean browser navigation, never scrolling
            // --------------------------------------------------------------------
            if (matchedText.includes('previous page') ||
                matchedText.includes('next page') ||
                matchedText.includes('last page')) {

                if (matchedText.includes('previous') || matchedText.includes('last')) {
                    slots.direction = 'back';
                    console.log('[Normalizer] → Browser BACK (previous/next page)');
                } else if (matchedText.includes('next')) {
                    slots.direction = 'forward';
                    console.log('[Normalizer] → Browser FORWARD (next page)');
                }
            }

            // --------------------------------------------------------------------
            // RULE 2: Explicit browser commands
            // "go back", "go forward", "back", "forward"
            // --------------------------------------------------------------------
            else if (matchedText.includes('go back') ||
                (matchedText === 'back' || matchedText.includes(' back ')) &&
                !matchedText.includes('scroll') &&
                !matchedText.includes('up')) {
                slots.direction = 'back';
                console.log('[Normalizer] → Browser BACK');
            }
            else if (matchedText.includes('go forward') ||
                matchedText.includes('forward') ||
                matchedText.includes('ahead')) {
                slots.direction = 'forward';
                console.log('[Normalizer] → Browser FORWARD');
            }

            // --------------------------------------------------------------------
            // RULE 3: Page actions (reload, refresh, home)
            // --------------------------------------------------------------------
            else if (matchedText.includes('refresh') ||
                matchedText.includes('reload')) {
                slots.target = 'refresh';
                console.log('[Normalizer] → REFRESH page');
            }
            else if (matchedText.includes('home')) {
                slots.target = 'home';
                console.log('[Normalizer] → GO HOME');
            }

            // --------------------------------------------------------------------
            // RULE 4: Scroll to top/bottom (explicit "scroll to" or standalone)
            // --------------------------------------------------------------------
            else if (matchedText.includes('top') ||
                matchedText.includes('beginning') ||
                matchedText.includes('start')) {
                slots.target = 'top';
                console.log('[Normalizer] → Scroll to TOP');
            }
            else if (matchedText.includes('bottom') ||
                matchedText.includes('end')) {
                slots.target = 'bottom';
                console.log('[Normalizer] → Scroll to BOTTOM');
            }

            // --------------------------------------------------------------------
            // RULE 5: Incremental scrolling (up/down)
            // --------------------------------------------------------------------
            else if (matchedText.includes('down') ||
                matchedText.includes('page down')) {
                slots.direction = 'down';
                console.log('[Normalizer] → Scroll DOWN');
            }
            else if (matchedText.includes('up') ||
                matchedText.includes('page up') ||
                matchedText.includes('back up')) {
                slots.direction = 'up';
                console.log('[Normalizer] → Scroll UP');
            }
        }

        // ========================================================================
        // STEP 3: Extract zoom slots
        // ========================================================================
        if (actionName.toLowerCase().includes('zoom') ||
            actionName.toLowerCase().includes('bigger') ||
            actionName.toLowerCase().includes('smaller')) {

            if (matchedText.includes('in') ||
                matchedText.includes('bigger') ||
                matchedText.includes('increase')) {
                slots.action = 'in';
            }
            else if (matchedText.includes('out') ||
                matchedText.includes('smaller') ||
                matchedText.includes('decrease')) {
                slots.action = 'out';
            }
            else if (matchedText.includes('reset') ||
                matchedText.includes('normal') ||
                matchedText.includes('default')) {
                slots.action = 'reset';
            }
        }

        // ========================================================================
        // STEP 4: Extract reading slots
        // ========================================================================
        if (actionName.toLowerCase().includes('read')) {
            if (matchedText.includes('stop')) {
                slots.action = 'stop';
            }
            else if (matchedText.includes('pause') || matchedText.includes('hold')) {
                slots.action = 'pause';
            }
            else if (matchedText.includes('resume') || matchedText.includes('continue')) {
                slots.action = 'resume';
            }
            else {
                slots.action = 'start';
            }

            // Scope (page vs viewport)
            if (matchedText.includes('this') || matchedText.includes('visible')) {
                slots.scope = 'this';
            } else {
                slots.scope = 'page';
            }
        }

        // ========================================================================
        // STEP 5: Extract link action slots
        // ========================================================================
        if (actionName.toLowerCase().includes('link')) {
            if (matchedText.includes('list') || matchedText.includes('show')) {
                slots.action = 'list';
            }
            else if (matchedText.includes('open') || matchedText.includes('click')) {
                slots.action = 'open';
            }
        }

        console.log('[Normalizer] Extracted slots:', slots);
        return slots;
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(str) {
        // Coerce to string to prevent errors when undefined/null is passed
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
