// content.js - With Command Queue System
console.log('[Content] Loading with command queue...');

(function() {
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

    async doStop() {
      console.log('[Executor] STOP command');
      
      // Interrupt queue
      if (window.__hoda_queue) {
        window.__hoda_queue.interrupt();
      }

      return { success: true, message: 'Stopped' };
    }

    async doNavigate(slots) {
      const dir = slots.direction;
      const target = slots.target;

      if (target === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return { success: true, message: 'Scrolled to top' };
      }

      if (target === 'bottom') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return { success: true, message: 'Scrolled to bottom' };
      }

      if (dir === 'back') {
        window.history.back();
        return { success: true, message: 'Going back' };
      }

      if (dir === 'forward') {
        window.history.forward();
        return { success: true, message: 'Going forward' };
      }

      const amt = window.innerHeight * 0.5;
      const y = dir === 'down' ? amt : -amt;
      window.scrollBy({ top: y, behavior: 'smooth' });
      
      return { success: true, message: `Scrolled ${dir}` };
    }

    async doZoom(slots) {
      const action = slots.action;
      let zoom = parseFloat(document.body.style.zoom) || 1.0;

      if (action === 'in' || action === 'bigger') {
        zoom += 0.1;
      } else if (action === 'out' || action === 'smaller') {
        zoom -= 0.1;
      } else if (action === 'reset' || action === 'normal') {
        zoom = 1.0;
      }

      zoom = Math.max(0.5, Math.min(3.0, zoom));
      document.body.style.zoom = zoom;

      return { success: true, message: `Zoom: ${Math.round(zoom * 100)}%` };
    }

    async doLinkAction(slots) {
      if (slots.action === 'list' || !slots.action) {
        this.linkList = Array.from(document.querySelectorAll('a[href]'));
        
        // Show visual list
        this.showLinkList(this.linkList.slice(0, 10));
        
        console.log('[Executor] Found', this.linkList.length, 'links');
        return { success: true, message: `Found ${this.linkList.length} links` };
      }

      if (slots.linkNumber) {
        const idx = slots.linkNumber - 1;
        if (idx >= 0 && idx < this.linkList.length) {
          this.linkList[idx].click();
          return { success: true, message: `Opening link ${slots.linkNumber}` };
        }
        return { success: false, message: `Link ${slots.linkNumber} not found` };
      }

      return { success: false, message: 'Invalid link action' };
    }

    async doRead(slots) {
      const action = slots.action;

      if (action === 'stop') {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          return { success: true, message: 'Stopped reading' };
        }
        return { success: false, message: 'Not reading' };
      }

      if (action === 'pause') {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          return { success: true, message: 'Paused' };
        }
        return { success: false, message: 'Not reading' };
      }

      if (action === 'resume') {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          return { success: true, message: 'Resumed' };
        }
        return { success: false, message: 'Nothing to resume' };
      }

      // Start reading
      const text = this.extractPageText();
      if (!text) {
        return { success: false, message: 'No text found' };
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);

      return { success: true, message: 'Reading' };
    }

    async doHelp() {
      const helpText = `Voice Commands:
• Navigation: "scroll down", "scroll up", "go to top"
• Reading: "read page", "stop reading", "pause"
• Zoom: "zoom in", "zoom out", "reset zoom"
• Links: "list links", "open link 1"
• Stop: Say "stop" to interrupt current action

Activation:
• Click mic button in popup
• Or press Ctrl+Shift+H (Cmd+Shift+H on Mac)

Wake Word (Optional):
• Say "Hoda" + command (e.g., "Hoda scroll down")
• Or just say command directly`;

      this.showHelpOverlay(helpText);
      console.log('[Executor] Help shown');
      return { success: true, message: 'Help shown' };
    }

    extractPageText() {
      const main = document.querySelector('main, article, .content, [role="main"]');
      const target = main || document.body;
      const clone = target.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
      return clone.textContent.trim().substring(0, 5000);
    }

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
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        zIndex: '2147483646',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '400px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      });

      document.body.appendChild(overlay);

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