/**
 * Content Metrics Service
 * -----------------------------------------------
 * Provides analytical metrics for extracted webpage
 * content. Helps developers understand text structure,
 * reading complexity, and block distribution.
 *
 * This is an optional enhancement module for Issue #7.
 * Author: Sai Shishir Koppula
 */

export class ContentMetrics {
  constructor(blocks = []) {
    this.blocks = blocks;
  }

  /**
   * Set content blocks dynamically
   */
  setBlocks(blocks) {
    this.blocks = blocks || [];
  }

  /**
   * Count elements by type
   */
  getBasicCounts() {
    const counts = {
      totalBlocks: this.blocks.length,
      paragraphs: 0,
      headings: 0,
      lists: 0,
      blockquotes: 0,
      tables: 0,
      images: 0,
    };

    for (const block of this.blocks) {
      const type = block.type || '';

      if (type === 'p') counts.paragraphs++;
      if (/^h[1-6]$/.test(type)) counts.headings++;
      if (type === 'li' || type === 'ul' || type === 'ol') counts.lists++;
      if (type === 'blockquote') counts.blockquotes++;
      if (type === 'td' || type === 'th') counts.tables++;
      if (type === 'img') counts.images++;
    }

    return counts;
  }

  /**
   * Count total words across blocks
   */
  getTotalWordCount() {
    return this.blocks.reduce((sum, block) => {
      return sum + (block.text?.split(/\s+/).filter(Boolean).length || 0);
    }, 0);
  }

  /**
   * Average paragraph length (in words)
   */
  getAverageParagraphLength() {
    const paragraphs = this.blocks.filter(
      (b) => b.type === 'p' && b.text?.length > 0
    );

    if (paragraphs.length === 0) return 0;

    const total = paragraphs.reduce((sum, p) => {
      return sum + p.text.split(/\s+/).length;
    }, 0);

    return Math.round(total / paragraphs.length);
  }

  /**
   * Detect redundant/duplicate paragraphs
   */
  getDuplicateBlocks() {
    const map = {};
    const dupes = [];

    for (const block of this.blocks) {
      const key = block.text?.slice(0, 50) || ''; // first 50 chars
      if (!key) continue;

      if (!map[key]) map[key] = 0;
      map[key]++;

      if (map[key] === 2) dupes.push(block); // only push once
    }

    return dupes;
  }

  /**
   * Find extreme paragraphs (long or short)
   */
  getParagraphExtremes() {
    const paragraphs = this.blocks.filter(
      (b) => b.type === 'p' && b.text?.length > 0
    );

    if (paragraphs.length === 0) {
      return { longest: null, shortest: null };
    }

    let longest = paragraphs[0];
    let shortest = paragraphs[0];

    for (const p of paragraphs) {
      if (p.text.length > longest.text.length) longest = p;
      if (p.text.length < shortest.text.length) shortest = p;
    }

    return { longest, shortest };
  }

  /**
   * Flesch Reading Ease score
   * 90–100 = Very Easy
   * 60–70 = Standard
   * 30–50 = Difficult
   */
  getReadingDifficulty() {
    const text = this.blocks.map((b) => b.text).join(' ');

    if (!text) {
      return { score: 0, level: 'No content' };
    }

    const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    const syllables = this.countSyllables(text);

    const score =
      206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);

    return {
      score: Math.round(score),
      level: this.readabilityLabel(score),
    };
  }

  /**
   * Approximate syllable counter
   */
  countSyllables(text) {
    return text
      .toLowerCase()
      .split(/\s+/)
      .reduce((sum, word) => {
        const matches = word.match(/[aeiouy]+/g);
        return sum + (matches ? matches.length : 1);
      }, 0);
  }

  readabilityLabel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 70) return 'Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Confusing';
  }

  /**
   * Compile all metrics together
   */
  getFullReport() {
    return {
      counts: this.getBasicCounts(),
      totalWords: this.getTotalWordCount(),
      averageParagraphLength: this.getAverageParagraphLength(),
      duplicateBlocks: this.getDuplicateBlocks().length,
      extremes: this.getParagraphExtremes(),
      readingDifficulty: this.getReadingDifficulty(),
    };
  }

  /**
   * Pretty print in console for developers
   */
  printReport() {
    const report = this.getFullReport();

    console.group('%c📊 Content Metrics Report', 'color:#3498db; font-size:16px;');
    console.log('Total Blocks:', report.counts.totalBlocks);
    console.log('Paragraphs:', report.counts.paragraphs);
    console.log('Headings:', report.counts.headings);
    console.log('Lists:', report.counts.lists);
    console.log('Blockquotes:', report.counts.blockquotes);
    console.log('Total Words:', report.totalWords);
    console.log('Average Paragraph Length:', report.averageParagraphLength + ' words');
    console.log('Duplicate Blocks:', report.duplicateBlocks);
    console.log('Reading Difficulty:', report.readingDifficulty);
    console.groupEnd();
  }

  /**
   * Export metrics as JSON (for testing or saving)
   */
  exportJSON() {
    return JSON.stringify(this.getFullReport(), null, 2);
  }
}
