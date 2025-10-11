// tests/index.js - Updated for Test Launcher
// External module for test-launcher.html — replaces inline script.

(async () => {
  console.log('🧪 Hoda Test Launcher initialized');

  // Show status messages
  const showStatus = (message, type = 'info') => {
    const statusContainer = document.getElementById('statusContainer');
    const statusMsg = document.getElementById('statusMsg');
    
    if (!statusContainer || !statusMsg) return;
    
    statusMsg.textContent = message;
    statusMsg.className = `result ${type === 'error' ? 'error' : 'success'} show`;
    statusContainer.hidden = false;
    
    // Auto-hide info messages after 3 seconds
    if (type === 'info') {
      setTimeout(() => {
        statusContainer.hidden = true;
      }, 3000);
    }
  };

  // Get the correct URL for a test file
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

  // Open test in new tab
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

  // Open test in preview iframe
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

  // Navigate to test in current tab
  function openTestInCurrentTab(filename) {
    try {
      const url = getTestUrl(filename);
      window.location.href = url;
    } catch (error) {
      showStatus(`Error navigating to ${filename}: ${error.message}`, 'error');
    }
  }

  // Main test launcher function
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

  // Attach event listeners to all test buttons
  function initializeEventListeners() {
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

    // Update status dots based on test availability (simulated)
    const statusDots = document.querySelectorAll('.status-dot');
    statusDots.forEach(dot => {
      // Simulate test availability - in real implementation, you'd check actual test status
      dot.className = 'status-dot pending';
    });

    console.log(`Initialized ${openButtons.length} open buttons and ${previewButtons.length} preview buttons`);
  }

  // Initialize the launcher
  function initializeLauncher() {
    try {
      initializeEventListeners();
      showStatus('Test launcher ready - click any test to begin', 'success');
      
      // Hide status after a moment
      setTimeout(() => {
        const statusContainer = document.getElementById('statusContainer');
        if (statusContainer) {
          statusContainer.hidden = true;
        }
      }, 3000);
      
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

  // Remove any microphone-related global functions that might conflict
  delete window.toggleMicrophone;
  delete window.pauseMicrophone;
  delete window.resumeMicrophone;
  delete window.stopMicrophone;
  delete window.runTest;
  delete window.runAllTests;

})();