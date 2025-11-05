// services/tts/reader.js - Page content reader
/**
 * Reader - Reads page content aloud
 */
export class Reader {
  constructor(speaker) {
    this.speaker = speaker;
    this.isPaused = false;
    this.currentText = null;
    this.currentPosition = 0;
    
    console.log('[Reader] Initialized');
  }

  /**
   * Read text content
   */
  async read(text, options = {}) {
    if (!text || text.trim().length === 0) {
      console.warn('[Reader] No text to read');
      return false;
    }

    this.currentText = text;
    this.currentPosition = 0;

    // Clean up text for better speech
    const cleanText = this.cleanText(text);
    
    try {
      await this.speaker.speak(cleanText, {
        rate: options.rate || 0.9, // Slightly slower for content reading
        ...options
      });
      return true;
    } catch (error) {
      console.error('[Reader] Failed to read:', error);
      return false;
    }
  }

  /**
   * Read selected text on page
   */
  async readSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      await this.speaker.speak('No text selected', { rate: 1.2 });
      return false;
    }

    return await this.read(selectedText);
  }

  /**
   * Read heading from page
   */
  async readHeading(level = 1) {
    const heading = document.querySelector(`h${level}`);
    
    if (!heading) {
      await this.speaker.speak(`No heading ${level} found`, { rate: 1.2 });
      return false;
    }

    const text = heading.textContent.trim();
    await this.speaker.speak(`Heading ${level}: ${text}`, { rate: 1.0 });
    return true;
  }

  /**
   * Read all headings on page
   */
  async readHeadings(options = {}) {
    const maxLevel = options.maxLevel || 3;
    const headings = [];

    for (let level = 1; level <= maxLevel; level++) {
      const elements = document.querySelectorAll(`h${level}`);
      elements.forEach(el => {
        headings.push({
          level,
          text: el.textContent.trim()
        });
      });
    }

    if (headings.length === 0) {
      await this.speaker.speak('No headings found', { rate: 1.2 });
      return false;
    }

    // Read count first
    await this.speaker.speak(`Found ${headings.length} headings`, { rate: 1.2 });
    
    // Read each heading
    for (const heading of headings) {
      await this.speaker.speak(
        `Heading ${heading.level}: ${heading.text}`,
        { rate: 1.0 }
      );
    }

    return true;
  }

  /**
   * Read paragraph
   */
  async readParagraph(index = 0) {
    const paragraphs = document.querySelectorAll('p');
    
    if (index >= paragraphs.length) {
      await this.speaker.speak('No more paragraphs', { rate: 1.2 });
      return false;
    }

    const text = paragraphs[index].textContent.trim();
    return await this.read(text);
  }

  /**
   * Read list items
   */
  async readList(selector = 'ul, ol') {
    const lists = document.querySelectorAll(selector);
    
    if (lists.length === 0) {
      await this.speaker.speak('No lists found', { rate: 1.2 });
      return false;
    }

    for (const list of lists) {
      const items = list.querySelectorAll('li');
      
      await this.speaker.speak(
        `List with ${items.length} items`,
        { rate: 1.2 }
      );

      for (let i = 0; i < items.length; i++) {
        const text = items[i].textContent.trim();
        await this.speaker.speak(
          `Item ${i + 1}: ${text}`,
          { rate: 0.95 }
        );
      }
    }

    return true;
  }

  /**
   * Read table
   */
  async readTable(index = 0) {
    const tables = document.querySelectorAll('table');
    
    if (index >= tables.length) {
      await this.speaker.speak('No table found', { rate: 1.2 });
      return false;
    }

    const table = tables[index];
    const rows = table.querySelectorAll('tr');
    
    await this.speaker.speak(
      `Table with ${rows.length} rows`,
      { rate: 1.2 }
    );

    for (let i = 0; i < Math.min(rows.length, 5); i++) { // Limit to first 5 rows
      const cells = rows[i].querySelectorAll('th, td');
      const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
      
      await this.speaker.speak(
        `Row ${i + 1}: ${cellTexts.join(', ')}`,
        { rate: 0.9 }
      );
    }

    if (rows.length > 5) {
      await this.speaker.speak(
        `And ${rows.length - 5} more rows`,
        { rate: 1.2 }
      );
    }

    return true;
  }

  /**
   * Read page title
   */
  async readTitle() {
    const title = document.title;
    
    if (!title) {
      await this.speaker.speak('No page title', { rate: 1.2 });
      return false;
    }

    await this.speaker.speak(`Page title: ${title}`, { rate: 1.0 });
    return true;
  }

  /**
   * Read page summary (title + first paragraph)
   */
  async readSummary() {
    await this.readTitle();
    
    const firstParagraph = document.querySelector('p');
    if (firstParagraph) {
      const text = firstParagraph.textContent.trim();
      const summary = text.substring(0, 200); // First 200 chars
      await this.read(summary);
    }

    return true;
  }

  /**
   * Clean text for better speech synthesis
   */
  cleanText(text) {
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Clean up punctuation spacing
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();
  }

  /**
   * Stop reading
   */
  stop() {
    this.speaker.stop();
    this.currentText = null;
    this.currentPosition = 0;
    console.log('[Reader] Stopped');
  }

  /**
   * Pause reading
   */
  pause() {
    this.speaker.pause();
    this.isPaused = true;
    console.log('[Reader] Paused');
  }

  /**
   * Resume reading
   */
  resume() {
    this.speaker.resume();
    this.isPaused = false;
    console.log('[Reader] Resumed');
  }

  /**
   * Get reading status
   */
  getStatus() {
    return {
      reading: this.speaker.isSpeaking,
      paused: this.isPaused,
      hasContent: this.currentText !== null
    };
  }

  /**
   * Read page semantic sections (headlines, paragraphs, etc.)
   * @param {Array} sections - Array of section objects with { role, text }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async readPageSemantic(sections) {
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return { success: false, error: 'No sections provided' };
    }

    try {
      for (const section of sections) {
        const { role, text } = section;
        
        if (!text || text.trim().length === 0) {
          continue; // Skip empty sections
        }

        // Read each section based on its role
        if (role === 'headline' || role === 'heading') {
          await this.speaker.speak(text, { rate: 1.0 });
        } else if (role === 'byline') {
          await this.speaker.speak(text, { rate: 1.1 });
        } else {
          // Default for paragraphs and other content
          await this.speaker.speak(text, { rate: 0.9 });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[Reader] Failed to read semantic sections:', error);
      return { success: false, error: error.message };
    }
  }
}