// tests/index.js - Test Launcher with Settings Management
// External module for test-launcher.html

(async () => {
  console.log('🧪 Hoda Test Launcher & Settings initialized');

  // Default settings
  const DEFAULT_SETTINGS = {
    wakeWordRequired: false,
    audioFeedback: true,
    visualFeedback: true,
    llmEnabled: false
  };

  // Current settings (loaded from storage)
  let currentSettings = { ...DEFAULT_SETTINGS };

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
          'dailyUsage'
        ]);

        console.log('Loaded settings:', result);

        // Update current settings
        currentSettings = {
          wakeWordRequired: result.wakeWordRequired ?? DEFAULT_SETTINGS.wakeWordRequired,
          audioFeedback: result.audioFeedback ?? DEFAULT_SETTINGS.audioFeedback,
          visualFeedback: result.visualFeedback ?? DEFAULT_SETTINGS.visualFeedback,
          llmEnabled: result.llmEnabled ?? DEFAULT_SETTINGS.llmEnabled
        };

        // Update UI
        updateSettingsUI();
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
        llmEnabled: llmCheckbox?.checked ?? false
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
      if (!confirm('Reset all settings to defaults?')) {
        return;
      }

      console.log('Resetting settings to defaults');

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set(DEFAULT_SETTINGS);
        currentSettings = { ...DEFAULT_SETTINGS };
        
        // Update UI
        updateSettingsUI();
        
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
      initializeTestListeners();
      
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