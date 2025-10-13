/**
 * Command Executor for Content Script
 * Executes normalized commands on the active page
 * Works with FeedbackManager for confirmations
 */

export class CommandExecutor {
  constructor(feedbackManager) {
    this.feedbackManager = feedbackManager;
    this.linkList = [];
    this.currentSearchIndex = 0;
    
    console.log('[Executor] Initialized');
  }

  /**
   * Execute a normalized command
   * @param {Object} command - Normalized command from CommandNormalizer
   * @returns {Promise<Object>} Execution result
   */
  async execute(command) {
    const intent = command.intent || command.normalized?.intent;
    const slots = command.slots || command.normalized?.slots || {};

    console.log('[Executor] Executing:', intent, slots);

    try {
      let result;

      switch (intent) {
        case 'navigate':
          result = await this.executeNavigate(slots);
          break;

        case 'read':
          result = await this.executeRead(slots);
          break;

        case 'zoom':
          result = await this.executeZoom(slots);
          break;

        case 'link_action':
          result = await this.executeLinkAction(slots);
          break;

        case 'find_content':
          result = await this.executeFindContent(slots);
          break;

        case 'help':
          result = await this.executeHelp();
          break;

        case 'form_action':
          result = await this.executeFormAction(slots);
          break;

        default:
          result = {
            success: false,
            message: `Unknown command: ${intent}`
          };
      }

      // Provide feedback
      if (result.success && this.feedbackManager) {
        this.feedbackManager.confirmCommand(command);
      } else if (!result.success && this.feedbackManager) {
        this.feedbackManager.showError(result.message || 'Command failed');
      }

      return result;

    } catch (err) {
      console.error('[Executor] Execution error:', err);
      
      if (this.feedbackManager) {
        this.feedbackManager.showError('Error: ' + err.message);
      }

      return {
        success: false,
        message: err.message,
        error: err
      };
    }
  }

  /**
   * Execute navigation commands
   */
  async executeNavigate(slots) {
    const direction = slots.direction;
    const amount = slots.amount || 'normal';
    const target = slots.target;

    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return { success: true, message: 'Scrolled to top' };
    }

    if (target === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return { success: true, message: 'Scrolled to bottom' };
    }

    if (direction === 'back') {
      window.history.back();
      return { success: true, message: 'Going back' };
    }

    if (direction === 'forward') {
      window.history.forward();
      return { success: true, message: 'Going forward' };
    }

    // Scroll up/down
    const scrollAmount = amount === 'large' ? window.innerHeight * 0.9 : window.innerHeight * 0.5;
    const scrollY = direction === 'down' ? scrollAmount : -scrollAmount;

    window.scrollBy({ top: scrollY, behavior: 'smooth' });
    
