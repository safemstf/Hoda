// tests/index.js - Test Launcher with Settings Management & Keyboard Shortcuts
// External module for test-launcher.html

(async () => {
  console.log('🧪 Hoda Test Launcher & Settings initialized');

  // Default settings
  const DEFAULT_SETTINGS = {
    wakeWordRequired: false,
    audioFeedback: true,
    visualFeedback: true,
    llmEnabled: false,
    shortcuts: {
      toggleListening: { keys: ['Ctrl', 'Shift', 'H'], enabled: true },
      openSettings: { keys: ['Ctrl', 'Shift', 'S'], enabled: true },
      startTutorial: { keys: ['Ctrl', 'Shift', 'T'], enabled: true },
      toggleExtension: { keys: ['Ctrl', 'Shift', 'E'], enabled: true }
    }
  };

  // Current settings (loaded from storage)
  let currentSettings = { ...DEFAULT_SETTINGS };

  // Shortcut recording state
  let recordingShortcut = null;
  let recordedKeys = [];

  // ============================================================================
  // KEYBOARD SHORTCUTS MANAGEMENT
  // ============================================================================

  /**
   * Default shortcuts configuration
   */
  const SHORTCUTS_CONFIG = [
    {
      id: 'toggleListening',
      label: 'Toggle Voice Listening',
      description: 'Start/stop voice recognition',
      icon: '🎤',
      action: () => {
        console.log('Toggle listening triggered');
        // Send message to background script or content script
        sendShortcutMessage('toggleListening');
      }
    },
    {
      id: 'openSettings',
      label: 'Open Settings',
      description: 'Open Hoda settings page',
      icon: '⚙️',
      action: () => {
        console.log('Open settings triggered');
        sendShortcutMessage('openSettings');
      }
    },
    {
      id: 'startTutorial',
      label: 'Start Tutorial',
      description: 'Begin interactive tutorial',
      icon: '🎓',
      action: () => {
        console.log('Start tutorial triggered');
        sendShortcutMessage('startTutorial');
      }
    },
    {
      id: 'toggleExtension',
      label: 'Toggle Extension',
      description: 'Enable/disable Hoda extension',
      icon: '🔌',
      action: () => {
        console.log('Toggle extension triggered');
        sendShortcutMessage('toggleExtension');
      }
    }
  ];

  /**
   * Send shortcut message to background/content scripts
   */
  function sendShortcutMessage(action) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ 
        type: 'SHORTCUT_TRIGGERED', 
        action: action 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending shortcut message:', chrome.runtime.lastError);
          showStatus(`Shortcut action failed: ${chrome.runtime.lastError.message}`, 'error');
        } else {
          console.log('Shortcut message sent:', action, response);
          showStatus(`Shortcut triggered: ${action}`, 'success');
        }
      });
    } else {
      console.log('Chrome runtime not available, shortcut action:', action);
      showStatus(`Shortcut simulated: ${action}`, 'info');
    }
  }

  /**
   * Render shortcuts UI
   */
  function renderShortcuts() {
    const shortcutsGrid = document.getElementById('shortcutsGrid');
    if (!shortcutsGrid) return;

    shortcutsGrid.innerHTML = '';

    SHORTCUTS_CONFIG.forEach(shortcut => {
      const shortcutData = currentSettings.shortcuts[shortcut.id] || DEFAULT_SETTINGS.shortcuts[shortcut.id];
      
      const shortcutItem = document.createElement('div');
      shortcutItem.className = 'shortcut-item';
      
      shortcutItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <span style="font-size: 20px;">${shortcut.icon}</span>
          <div>
            <div class="shortcut-label">${shortcut.label}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px;">
              ${shortcut.description}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="shortcut-keys">
            ${shortcutData.keys.map(key => `<span class="key-badge">${key}</span>`).join('<span class="key-separator">+</span>')}
          </div>
          <button class="shortcut-edit-btn" data-shortcut-id="${shortcut.id}">
            ✏️ Edit
          </button>
        </div>
      `;
      
      shortcutsGrid.appendChild(shortcutItem);
    });

    // Attach edit button listeners
    document.querySelectorAll('.shortcut-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shortcutId = e.target.getAttribute('data-shortcut-id');
        openShortcutModal(shortcutId);
      });
    });
  }

  /**
   * Open shortcut recording modal
   */
  function openShortcutModal(shortcutId) {
    const modal = document.getElementById('shortcutModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalInstruction = document.getElementById('modalInstruction');
    const recording = document.getElementById('shortcutRecording');
    
    const shortcut = SHORTCUTS_CONFIG.find(s => s.id === shortcutId);
    if (!shortcut) return;

    recordingShortcut = shortcutId;
    recordedKeys = [];

    modalTitle.textContent = `Edit: ${shortcut.label}`;
    modalInstruction.textContent = 'Press your desired key combination (e.g., Ctrl+Shift+K)';
    recording.innerHTML = '<span style="color: rgba(255,255,255,0.5); font-size: 14px;">Waiting for input...</span>';
    recording.classList.add('active');
    
    modal.classList.add('active');
    
    // Disable save button initially
    document.getElementById('saveShortcutBtn').disabled = true;
  }

  /**
   * Close shortcut recording modal
   */
  function closeShortcutModal() {
    const modal = document.getElementById('shortcutModal');
    const recording = document.getElementById('shortcutRecording');
    
    modal.classList.remove('active');
    recording.classList.remove('active');
    recordingShortcut = null;
    recordedKeys = [];
  }

  /**
   * Handle key press during shortcut recording
   */
  function handleShortcutKeyDown(e) {
    const modal = document.getElementById('shortcutModal');
    if (!modal.classList.contains('active')) return;

    e.preventDefault();
    e.stopPropagation();

    recordedKeys = [];
    
    // Capture modifiers
    if (e.ctrlKey) recordedKeys.push('Ctrl');
    if (e.shiftKey) recordedKeys.push('Shift');
    if (e.altKey) recordedKeys.push('Alt');
    if (e.metaKey) recordedKeys.push('Meta');

    // Capture main key (ignore modifier keys themselves)
    const ignoredKeys = ['Control', 'Shift', 'Alt', 'Meta'];
    if (!ignoredKeys.includes(e.key)) {
      recordedKeys.push(e.key.toUpperCase());
    }

    // Update UI
    updateShortcutRecording();
  }

  /**
   * Update shortcut recording display
   */
  function updateShortcutRecording() {
    const recording = document.getElementById('shortcutRecording');
    const saveBtn = document.getElementById('saveShortcutBtn');

    if (recordedKeys.length > 0) {
      recording.innerHTML = recordedKeys
        .map(key => `<span class="key-badge">${key}</span>`)
        .join('<span class="key-separator">+</span>');
      saveBtn.disabled = false;
    } else {
      recording.innerHTML = '<span style="color: rgba(255,255,255,0.5); font-size: 14px;">Waiting for input...</span>';
      saveBtn.disabled = true;
    }
  }

  /**
   * Save recorded shortcut
   */
  async function saveRecordedShortcut() {
    if (!recordingShortcut || recordedKeys.length === 0) return;

    // Check for conflicts
    const conflict = Object.entries(currentSettings.shortcuts).find(([id, data]) => {
      if (id === recordingShortcut) return false;
      return JSON.stringify(data.keys) === JSON.stringify(recordedKeys);
    });

    if (conflict) {
      const conflictShortcut = SHORTCUTS_CONFIG.find(s => s.id === conflict[0]);
      if (!confirm(`This shortcut is already assigned to "${conflictShortcut.label}". Override?`)) {
        return;
      }
    }

    // Save to settings
    currentSettings.shortcuts[recordingShortcut] = {
      keys: recordedKeys,
      enabled: true
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ shortcuts: currentSettings.shortcuts });
        showStatus('✅ Shortcut saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Error saving shortcut:', error);
      showStatus(`❌ Error saving shortcut: ${error.message}`, 'error');
    }

    // Update UI
    renderShortcuts();
    closeShortcutModal();
  }

  /**
   * Setup shortcut modal listeners
   */
  function setupShortcutModalListeners() {
    // Save button
    document.getElementById('saveShortcutBtn').addEventListener('click', saveRecordedShortcut);

    // Cancel button
    document.getElementById('cancelShortcutBtn').addEventListener('click', closeShortcutModal);

    // Close on outside click
    document.getElementById('shortcutModal').addEventListener('click', (e) => {
      if (e.target.id === 'shortcutModal') {
        closeShortcutModal();
      }
    });

    // Global keydown listener for recording
    document.addEventListener('keydown', handleShortcutKeyDown);
  }

  /**
   * Register global keyboard shortcuts
   */
  function registerGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if modal is open
      const modal = document.getElementById('shortcutModal');
      if (modal && modal.classList.contains('active')) return;

      // Don't trigger in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Check each shortcut
      SHORTCUTS_CONFIG.forEach(shortcut => {
        const shortcutData = currentSettings.shortcuts[shortcut.id];
        if (!shortcutData || !shortcutData.enabled) return;

        const keys = shortcutData.keys;
        let match = true;

        // Check modifiers
        if (keys.includes('Ctrl') !== e.ctrlKey) match = false;
        if (keys.includes('Shift') !== e.shiftKey) match = false;
        if (keys.includes('Alt') !== e.altKey) match = false;
        if (keys.includes('Meta') !== e.metaKey) match = false;

        // Check main key
        const mainKey = keys.find(k => !['Ctrl', 'Shift', 'Alt', 'Meta'].includes(k));
        if (mainKey && e.key.toUpperCase() !== mainKey) match = false;

        if (match) {
          e.preventDefault();
          console.log('Shortcut triggered:', shortcut.id);
          shortcut.action();
        }
      });
    });
  }

  // ============================================================================
  // SETTINGS MANAGEMENT
  // ============================================================================

  /**
   * Load settings from chrome.storage.local
   */
  async function loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get([
          'wakeWordRequired',
          'audioFeedback',
          'visualFeedback',
          'llmEnabled',
          'rateLimitReset',
          'dailyUsage',
          'shortcuts'
        ]);

        console.log('Loaded settings:', result);

        // Update current settings
        currentSettings = {
          wakeWordRequired: result.wakeWordRequired ?? DEFAULT_SETTINGS.wakeWordRequired,
          audioFeedback: result.audioFeedback ?? DEFAULT_SETTINGS.audioFeedback,
          visualFeedback: result.visualFeedback ?? DEFAULT_SETTINGS.visualFeedback,
          llmEnabled: result.llmEnabled ?? DEFAULT_SETTINGS.llmEnabled,
          shortcuts: result.shortcuts ?? DEFAULT_SETTINGS.shortcuts
        };

        // Update UI
        updateSettingsUI();
        renderShortcuts();
        updateQuotaUI(result.dailyUsage || 0);

        showStatus('Settings loaded', 'success');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus(`Error loading settings: ${error.message}`, 'error');
    }
  }

  /**
   * Update UI controls to match current settings
   */
  function updateSettingsUI() {
    // Wake word required
    const wakeWordCheckbox = document.getElementById('wakeWordRequired');
    const wakeWordStatus = document.getElementById('wakeWordStatus');
    if (wakeWordCheckbox) {
      wakeWordCheckbox.checked = currentSettings.wakeWordRequired;
      if (wakeWordStatus) {
        wakeWordStatus.textContent = currentSettings.wakeWordRequired ? 'Required' : 'Optional';
        wakeWordStatus.className = currentSettings.wakeWordRequired 
          ? 'setting-badge warning' 
          : 'setting-badge';
      }
    }

    // Audio feedback
    const audioCheckbox = document.getElementById('audioFeedback');
    if (audioCheckbox) {
      audioCheckbox.checked = currentSettings.audioFeedback;
    }

    // Visual feedback
    const visualCheckbox = document.getElementById('visualFeedback');
    if (visualCheckbox) {
      visualCheckbox.checked = currentSettings.visualFeedback;
    }

    // LLM (disabled for now)
    const llmCheckbox = document.getElementById('llmEnabled');
    if (llmCheckbox) {
      llmCheckbox.checked = currentSettings.llmEnabled;
      llmCheckbox.disabled = true; // Future feature
    }
  }

  /**
   * Update quota display
   */
  function updateQuotaUI(dailyUsage) {
    const quotaUsed = document.getElementById('quotaUsed');
    const quotaTotal = document.getElementById('quotaTotal');
    const quotaFill = document.getElementById('quotaFill');

    const total = 40;
    const remaining = total - dailyUsage;
    const percentage = (remaining / total) * 100;

    if (quotaUsed) {
      quotaUsed.textContent = remaining;
    }

    if (quotaTotal) {
      quotaTotal.textContent = total;
    }

    if (quotaFill) {
      quotaFill.style.width = `${percentage}%`;
      
      // Change color based on remaining
      if (percentage < 25) {
        quotaFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (percentage < 50) {
        quotaFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        quotaFill.style.background = 'linear-gradient(90deg, #10b981, #6366f1)';
      }
    }
  }

  /**
   * Save settings to chrome.storage.local
   */
  async function saveSettings() {
    try {
      // Get values from UI
      const wakeWordCheckbox = document.getElementById('wakeWordRequired');
      const audioCheckbox = document.getElementById('audioFeedback');
      const visualCheckbox = document.getElementById('visualFeedback');
      const llmCheckbox = document.getElementById('llmEnabled');

      const settingsToSave = {
        wakeWordRequired: wakeWordCheckbox?.checked ?? false,
        audioFeedback: audioCheckbox?.checked ?? true,
        visualFeedback: visualCheckbox?.checked ?? true,
        llmEnabled: llmCheckbox?.checked ?? false,
        shortcuts: currentSettings.shortcuts
      };

      console.log('Saving settings:', settingsToSave);

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set(settingsToSave);
        currentSettings = settingsToSave;
        
        showStatus('✅ Settings saved successfully!', 'success');
        
        // Update UI
        updateSettingsUI();
      } else {
        showStatus('⚠️ Chrome storage not available', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(`❌ Error saving settings: ${error.message}`, 'error');
    }
  }

  /**
   * Reset settings to defaults
   */
  async function resetSettings() {
    try {
      if (!confirm('Reset all settings (including shortcuts) to defaults?')) {
        return;
      }

      console.log('Resetting settings to defaults');

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set(DEFAULT_SETTINGS);
        currentSettings = { ...DEFAULT_SETTINGS };
        
        // Update UI
        updateSettingsUI();
        renderShortcuts();
        
        showStatus('🔄 Settings reset to defaults', 'success');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus(`❌ Error resetting settings: ${error.message}`, 'error');
    }
  }

  /**
   * Setup settings event listeners
   */
  function setupSettingsListeners() {
    // Save button
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
      saveButton.addEventListener('click', saveSettings);
    }

    // Reset button
    const resetButton = document.getElementById('resetSettings');
    if (resetButton) {
      resetButton.addEventListener('click', resetSettings);
    }

    // Wake word status update
    const wakeWordCheckbox = document.getElementById('wakeWordRequired');
    const wakeWordStatus = document.getElementById('wakeWordStatus');
    if (wakeWordCheckbox && wakeWordStatus) {
      wakeWordCheckbox.addEventListener('change', (e) => {
        wakeWordStatus.textContent = e.target.checked ? 'Required' : 'Optional';
        wakeWordStatus.className = e.target.checked 
          ? 'setting-badge warning' 
          : 'setting-badge';
      });
    }
  }

  // ============================================================================
  // TEST LAUNCHER FUNCTIONALITY
  // ============================================================================

  /**
   * Show status messages
   */
  const showStatus = (message, type = 'info') => {
    const statusContainer = document.getElementById('statusContainer');
    const statusMsg = document.getElementById('statusMsg');
    
    if (!statusContainer || !statusMsg) return;
    
    statusMsg.textContent = message;
    statusMsg.className = `result ${type === 'error' ? 'error' : 'success'} show`;
    statusContainer.hidden = false;
    
    // Auto-hide info messages after 3 seconds
    if (type === 'info' || type === 'success') {
      setTimeout(() => {
        statusContainer.hidden = true;
      }, 3000);
    }
  };

  /**
   * Get the correct URL for a test file
   */
  function getTestUrl(filename) {
    // If we're in extension context, use runtime.getURL
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`tests/${filename}`);
    }
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
      return browser.runtime.getURL(`tests/${filename}`);
    }
    // Otherwise use relative path
    return filename;
  }

  /**
   * Open test in new tab
   */
  function openTestInNewTab(filename) {
    try {
      const url = getTestUrl(filename);
      const newWindow = window.open(url, '_blank');
      if (newWindow) {
        showStatus(`Opened ${filename} in new tab`, 'success');
      } else {
        showStatus('Popup blocked? Please allow popups for this site', 'error');
      }
    } catch (error) {
      showStatus(`Error opening ${filename}: ${error.message}`, 'error');
    }
  }

  /**
   * Open test in preview iframe
   */
  function openTestInPreview(filename) {
    try {
      const url = getTestUrl(filename);
      const preview = document.getElementById('preview');
      if (preview) {
        preview.src = url;
        showStatus(`Loaded ${filename} in preview`, 'success');
      }
    } catch (error) {
      showStatus(`Error loading ${filename}: ${error.message}`, 'error');
    }
  }

  /**
   * Navigate to test in current tab
   */
  function openTestInCurrentTab(filename) {
    try {
      const url = getTestUrl(filename);
      window.location.href = url;
    } catch (error) {
      showStatus(`Error navigating to ${filename}: ${error.message}`, 'error');
    }
  }

  /**
   * Main test launcher function
   */
  function launchTest(filename, action) {
    const openInNewTabCheckbox = document.getElementById('openInNewTab');
    const openInNewTab = openInNewTabCheckbox ? openInNewTabCheckbox.checked : true;
    
    console.log(`Launching test: ${filename}, action: ${action}, newTab: ${openInNewTab}`);
    
    if (action === 'open') {
      if (openInNewTab) {
        openTestInNewTab(filename);
      } else {
        openTestInCurrentTab(filename);
      }
    } else if (action === 'preview') {
      openTestInPreview(filename);
    }
  }

  /**
   * Attach event listeners to all test buttons
   */
  function initializeTestListeners() {
    // Open Test buttons
    const openButtons = document.querySelectorAll('[data-file]');
    openButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const filename = button.getAttribute('data-file');
        launchTest(filename, 'open');
      });
    });

    // Preview buttons
    const previewButtons = document.querySelectorAll('[data-preview]');
    previewButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const filename = button.getAttribute('data-preview');
        launchTest(filename, 'preview');
      });
    });

    console.log(`Initialized ${openButtons.length} open buttons and ${previewButtons.length} preview buttons`);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the launcher
   */
  async function initializeLauncher() {
    try {
      // Load settings first
      await loadSettings();
      
      // Setup event listeners
      setupSettingsListeners();
      setupShortcutModalListeners();
      initializeTestListeners();
      
      // Register global shortcuts
      registerGlobalShortcuts();
      
      console.log('✅ Test launcher & settings initialized');
      
    } catch (error) {
      console.error('Error initializing launcher:', error);
      showStatus(`Launcher error: ${error.message}`, 'error');
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLauncher);
  } else {
    initializeLauncher();
  }

  // Export functions for global access if needed
  window.launchTest = launchTest;
  window.showStatus = showStatus;
  window.saveSettings = saveSettings;
  window.resetSettings = resetSettings;

})();