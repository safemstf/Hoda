/**
 * ContentExtractor - Intelligent webpage content extraction
 * Filters ads, navigation, footers and extracts readable content
 * Issue #7: Voice Page Reading
 */

export class ContentExtractor {
  constructor(options = {}) {
    this.config = {
      minParagraphLength: options.minParagraphLength || 20,
      minWordsPerElement: options.minWordsPerElement || 5,
      excludeSelectors: options.excludeSelectors || [
        'nav', 'header', 'footer', 'aside', '.ad', '.advertisement',
        '.sidebar', '.menu', '.navigation', '.cookie-notice',
        '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
        '.social-share', '.comments', '.related-posts', 'script', 'style'
      ],
      contentSelectors: options.contentSelectors || [
        'article', 'main', '[role="main"]', '.content', '.post-content',
        '.article-content', '.entry-content', '.post-body', '.story-body'
      ]
    };

    console.log('[ContentExtractor] Initialized', this.config);
  }

  /**
   * Extract main readable content from page
   * Returns array of content blocks with metadata
   */
  extractContent() {
    console.log('[ContentExtractor] Extracting content from page...');

    // Try semantic content containers first
    let contentRoot = this.findContentRoot();

    if (!contentRoot) {
      console.log('[ContentExtractor] No semantic container found, using body');
      contentRoot = document.body;
    }

    // Extract text blocks
    const blocks = this.extractTextBlocks(contentRoot);

    console.log(`[ContentExtractor] Extracted ${blocks.length} content blocks`);

    return blocks;
  }

  /**
   * Find the main content container using semantic HTML
   */
  findContentRoot() {
    // Try each content selector in priority order
    for (const selector of this.config.contentSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidContentContainer(element)) {
        console.log(`[ContentExtractor] Found content root: ${selector}`);
        return element;
      }
    }

    return null;
  }

  /**
   * Check if element is a valid content container
   */
  isValidContentContainer(element) {
    if (!element) return false;

    // Must have reasonable text content
    const text = element.textContent || '';
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return wordCount >= this.config.minWordsPerElement * 3;
  }

  /**
   * Extract text blocks from container
   */
  extractTextBlocks(container) {
    const blocks = [];

    // Get all text-bearing elements
    const elements = this.getTextElements(container);

    for (const element of elements) {
      // Skip excluded elements
      if (this.shouldExclude(element)) {
        continue;
      }

      const block = this.createContentBlock(element);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Get all elements that contain readable text
   */
  getTextElements(container) {
    const elements = [];

    // Target paragraphs, headings, list items
    const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'blockquote', 'td', 'th', 'dd', 'dt',
      'figcaption', 'caption'
    ];

    for (const selector of selectors) {
      const found = container.querySelectorAll(selector);
      elements.push(...Array.from(found));
    }

    return elements;
  }

  /**
   * Check if element should be excluded
   */
  shouldExclude(element) {
    if (!element) return true;

    // Check if element or parent matches exclude selectors
    for (const selector of this.config.excludeSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return true;
      }
    }

    // Check if hidden
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }

    return false;
  }

  /**
   * Create content block from element
   */
  createContentBlock(element) {
    const text = this.extractText(element);

    if (!text || text.length < this.config.minParagraphLength) {
      return null;
    }

    return {
      text: text,
      type: element.tagName.toLowerCase(),
      element: element,
      isHeading: /^h[1-6]$/i.test(element.tagName),
      position: this.getElementPosition(element)
    };
  }

  /**
   * Extract clean text from element
   */
  extractText(element) {
    if (!element) return '';

    let text = '';

    // Special handling for images - use alt text
    if (element.tagName === 'IMG') {
      const alt = element.getAttribute('alt');
      return alt ? `Image: ${alt}` : '';
    }

    // Get text content
    text = element.textContent || '';

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Handle links naturally - don't announce "link" constantly
    // Just read the link text in flow

    return text;
  }

  /**
   * Get element's position on page
   */
  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      bottom: rect.bottom + window.scrollY,
      isVisible: this.isElementVisible(element)
    };
  }

  /**
   * Check if element is currently visible in viewport
   */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }

  /**
   * Extract content starting from current scroll position
   */
  extractFromCurrentPosition() {
    const blocks = this.extractContent();
    const scrollTop = window.scrollY;

    // Filter blocks that are at or below current scroll position
    return blocks.filter(block => block.position.top >= scrollTop - 100);
  }

  /**
   * Get summary of extracted content
   */
  getContentSummary() {
    const blocks = this.extractContent();

    return {
      totalBlocks: blocks.length,
      paragraphs: blocks.filter(b => b.type === 'p').length,
      headings: blocks.filter(b => b.isHeading).length,
      totalWords: blocks.reduce((sum, b) => {
        return sum + b.text.split(/\s+/).length;
      }, 0),
      estimatedReadingTime: this.estimateReadingTime(blocks)
    };
  }

  /**
   * Estimate reading time in seconds
   * Average reading speed: 200 words per minute
   */
  estimateReadingTime(blocks) {
    const totalWords = blocks.reduce((sum, b) => {
      return sum + b.text.split(/\s+/).length;
    }, 0);

    return Math.ceil(totalWords / 200 * 60); // seconds
  }
}