    return {
      success: true,
      message: `Scrolled ${direction}`
    };
  }

  /**
   * Execute reading commands
   */
  async executeRead(slots) {
    const action = slots.action;

    if (action === 'stop') {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return { success: true, message: 'Stopped reading' };
      }
      return { success: false, message: 'Not currently reading' };
    }

    if (action === 'pause') {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        return { success: true, message: 'Paused reading' };
      }
      return { success: false, message: 'Not currently reading' };
    }

    if (action === 'resume') {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        return { success: true, message: 'Resumed reading' };
      }
      return { success: false, message: 'Nothing to resume' };
    }

    // Start reading
    const text = this.extractPageText();
    
    if (!text) {
      return { success: false, message: 'No text found to read' };
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    window.speechSynthesis.speak(utterance);

    return { success: true, message: 'Started reading' };
  }

  /**
   * Execute zoom commands
   */
  async executeZoom(slots) {
    const action = slots.action;
    const amount = parseFloat(slots.amount) || 0.1;

    // Get current zoom level
    let currentZoom = parseFloat(document.body.style.zoom) || 1.0;

    if (action === 'in' || action === 'bigger') {
      currentZoom += amount;
    } else if (action === 'out' || action === 'smaller') {
      currentZoom -= amount;
    } else if (action === 'reset' || action === 'normal') {
      currentZoom = 1.0;
    }

    // Clamp zoom level
    currentZoom = Math.max(0.5, Math.min(3.0, currentZoom));

    document.body.style.zoom = currentZoom;

    return {
      success: true,
      message: `Zoom: ${Math.round(currentZoom * 100)}%`
    };
  }

  /**
   * Execute link actions
   */
  async executeLinkAction(slots) {
    const action = slots.action;
    const linkNumber = slots.linkNumber;
    const target = slots.target;

    if (action === 'list' || !action) {
      // List all links
      this.linkList = Array.from(document.querySelectorAll('a[href]'));
      
      const linkTexts = this.linkList
        .slice(0, 10)
        .map((link, i) => {
          const text = link.textContent.trim() || link.href;
          return `${i + 1}. ${text.substring(0, 50)}`;
        })
        .join('\n');

      console.log('[Executor] Found links:\n', linkTexts);

      // Show overlay with links
      this.showLinkList(this.linkList.slice(0, 10));

      return {
        success: true,
        message: `Found ${this.linkList.length} links`
      };
    }

    if (linkNumber !== undefined) {
      // Open link by number
      const index = linkNumber - 1;
      
      if (index >= 0 && index < this.linkList.length) {
        const link = this.linkList[index];
        link.click();
        return {
          success: true,
          message: `Opening link ${linkNumber}`
        };
      }

      return {
        success: false,
        message: `Link ${linkNumber} not found`
      };
    }

    if (target) {
      // Find link by text
      const link = Array.from(document.querySelectorAll('a[href]'))
        .find(a => a.textContent.toLowerCase().includes(target.toLowerCase()));

      if (link) {
        link.click();
        return {
          success: true,
          message: `Opening ${target}`
        };
      }

      return {
        success: false,
        message: `Link "${target}" not found`
      };
    }

    return { success: false, message: 'Invalid link action' };
  }

  /**
   * Execute find/search commands
   */
  async executeFindContent(slots) {
    const query = slots.query;

    if (!query) {
      return { success: false, message: 'No search query provided' };
    }

    // Use browser's find function
    const found = window.find(query, false, false, true);

    if (found) {
      return {
        success: true,
        message: `Found "${query}"`
      };
    }

    // Try case-insensitive
    const foundCaseInsensitive = window.find(query, false, false, false);
    
    if (foundCaseInsensitive) {
      return {
        success: true,
        message: `Found "${query}"`
      };
    }

    return {
      success: false,
      message: `"${query}" not found`
    };
  }

  /**
   * Execute help command
   */
  async executeHelp() {
    const helpText = `
Voice Commands Available:
• Navigation: "scroll down", "scroll up", "go to top", "go back"
• Reading: "read page", "stop reading", "pause", "resume"
• Zoom: "zoom in", "zoom out", "reset zoom"
• Links: "list links", "open link 1", "click on about"
• Search: "find login", "search for contact"
• Help: "help", "what can you do"

Say "Hoda" + command, or just the command directly.
    `.trim();

    this.showHelpOverlay(helpText);

    return {
      success: true,
      message: 'Showing help'
    };
  }

  /**
   * Execute form actions
   */
  async executeFormAction(slots) {
    const action = slots.action;
    const field = slots.field;

    // This would need more sophisticated form handling
    // For now, just a placeholder
    return {
      success: false,
      message: 'Form actions not yet implemented'
    };
  }

  /**
   * Helper: Extract readable text from page
   */
  extractPageText() {
    // Get main content
    const main = document.querySelector('main, article, .content, [role="main"]');
    const target = main || document.body;

    // Get text, removing script/style content
    const clone = target.cloneNode(true);
    clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());

    return clone.textContent.trim().substring(0, 5000); // Limit length
  }

  /**
   * Helper: Show link list overlay
   */
  showLinkList(links) {
    const overlay = this.createOverlay('hoda-link-list');
    
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        📎 Available Links
      </div>
      ${links.map((link, i) => {
        const text = link.textContent.trim() || link.href;
        return `
          <div style="margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 4px;">
            <strong>${i + 1}.</strong> ${text.substring(0, 60)}
          </div>
        `;
      }).join('')}
      <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
        Say "open link [number]" to open
      </div>
    `;

    overlay.style.maxHeight = '400px';
    overlay.style.overflowY = 'auto';
  }

  /**
   * Helper: Show help overlay
   */
  showHelpOverlay(text) {
    const overlay = this.createOverlay('hoda-help');
    
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">
        🎤 Hoda Voice Commands
      </div>
      <pre style="white-space: pre-wrap; font-family: system-ui; font-size: 13px; line-height: 1.6;">
${text}
      </pre>
    `;

    overlay.style.maxWidth = '500px';
    overlay.style.maxHeight = '600px';
    overlay.style.overflowY = 'auto';
  }

  /**
   * Helper: Create overlay element
   */
  createOverlay(id) {
    // Remove existing
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = id;
    
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '80px',
      right: '20px',
      padding: '20px',
      borderRadius: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      zIndex: '2147483646',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      maxWidth: '400px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    });

    document.body.appendChild(overlay);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(() => overlay.remove(), 500);
    }, 8000);

    return overlay;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.linkList = [];
    
    // Remove overlays
    ['hoda-link-list', 'hoda-help'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    console.log('[Executor] Destroyed');
  }
}

export default CommandExecutor;