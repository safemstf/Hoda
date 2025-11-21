/**
 * PageReader - Main controller for voice page reading
 * Coordinates content extraction, TTS, and reading state
 * Issue #7: Voice Page Reading
 */

import { ContentExtractor } from './content-extractor.js';
import { ReadingStateManager } from './reading-state-manager.js';

export class PageReader {
  constructor(options = {}) {
    this.extractor = new ContentExtractor(options.extraction);
    this.stateManager = new ReadingStateManager();

    // TTS will be injected
    this.tts = null;

    // Reading queue
    this.readingQueue = [];
    this.isProcessingQueue = false;
    this.shouldStopQueue = false;

    // Configuration
    this.config = {
      pauseBetweenBlocks: options.pauseBetweenBlocks || 500, // ms
      scrollToBlock: options.scrollToBlock !== false,
      highlightBlock: options.highlightBlock !== false,
      autoScroll: options.autoScroll !== false
    };

    console.log('[PageReader] Initialized');
  }

  /**
   * Set TTS engine
   */
  setTTS(tts) {
    this.tts = tts;
    console.log('[PageReader] TTS engine connected');
  }

  /**
   * Start reading page from top
   */
  async readPage() {
    console.log('[PageReader] Read page requested');

    // Extract content
    const blocks = this.extractor.extractContent();

    if (blocks.length === 0) {
      return this.announceError('No readable content on this page');
    }

    // Load content into state manager
    this.stateManager.loadContent(blocks);
    this.stateManager.startReading();

    // Announce start
    await this.announce('Reading page');

    // Start reading blocks
    await this.processReadingQueue();

    return { success: true, blocksCount: blocks.length };
  }

  /**
   * Read from current scroll position
   */
  async readFromHere() {
    console.log('[PageReader] Read from here requested');

    // Extract content from current position
    const blocks = this.extractor.extractFromCurrentPosition();

    if (blocks.length === 0) {
      return this.announceError('No readable content from this position');
    }

    this.stateManager.loadContent(blocks);
    this.stateManager.startReading();

    await this.announce('Reading from here');
    await this.processReadingQueue();

    return { success: true, blocksCount: blocks.length };
  }

  /**
   * Pause reading
   */
  async pauseReading() {
    console.log('[PageReader] Pause requested');

    if (this.stateManager.state !== 'reading') {
      return { success: false, reason: 'not-reading' };
    }

    this.shouldStopQueue = true;
    this.stateManager.pause();

    // Stop TTS
    if (this.tts) {
      this.tts.stop();
    }

    await this.announce('Paused');

    return { success: true };
  }

  /**
   * Resume reading
   */
  async resumeReading() {
    console.log('[PageReader] Resume requested');

    if (this.stateManager.state !== 'paused') {
      return { success: false, reason: 'not-paused' };
    }

    this.stateManager.resume();
    await this.announce('Resuming');

    this.shouldStopQueue = false;
    await this.processReadingQueue();

    return { success: true };
  }

  /**
   * Stop reading completely
   */
  async stopReading() {
    console.log('[PageReader] Stop requested');

    this.shouldStopQueue = true;
    this.stateManager.stop();
    this.stateManager.clearHighlights();

    // Stop TTS
    if (this.tts) {
      this.tts.stop();
    }

    return { success: true };
  }

  /**
   * Navigate to next paragraph
   */
  async nextParagraph() {
    console.log('[PageReader] Next paragraph requested');

    const block = this.stateManager.nextParagraph();

    if (!block) {
      if (this.stateManager.isAtEnd()) {
        return this.announceError('End of page');
      }
      return this.announceError('No next paragraph');
    }

    // If reading, continue with new position
    if (this.stateManager.state === 'reading') {
      this.shouldStopQueue = true;
      if (this.tts) {
        this.tts.stop();
      }

      // Small delay then continue
      await this.sleep(300);
      this.shouldStopQueue = false;
      await this.processReadingQueue();
    } else {
      // Just highlight and scroll
      if (this.config.scrollToBlock) {
        this.stateManager.scrollToCurrentBlock();
      }
      if (this.config.highlightBlock) {
        this.stateManager.highlightCurrentBlock();
      }
    }

    return { success: true };
  }

