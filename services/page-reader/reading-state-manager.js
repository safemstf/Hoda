/**
 * ReadingStateManager - Tracks reading progress and position
 * Manages paragraph navigation and reading state
 * Issue #7: Voice Page Reading
 */

export class ReadingStateManager {
  constructor(options = {}) {
    this.contentBlocks = [];
    this.currentIndex = 0;
    this.state = 'idle'; // idle, reading, paused, stopped
    this.pausedAt = null;

    console.log('[ReadingStateManager] Initialized');
  }

  /**
   * Load content blocks for reading
   */
  loadContent(blocks) {
    this.contentBlocks = blocks || [];
    this.currentIndex = 0;
    this.state = 'idle';
    this.pausedAt = null;

    console.log(`[ReadingStateManager] Loaded ${this.contentBlocks.length} blocks`);
  }

  /**
   * Start reading from beginning
   */
  startReading() {
    if (this.contentBlocks.length === 0) {
      console.warn('[ReadingStateManager] No content loaded');
      return false;
    }

    this.currentIndex = 0;
    this.state = 'reading';
    this.pausedAt = null;

    console.log('[ReadingStateManager] Started reading');
    return true;
  }

  /**
   * Start reading from current scroll position
   */
  startFromCurrentPosition() {
    if (this.contentBlocks.length === 0) {
      return false;
    }

    // Find first block that's visible or below current scroll
    const scrollTop = window.scrollY;
    const index = this.contentBlocks.findIndex(
      block => block.position.top >= scrollTop - 100
    );

    if (index >= 0) {
      this.currentIndex = index;
    } else {
      this.currentIndex = 0;
    }

    this.state = 'reading';
    this.pausedAt = null;

    console.log(`[ReadingStateManager] Starting from position ${this.currentIndex}`);
    return true;
  }

  /**
   * Pause reading at current position
   */
  pause() {
    if (this.state !== 'reading') {
      return false;
    }

    this.state = 'paused';
    this.pausedAt = this.currentIndex;

    console.log(`[ReadingStateManager] Paused at index ${this.pausedAt}`);
    return true;
  }

  /**
   * Resume reading from paused position
   */
  resume() {
    if (this.state !== 'paused' || this.pausedAt === null) {
      return false;
    }

    this.currentIndex = this.pausedAt;
    this.state = 'reading';
    this.pausedAt = null;

    console.log(`[ReadingStateManager] Resumed from index ${this.currentIndex}`);
    return true;
  }

  /**
   * Stop reading completely
   */
  stop() {
    this.state = 'stopped';
    this.pausedAt = null;

    console.log('[ReadingStateManager] Stopped reading');
    return true;
  }

  /**
   * Get current block being read
   */
  getCurrentBlock() {
    if (this.currentIndex >= this.contentBlocks.length) {
      return null;
    }

    return this.contentBlocks[this.currentIndex];
  }

  /**
   * Move to next block
   */
  nextBlock() {
    if (this.currentIndex < this.contentBlocks.length - 1) {
      this.currentIndex++;
      console.log(`[ReadingStateManager] Next block: ${this.currentIndex}`);
      return this.getCurrentBlock();
    }

    return null;
  }

  /**
   * Move to previous block
   */
  previousBlock() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      console.log(`[ReadingStateManager] Previous block: ${this.currentIndex}`);
      return this.getCurrentBlock();
    }

    return null;
  }

  /**
   * Move to next paragraph (skip headings)
   */
  nextParagraph() {
    let index = this.currentIndex + 1;

    while (index < this.contentBlocks.length) {
      const block = this.contentBlocks[index];
      if (block.type === 'p' || !block.isHeading) {
        this.currentIndex = index;
        console.log(`[ReadingStateManager] Next paragraph: ${this.currentIndex}`);
        return block;
      }
      index++;
    }

    console.log('[ReadingStateManager] No next paragraph found');
    return null;
  }

  /**
   * Move to previous paragraph (skip headings)
   */
  previousParagraph() {
    let index = this.currentIndex - 1;

    while (index >= 0) {
      const block = this.contentBlocks[index];
      if (block.type === 'p' || !block.isHeading) {
        this.currentIndex = index;
        console.log(`[ReadingStateManager] Previous paragraph: ${this.currentIndex}`);
        return block;
      }
      index--;
    }

    console.log('[ReadingStateManager] No previous paragraph found');
    return null;
  }

  /**
   * Check if at end of content
   */
  isAtEnd() {
    return this.currentIndex >= this.contentBlocks.length - 1;
  }

  /**
   * Check if at beginning of content
   */
  isAtBeginning() {
    return this.currentIndex === 0;
  }

  /**
   * Get reading progress
   */
  getProgress() {
    if (this.contentBlocks.length === 0) {
      return {
        current: 0,
        total: 0,
        percentage: 0
      };
    }

    return {
      current: this.currentIndex + 1,
      total: this.contentBlocks.length,
      percentage: Math.round((this.currentIndex / this.contentBlocks.length) * 100)
    };
  }

  /**
   * Get current state info
   */
  getState() {
    return {
      state: this.state,
      currentIndex: this.currentIndex,
      pausedAt: this.pausedAt,
      hasContent: this.contentBlocks.length > 0,
      progress: this.getProgress()
    };
  }

  /**
   * Scroll to current block
   */
  scrollToCurrentBlock() {
    const block = this.getCurrentBlock();
    if (block && block.element) {
      block.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return true;
    }
    return false;
  }

  /**
   * Highlight current block visually
   */
  highlightCurrentBlock() {
    // Remove previous highlights
    document.querySelectorAll('.hoda-reading-highlight').forEach(el => {
      el.classList.remove('hoda-reading-highlight');
    });

    // Add highlight to current block
    const block = this.getCurrentBlock();
    if (block && block.element) {
      block.element.classList.add('hoda-reading-highlight');
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights() {
    document.querySelectorAll('.hoda-reading-highlight').forEach(el => {
      el.classList.remove('hoda-reading-highlight');
    });
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.currentIndex = 0;
    this.state = 'idle';
    this.pausedAt = null;
    this.clearHighlights();

    console.log('[ReadingStateManager] Reset');
  }
}
