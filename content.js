// content.js - With Command Queue System
console.log('[Content] Loading with command queue...');

(function () {
  'use strict';

  // ============================================================================
  // COMMAND QUEUE (Sequential Processing)
  // ============================================================================
  class CommandQueue {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
      this.currentCommand = null;
      this.interruptRequested = false;
      console.log('[Queue] Initialized');
    }

    /**
     * Add command to queue
     * Priority commands (stop, cancel) jump to front
     */
    enqueue(command, priority = false) {
      const queueItem = {
        command,
        timestamp: Date.now(),
        id: this.generateId()
      };

      if (priority) {
        console.log('[Queue] 🚨 Priority command:', command.intent);
        this.queue.unshift(queueItem); // Add to front

        // If something is running, request interrupt
        if (this.isProcessing) {
          this.interruptRequested = true;
        }
      } else {
        console.log('[Queue] ➕ Enqueued:', command.intent);
        this.queue.push(queueItem);
      }

      // Start processing if not already
      if (!this.isProcessing) {
        this.processNext();
      }

      return queueItem.id;
    }

    /**
     * Process next command in queue
     */
    async processNext() {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        this.currentCommand = null;
        console.log('[Queue] ✅ Queue empty');
        return;
      }

      this.isProcessing = true;
      const item = this.queue.shift();
      this.currentCommand = item;
      this.interruptRequested = false;

      console.log('[Queue] 🔄 Processing:', item.command.intent);

      try {
        // Execute command
        await this.executeCommand(item.command);

        console.log('[Queue] ✅ Completed:', item.command.intent);
      } catch (err) {
        console.error('[Queue] ❌ Error:', err);
      } finally {
        this.currentCommand = null;

        // Check if interrupted
        if (this.interruptRequested) {
          console.log('[Queue] ⚠️ Interrupted, clearing queue');
          this.queue = [];
          this.interruptRequested = false;
        }

        // Process next (with small delay to prevent blocking)
        setTimeout(() => this.processNext(), 50);
      }
    }

    /**
     * Execute command (delegated to executor)
     */
    async executeCommand(command) {
      return window.__hoda_executor.execute(command);
    }

    /**
     * Stop/interrupt current command
     */
    interrupt() {
      console.log('[Queue] 🛑 Interrupt requested');
      this.interruptRequested = true;

      // Clear queue
      this.queue = [];

      // Stop any ongoing actions
      this.stopCurrentAction();
    }

    /**
     * Stop ongoing actions (scrolling, TTS, etc.)
     */
    stopCurrentAction() {
      // Stop text-to-speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        console.log('[Queue] Stopped TTS');
      }

      // Stop smooth scrolling (force immediate stop)
      if (this.currentCommand?.command.intent === 'navigate') {
        window.scrollTo({
          top: window.scrollY,
          behavior: 'auto' // Immediate stop
        });
        console.log('[Queue] Stopped scrolling');
      }
    }

    /**
     * Clear all queued commands
     */
    clear() {
      console.log('[Queue] 🗑️ Clearing queue');
      this.queue = [];
      this.interruptRequested = false;
    }

    /**
     * Get queue status
     */
    getStatus() {
      return {
        queueLength: this.queue.length,
        isProcessing: this.isProcessing,
        currentCommand: this.currentCommand?.command.intent || null,
        interruptRequested: this.interruptRequested
      };
    }

    /**
     * Check if command should have priority
     */
    isPriorityCommand(intent) {
      const priorityIntents = ['stop', 'cancel', 'pause', 'interrupt'];
      return priorityIntents.includes(intent);
    }

    /**
     * Generate unique ID
     */
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }

  // ============================================================================
  // FEEDBACK MANAGER
  // ============================================================================
  class FeedbackManager {
    constructor() {
      this.audioContext = null;
      this.settings = {
        audioEnabled: true,
        visualEnabled: true
      };
      this.initAudioContext();
      this.loadSettings();
    }

    async loadSettings() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get(['audioFeedback', 'visualFeedback']);
          this.settings.audioEnabled = result.audioFeedback !== false;
          this.settings.visualEnabled = result.visualFeedback !== false;
          console.log('[Feedback] Settings loaded:', this.settings);
        }
      } catch (err) {
        console.warn('[Feedback] Could not load settings:', err);
      }
    }

    initAudioContext() {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) {
        console.warn('[Feedback] Audio unavailable:', err);
      }
    }

    playBeep(type = 'success') {
      if (!this.settings.audioEnabled || !this.audioContext) return;

      try {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        if (type === 'success') {
          osc.frequency.value = 800;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.1);
        } else if (type === 'error') {
          osc.frequency.value = 200;
          osc.type = 'sawtooth';
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.15);
        } else if (type === 'stop') {
          // Double low beep for stop
          osc.frequency.value = 300;
          gain.gain.value = 0.25;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.08);

          setTimeout(() => {
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(this.audioContext.destination);
            osc2.frequency.value = 250;
            gain2.gain.value = 0.25;
            osc2.start();
            osc2.stop(this.audioContext.currentTime + 0.08);
          }, 100);
        }
      } catch (err) {
        console.error('[Feedback] Beep error:', err);
      }
    }

    showOverlay(message, type = 'success') {
      if (!this.settings.visualEnabled) return;

      let overlay = document.getElementById('hoda-feedback-overlay');

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hoda-feedback-overlay';
        document.body.appendChild(overlay);
      }

      const bgColor = type === 'error'
        ? 'rgba(244, 67, 54, 0.95)'
        : type === 'warning'
          ? 'rgba(245, 158, 11, 0.95)'
          : 'rgba(76, 175, 80, 0.95)';

      Object.assign(overlay.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        backgroundColor: bgColor,
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '2147483647',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        pointerEvents: 'none',
        transition: 'opacity 0.3s',
        opacity: '1'
      });

      overlay.textContent = message;

      clearTimeout(overlay._timer);
      overlay._timer = setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }, 2000);
    }

    confirmCommand(command) {
      this.playBeep('success');
      this.showOverlay(`✓ "${command.original || ''}"`, 'success');
    }

    showError(message) {
      this.playBeep('error');
      this.showOverlay('⚠️ ' + message, 'error');
    }

    showStop() {
      this.playBeep('stop');
      this.showOverlay('🛑 Stopped', 'warning');
    }
  }

  // ============================================================================
  // COMMAND EXECUTOR
  // ============================================================================
  class CommandExecutor {
    constructor(feedback) {
      this.feedback = feedback;
      this.linkList = [];
      // TTS controller (chunked reading)
      this._tts = {
        utterance: null,
        readingText: '',
        chunks: [],
        chunkIndex: 0,
        autoContinue: false,
        stopped: false
      };
      console.log('[Executor] Initialized');
    }

    async execute(cmd) {
      const intent = cmd.intent || cmd.normalized?.intent;
      const slots = cmd.slots || cmd.normalized?.slots || {};

      console.log('[Executor] Executing:', intent, slots);

      try {
        let result;

        // Handle stop/cancel commands immediately
        if (intent === 'stop' || intent === 'cancel') {
          result = await this.doStop();
          if (this.feedback) this.feedback.showStop();
          return result;
        }

        switch (intent) {
          case 'navigate':
            result = await this.doNavigate(slots);
            break;
          case 'zoom':
            result = await this.doZoom(slots);
            break;
          case 'link_action':
            result = await this.doLinkAction(slots);
            break;
          case 'read':
            result = await this.doRead(slots);
            break;
          case 'find_content':
            result = await this.doFindContent(slots);
            break;
          case 'help':
            result = await this.doHelp();
            break;
          default:
            result = { success: false, message: `Unknown: ${intent}` };
        }

        if (result.success && this.feedback) {
          this.feedback.confirmCommand(cmd);
        } else if (!result.success && this.feedback) {
          this.feedback.showError(result.message);
        }

        return result;
      } catch (err) {
        console.error('[Executor] Error:', err);
        if (this.feedback) this.feedback.showError(err.message);
        return { success: false, message: err.message };
      }
    }

    // ---- STOP ----
    async doStop() {
      console.log('[Executor] STOP command');

      // Interrupt queue if present
      if (window.__hoda_queue && typeof window.__hoda_queue.interrupt === 'function') {
        try { window.__hoda_queue.interrupt(); } catch (e) { }
      }

      // Stop reading via helper (cancels speechSynthesis & clears chunks)
      this.stopReading();

      return { success: true, message: 'Stopped' };
    }


    /**
     * ENHANCED LINK ACTION with TTS support
     */
    async doLinkAction(slots) {
      const action = slots.action;
      const linkNumber = slots.linkNumber;
      const target = slots.target;

      // List links and READ them aloud
      if (action === 'list' || !action) {
        this.linkList = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.offsetParent !== null);

        const visible = this.linkList.slice(0, 10);

        // Show visual overlay
        this.showLinkList(visible);

        // READ the links aloud
        this.readLinkList(visible);

        console.log('[Executor] Found', this.linkList.length, 'links');
        return { success: true, message: `Found ${this.linkList.length} links` };
      }

      // Open link by number
      if (linkNumber !== undefined && linkNumber !== null) {
        const index = Number(linkNumber) - 1;
        if (!this.linkList || this.linkList.length === 0) {
          return { success: false, message: 'No link list cached. Say "list links" first.' };
        }
        if (index >= 0 && index < this.linkList.length) {
          const link = this.linkList[index];

          // Announce which link is being opened
          this.speakShort(`Opening link ${linkNumber}: ${this.getLinkText(link)}`);

          try {
            link.focus();
            link.click();
          } catch (e) {
            window.location.href = link.href;
          }
          return { success: true, message: `Opening link ${linkNumber}` };
        }
        return { success: false, message: `Link ${linkNumber} not found` };
      }

      // Open link by text match
      if (target) {
        const q = target.toLowerCase();
        const found = Array.from(document.querySelectorAll('a[href]')).find(a =>
          ((a.textContent || a.getAttribute('aria-label') || a.href) || '').toLowerCase().includes(q)
        );
        if (found) {
          this.speakShort(`Opening ${target}`);
          try { found.focus(); found.click(); } catch (e) { window.location.href = found.href; }
          return { success: true, message: `Opening ${target}` };
        }
        return { success: false, message: `Link "${target}" not found` };
      }

      return { success: false, message: 'Invalid link action' };
    }

    /**
     * ENHANCED NAVIGATION with debugging
     */
    async doNavigate(slots) {
      const dir = slots.direction;
      const target = slots.target;
      const amount = slots.amount;

      // DEBUG: Log what we received
      console.log('[Executor] doNavigate called with:', { dir, target, amount });

      // Stop reading when navigating
      if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
        this.stopReading();
      }

      // TOP
      if (target === 'top' || dir === 'top') {
        console.log('[Executor] Going to TOP');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.speakShort('Going to top');
        return { success: true, message: 'Scrolled to top' };
      }

      // BOTTOM
      if (target === 'bottom' || dir === 'bottom') {
        console.log('[Executor] Going to BOTTOM');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        this.speakShort('Going to bottom');
        return { success: true, message: 'Scrolled to bottom' };
      }

      // BACK - Browser history
      if (dir === 'back') {
        console.log('[Executor] BACK - Navigating to previous page');

        // Try to speak (but don't let it block navigation)
        try {
          this.speakShort('Going back');
        } catch (e) {
          console.warn('[Executor] speakShort failed, continuing anyway:', e);
        }

        // Navigate back
        try {
          window.history.back();
          console.log('[Executor] ✅ history.back() called');
        } catch (e) {
          console.error('[Executor] ❌ history.back() failed:', e);
        }

        return { success: true, message: 'Going back' };
      }

      // FORWARD - Browser history
      if (dir === 'forward') {
        console.log('[Executor] FORWARD - Navigating to next page');

        try {
          this.speakShort('Going forward');
        } catch (e) {
          console.warn('[Executor] speakShort failed, continuing anyway:', e);
        }

        try {
          window.history.forward();
          console.log('[Executor] ✅ history.forward() called');
        } catch (e) {
          console.error('[Executor] ❌ history.forward() failed:', e);
        }

        return { success: true, message: 'Going forward' };
      }

      // REFRESH
      if (dir === 'refresh' || target === 'refresh') {
        console.log('[Executor] REFRESH - Reloading page');

        try {
          this.speakShort('Refreshing page');
        } catch (e) {
          console.warn('[Executor] speakShort failed:', e);
        }

        window.location.reload();
        return { success: true, message: 'Refreshing' };
      }

      // HOME (go to domain root)
      if (dir === 'home' || target === 'home') {
        console.log('[Executor] HOME - Going to homepage');

        try {
          this.speakShort('Going home');
        } catch (e) {
          console.warn('[Executor] speakShort failed:', e);
        }

        const url = new URL(window.location.href);
        const homeUrl = `${url.protocol}//${url.host}`;
        window.location.href = homeUrl;
        return { success: true, message: 'Going home' };
      }

      // SCROLL UP/DOWN
      console.log('[Executor] SCROLL - direction:', dir);

      let scrollAmount;
      if (amount === 'large') {
        scrollAmount = window.innerHeight * 1.5;
      } else if (!isNaN(Number(amount))) {
        scrollAmount = Number(amount);
      } else {
        scrollAmount = window.innerHeight * 0.5; // default
      }

      const scrollY = dir === 'down' ? scrollAmount : -scrollAmount;

      console.log('[Executor] Scrolling:', dir, 'amount:', scrollY);

      window.scrollBy({ top: scrollY, behavior: 'smooth' });

      return {
        success: true,
        message: `Scrolled ${dir}`
      };
    }

    /**
     * NEW: Read link list aloud
     */
    readLinkList(links) {
      if (!links || links.length === 0) return;

      // Stop any current reading
      this.stopReading();

      // Build spoken text
      const intro = `Found ${links.length} links. `;
      const linkDescriptions = links.map((link, i) => {
        const text = this.getLinkText(link);
        return `Link ${i + 1}: ${text}`;
      }).join('. ');

      const fullText = intro + linkDescriptions + '. Say "open link" followed by a number to open it.';

      // Speak it
      this.speakLong(fullText);
    }

    /**
     * NEW: Get readable text from link
     */
    getLinkText(link) {
      const text = (link.textContent || link.getAttribute('aria-label') || '').trim();
      if (text && text.length > 0) {
        return text.substring(0, 100); // Limit length
      }

      // Fallback to href
      try {
        const url = new URL(link.href);
        return url.pathname.split('/').filter(p => p).pop() || 'link';
      } catch (e) {
        return 'link';
      }
    }

    /**
     * NEW: Speak short announcements (non-blocking)
     */
    speakShort(text) {
      if (!text) return;

      try {
        // Cancel only if currently speaking something short
        // Don't interrupt long reading sessions
        if (window.speechSynthesis.speaking && !this._tts.autoContinue) {
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.volume = 0.9;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[Executor] speakShort failed:', e);
      }
    }

    /**
     * NEW: Speak longer content (like link lists)
     */
    speakLong(text) {
      if (!text) return;

      // Stop any current reading
      this.stopReading();

      // Use the chunked TTS system
      const chunks = this.chunkTextToSentences(text, 1600);
      if (!chunks || chunks.length === 0) return;

      this._tts.chunks = chunks;
      this._tts.chunkIndex = 0;
      this._tts.autoContinue = true;
      this._tts.stopped = false;

      this._speakNextChunk();
    }

    /**
     * ENHANCED: Better visual link list
     */
    showLinkList(links) {
      const overlay = this.createOverlay('hoda-link-list');

      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
      <span>🔗</span>
      <span>Available Links</span>
      <span style="font-size: 12px; opacity: 0.7; font-weight: normal;">(${links.length} shown)</span>
    </div>
    <div style="font-size: 12px; opacity: 0.8; margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
      🎤 Reading links aloud... Say "open link [number]"
    </div>
    ${links.map((link, i) => {
        const text = this.getLinkText(link);
        const href = link.href;

        return `
        <div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.06); border-radius: 6px; border-left: 3px solid #10b981;">
          <div style="display: flex; gap: 8px; align-items: start;">
            <strong style="color: #10b981; min-width: 30px;">${i + 1}.</strong>
            <div style="flex: 1;">
              <div style="margin-bottom: 4px;">${text}</div>
              <div style="font-size: 11px; opacity: 0.6; word-break: break-all;">${href.substring(0, 60)}${href.length > 60 ? '...' : ''}</div>
            </div>
          </div>
        </div>
      `;
      }).join('')}
    <div style="margin-top: 12px; font-size: 12px; opacity: 0.9; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 4px;">
      💡 Say "open link 1" (or any number) to navigate
    </div>
  `;

      overlay.style.maxHeight = '500px';
      overlay.style.overflowY = 'auto';
      overlay.style.maxWidth = '450px';

      // Auto-hide after reading completes (with extra time)
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.5s';
          setTimeout(() => overlay.remove(), 500);
        }
      }, 15000); // 15 seconds
    }

    // ---- ZOOM ----
    async doZoom(slots) {
      const action = slots.action;
      const amount = parseFloat(slots.amount) || 0.1;

      let currentZoom = parseFloat(document.body.style.zoom) || 1.0;

      if (action === 'in' || action === 'bigger') {
        currentZoom += amount;
      } else if (action === 'out' || action === 'smaller') {
        currentZoom -= amount;
      } else if (action === 'reset' || action === 'normal') {
        currentZoom = 1.0;
      }

      currentZoom = Math.max(0.5, Math.min(3.0, currentZoom));
      document.body.style.zoom = currentZoom;

      return {
        success: true,
        message: `Zoom: ${Math.round(currentZoom * 100)}%`
      };
    }

    // ---- FIND CONTENT (deterministic search + highlight) ----
    findAndHighlight(query) {
      if (!query) return { success: false, message: 'No search query provided' };

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const lowerQuery = query.toLowerCase();
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.toLowerCase();
        const idx = text.indexOf(lowerQuery);
        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + query.length);

          // create highlight element
          let highlight = document.createElement('mark');
          highlight.style.background = 'yellow';
          highlight.style.color = 'black';
          highlight.style.padding = '0 2px';

          // try to surround contents; if it fails (complex DOM), fallback gracefully
          try {
            range.surroundContents(highlight);
          } catch (e) {
            // fallback: split text node
            try {
              const parent = node.parentNode;
              const before = node.nodeValue.substring(0, idx);
              const matchText = node.nodeValue.substring(idx, idx + query.length);
              const after = node.nodeValue.substring(idx + query.length);

              const beforeNode = document.createTextNode(before);
              const afterNode = document.createTextNode(after);
              const matchNode = document.createElement('mark');
              matchNode.textContent = matchText;
              matchNode.style.background = 'yellow';
              matchNode.style.color = 'black';
              matchNode.style.padding = '0 2px';

              parent.insertBefore(beforeNode, node);
              parent.insertBefore(matchNode, node);
              parent.insertBefore(afterNode, node);
              parent.removeChild(node);

              highlight = matchNode; // ensure highlight references the created node
            } catch (innerErr) {
              console.error('[Executor] highlight fallback failed', innerErr);
            }
          }

          // scroll into view and remove highlight after short delay
          try {
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) { /* ignore */ }

          setTimeout(() => {
            try {
              if (highlight && highlight.parentNode) {
                const txt = document.createTextNode(highlight.textContent);
                highlight.parentNode.replaceChild(txt, highlight);
              }
            } catch (e) { /* ignore if DOM changed */ }
          }, 4000);

          return { success: true, message: `Found "${query}"` };
        }
      }

      return { success: false, message: `"${query}" not found` };
    }

    async doFindContent(slots) {
      const q = (slots.query || '').trim();
      if (!q) return { success: false, message: 'No search query provided' };
      try { return this.findAndHighlight(q); } catch (err) { console.error('[Executor] find error', err); return { success: false, message: 'Search error' }; }
    }

    // ---- READ / TTS (chunked + pause/resume/stop + scope) ----
    async doRead(slots) {
      const action = (slots.action || '').toLowerCase();
      // allow 'scope' to be 'page' (default) or 'this'/'visible' for viewport-only
      const scope = (slots.scope || slots.target || '').toLowerCase();

      // STOP
      if (action === 'stop') {
        if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
          this.stopReading();
          return { success: true, message: 'Stopped reading' };
        }
        return { success: false, message: 'Not reading' };
      }

      // PAUSE
      if (action === 'pause') {
        if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          return { success: true, message: 'Paused' };
        }
        return { success: false, message: 'Not currently speaking' };
      }

      // RESUME
      if (action === 'resume') {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          return { success: true, message: 'Resumed' };
        }
        // If paused state not present but chunks remain, restart sequential playing
        if (this._tts.chunks && this._tts.chunkIndex < this._tts.chunks.length) {
          this._tts.autoContinue = true;
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            this._speakNextChunk();
          }
          return { success: true, message: 'Resumed' };
        }
        return { success: false, message: 'Nothing to resume' };
      }

      // START reading (no action or 'start')
      // If already speaking, restart (stop then start)
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        this.stopReading();
      }

      // Determine text based on scope
      let text = '';
      if (scope === 'this' || scope === 'visible' || scope === 'this page') {
        text = this.getViewportText();
      } else {
        // default: full page
        text = this.extractPageText();
      }

      if (!text) return { success: false, message: 'No text found' };

      // Chunk text into sentence-ish chunks
      const chunks = this.chunkTextToSentences(text, 1600); // tune size if needed
      if (!chunks || chunks.length === 0) return { success: false, message: 'No readable content' };

      // Initialize _tts state
      this._tts.chunks = chunks;
      this._tts.chunkIndex = 0;
      this._tts.autoContinue = true;
      this._tts.stopped = false;

      // Start speaking first chunk
      this._speakNextChunk();

      return { success: true, message: `Reading (${scope === 'this' ? 'visible area' : 'page'})` };
    }

    // ---- HELP & UI helpers ----
    async doHelp() {
      const helpText = `
Voice Commands:
• Navigation: "scroll down", "scroll up", "go to top"
• Reading: "read page", "read this", "stop reading", "pause", "resume"
• Zoom: "zoom in", "zoom out", "reset zoom"
• Links: "list links", "open link 1"
• Search: "find login", "search for contact"
• Stop: Say "stop" to interrupt current action

Activation:
• Click mic button in popup
• Or press Ctrl+Shift+H (Cmd+Shift+H on Mac)

Wake Word (Optional):
• Say "Hoda" + command (e.g., "Hoda scroll down")
• Or just say command directly`.trim();

      this.showHelpOverlay(helpText);
      console.log('[Executor] Help shown');
      return { success: true, message: 'Help shown' };
    }

    // ------------------ Helpers for reading ------------------

    stopReading() {
      try {
        this._tts.stopped = true;
        this._tts.autoContinue = false;
        this._tts.chunks = [];
        this._tts.chunkIndex = 0;
        if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
          window.speechSynthesis.cancel();
        }
        this._tts.utterance = null;
        this._tts.readingText = '';
        console.log('[Executor] stopReading: cleared TTS state');
      } catch (e) {
        console.warn('[Executor] stopReading error', e);
      }
    }

    _speakNextChunk() {
      // safety checks
      if (this._tts.stopped) return;
      const idx = this._tts.chunkIndex;
      if (!this._tts.chunks || idx >= this._tts.chunks.length) {
        // finished
        this._tts.utterance = null;
        this._tts.autoContinue = false;
        console.log('[Executor] finished all chunks');
        return;
      }

      const chunk = this._tts.chunks[idx];
      const u = new SpeechSynthesisUtterance(chunk);
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 0.9;

      u.onend = () => {
        // if canceled, onend may still fire; check stopped
        if (this._tts.stopped) {
          this._tts.utterance = null;
          return;
        }
        this._tts.chunkIndex += 1;
        this._tts.utterance = null;
        if (this._tts.autoContinue && this._tts.chunkIndex < this._tts.chunks.length) {
          // small delay to allow interruptions
          setTimeout(() => {
            if (!this._tts.stopped) this._speakNextChunk();
          }, 200);
        } else {
          // finished or autoContinue false
          this._tts.autoContinue = false;
          this._tts.utterance = null;
        }
      };

      u.onerror = (e) => {
        console.error('[Executor] TTS chunk error', e);
        this._tts.utterance = null;
        this._tts.autoContinue = false;
      };

      this._tts.utterance = u;
      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error('[Executor] speak failed', e);
      }
    }

    // Get text only from elements visible in viewport (simple heuristic)
    getViewportText() {
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const rect = parent.getBoundingClientRect();
            // If parent intersects viewport
            if (rect.bottom < 0 || rect.top > window.innerHeight) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const parts = [];
        let n;
        while ((n = walker.nextNode())) {
          parts.push(n.nodeValue.trim());
          if (parts.length >= 200) break; // safety
        }
        return parts.join(' ').replace(/\s+/g, ' ').trim();
      } catch (e) {
        console.warn('[Executor] getViewportText failed', e);
        return '';
      }
    }

    // Split text into sentence-like chunks up to maxChunkChars
    chunkTextToSentences(text, maxChunkChars = 1600) {
      if (!text) return [];
      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      const chunks = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length <= maxChunkChars) {
          current += s + ' ';
        } else {
          if (current.trim()) chunks.push(current.trim());
          if (s.length > maxChunkChars) {
            for (let i = 0; i < s.length; i += maxChunkChars) {
              chunks.push(s.substring(i, i + maxChunkChars).trim());
            }
            current = '';
          } else {
            current = s + ' ';
          }
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks;
    }

    // ------------------ Existing helpers (unchanged) ------------------

    extractPageText() {
      const main = document.querySelector('main, article, .content, [role="main"]');
      const target = main || document.body;

      // clone and remove non-content elements
      const clone = target.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());

      return clone.textContent.trim().substring(0, 5000);
    }


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

    createOverlay(id) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();

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
        border: '1px solid rgba(255, 255, 255, 0.06)'
      });

      document.body.appendChild(overlay);

      // Auto-hide
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => overlay.remove(), 500);
      }, 8000);

      return overlay;
    }
  }

  // ============================================================================
  // INITIALIZE
  // ============================================================================
  const feedback = new FeedbackManager();
  const executor = new CommandExecutor(feedback);
  const queue = new CommandQueue();

  // Expose executor globally (queue needs it)
  window.__hoda_executor = executor;
  window.__hoda_queue = queue;

  // ============================================================================
  // MESSAGE LISTENER
  // ============================================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    console.log('[Content] 📨 Received:', msg.type);

    if (msg.type === 'PING') {
      sendResponse({ ok: true, url: location.href });
      return true;
    }

    if (msg.type === 'EXECUTE_COMMAND') {
      console.log('[Content] Adding to queue:', msg.command.intent);

      // Check if priority command (stop, cancel)
      const isPriority = queue.isPriorityCommand(msg.command.intent);

      // Add to queue
      const commandId = queue.enqueue(msg.command, isPriority);

      sendResponse({
        ok: true,
        queued: true,
        commandId: commandId,
        queueStatus: queue.getStatus()
      });

      return true;
    }

    if (msg.type === 'GET_QUEUE_STATUS') {
      sendResponse({
        ok: true,
        status: queue.getStatus()
      });
      return true;
    }

    if (msg.type === 'CLEAR_QUEUE') {
      queue.clear();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'TEST_FEEDBACK') {
      feedback.playBeep('success');
      feedback.showOverlay('✓ Working!', 'success');
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'RELOAD_SETTINGS') {
      feedback.loadSettings();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  // ============================================================================
  // DEBUG INTERFACE
  // ============================================================================
  window.__hoda = {
    feedback,
    executor,
    queue,

    test() {
      console.log('[Content] Testing...');
      feedback.playBeep('success');
      feedback.showOverlay('✓ Queue system working!', 'success');
    },

    testQueue() {
      console.log('[Content] Testing queue...');
      queue.enqueue({ intent: 'navigate', slots: { direction: 'down' }, original: 'test 1' });
      queue.enqueue({ intent: 'navigate', slots: { direction: 'down' }, original: 'test 2' });
      queue.enqueue({ intent: 'navigate', slots: { direction: 'down' }, original: 'test 3' });
      console.log('Queue status:', queue.getStatus());
    },

    testStop() {
      console.log('[Content] Testing stop...');
      queue.enqueue({ intent: 'stop', original: 'stop' }, true);
    }
  };

  console.log('[Content] ✅ Ready with command queue');
})();