  /**
   * Navigate to previous paragraph
   */
  async previousParagraph() {
    console.log('[PageReader] Previous paragraph requested');

    const block = this.stateManager.previousParagraph();

    if (!block) {
      if (this.stateManager.isAtBeginning()) {
        return this.announceError('At beginning');
      }
      return this.announceError('No previous paragraph');
    }

    // If reading, continue with new position
    if (this.stateManager.state === 'reading') {
      this.shouldStopQueue = true;
      if (this.tts) {
        this.tts.stop();
      }

      await this.sleep(300);
      this.shouldStopQueue = false;
      await this.processReadingQueue();
    } else {
      if (this.config.scrollToBlock) {
        this.stateManager.scrollToCurrentBlock();
      }
      if (this.config.highlightBlock) {
        this.stateManager.highlightCurrentBlock();
      }
    }

    return { success: true };
  }

  /**
   * Process the reading queue
   */
  async processReadingQueue() {
    if (this.isProcessingQueue) {
      console.log('[PageReader] Already processing queue');
      return;
    }

    this.isProcessingQueue = true;
    this.shouldStopQueue = false;

    while (this.stateManager.state === 'reading' && !this.shouldStopQueue) {
      const block = this.stateManager.getCurrentBlock();

      if (!block) {
        // Reached end
        await this.announce('End of page');
        this.stateManager.stop();
        break;
      }

      // Scroll to block
      if (this.config.scrollToBlock) {
        this.stateManager.scrollToCurrentBlock();
      }

      // Highlight block
      if (this.config.highlightBlock) {
        this.stateManager.highlightCurrentBlock();
      }

      // Read block
      await this.readBlock(block);

      // Check if should stop
      if (this.shouldStopQueue) {
        break;
      }

      // Pause between blocks
      await this.sleep(this.config.pauseBetweenBlocks);

      // Move to next block
      const nextBlock = this.stateManager.nextBlock();
      if (!nextBlock) {
        // Reached end
        await this.announce('End of page');
        this.stateManager.stop();
        break;
      }
    }

    this.isProcessingQueue = false;
    this.stateManager.clearHighlights();
  }

  /**
   * Read a single content block
   */
  async readBlock(block) {
    if (!this.tts || !block) {
      return;
    }

    return new Promise((resolve) => {
      // Prefix headings
      let text = block.text;
      if (block.isHeading) {
        const level = block.type.replace('h', '');
        text = `Heading ${level}. ${text}`;
      }

      this.tts.speak(text, {
        onEnd: () => resolve(),
        onError: (error) => {
          console.error('[PageReader] TTS error:', error);
          resolve();
        }
      });
    });
  }

  /**
   * Announce message via TTS
   */
  async announce(message) {
    if (!this.tts) {
      console.log(`[PageReader] Announce: ${message}`);
      return;
    }

    return new Promise((resolve) => {
      this.tts.speak(message, {
        priority: 'high',
        onEnd: () => resolve(),
        onError: () => resolve()
      });
    });
  }

  /**
   * Announce error message
   */
  async announceError(message) {
    await this.announce(message);
    return { success: false, error: message };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current reading state
   */
  getState() {
    return this.stateManager.getState();
  }

  /**
   * Get content summary
   */
  getContentSummary() {
    return this.extractor.getContentSummary();
  }

  /**
   * Stop all activity and reset
   */
  async reset() {
    this.shouldStopQueue = true;

    if (this.tts) {
      this.tts.stop();
    }

    this.stateManager.reset();
    this.readingQueue = [];
    this.isProcessingQueue = false;

    console.log('[PageReader] Reset complete');
  }
}
