// microphone-tests.js - CSP Compliant Version with Correct Import Paths

// Import fallback with correct paths for your structure
async function importMicrophoneManager() {
  // Try extension context first
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    try {
      const url = chrome.runtime.getURL('services/stt/src/microphoneManager.js');
      return await import(url);
    } catch (e) {
      console.warn('Extension import failed, trying relative paths:', e);
    }
  }
  
  // Fallback to relative paths - CORRECTED FOR YOUR STRUCTURE
  const paths = [
    '../services/stt/src/microphoneManager.js',  // from tests/ to services/stt/src/
    './services/stt/src/microphoneManager.js',   // same directory structure
    '/services/stt/src/microphoneManager.js',    // absolute path
    '../../services/stt/src/microphoneManager.js' // if tests is nested
  ];
  
  for (const path of paths) {
    try {
      console.log('Trying import path:', path);
      return await import(path);
    } catch (e) {
      console.warn('Failed to import from:', path, e);
      continue;
    }
  }
  
  throw new Error('Could not import MicrophoneManager from any path. Checked: ' + paths.join(', '));
}

// Import fallback for stt-tts-format
async function importSTTFormat() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    try {
      const url = chrome.runtime.getURL('services/stt/src/stt-tts-format.js');
      return await import(url);
    } catch (e) {
      console.warn('Extension import failed for stt-tts-format:', e);
    }
  }
  
  const paths = [
    '../services/stt/src/stt-tts-format.js',
    './services/stt/src/stt-tts-format.js',
    '/services/stt/src/stt-tts-format.js',
    '../../services/stt/src/stt-tts-format.js'
  ];
  
  for (const path of paths) {
    try {
      return await import(path);
    } catch (e) {
      continue;
    }
  }
  
  console.warn('Could not import stt-tts-format.js, continuing without it');
  return null;
}

// Main application
class MicrophoneTestApp {
  constructor() {
    this.micManager = null;
    this.isMainMicActive = false;
    this.volumeInterval = null;
    this.statusInterval = null;
    this.MicrophoneManager = null;
    this.sttFormat = null;
    
    this.init();
  }

  async init() {
    try {
      // Import the microphone manager with correct paths
      const module = await importMicrophoneManager();
      this.MicrophoneManager = module.MicrophoneManager || module.default;
      
      // Try to import stt-tts-format (optional)
      this.sttFormat = await importSTTFormat();
      
      // Initialize the app
      this.setupEventListeners();
      this.detectBrowser();
      console.log('Microphone Test App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showTopError('Initialization Error', error);
      this.setupFallbackHandlers();
    }
  }

  // Fallback handlers if imports fail
  setupFallbackHandlers() {
    console.warn('Setting up fallback handlers due to import failure');
    
    // Provide dummy implementations so UI doesn't completely break
    window.toggleMicrophone = () => this.showTopError('Microphone Manager Not Available', 
      'Could not load microphone services. Check console for details.');
    window.pauseMicrophone = () => this.showTopError('Service Unavailable', 'Microphone manager not loaded');
    window.resumeMicrophone = () => this.showTopError('Service Unavailable', 'Microphone manager not loaded');
    window.stopMicrophone = () => this.showTopError('Service Unavailable', 'Microphone manager not loaded');
    window.runTest = () => this.showTopError('Service Unavailable', 'Microphone manager not loaded');
    window.runAllTests = () => this.showTopError('Service Unavailable', 'Microphone manager not loaded');
  }

  detectBrowser() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    
    const browserEl = document.getElementById('browser');
    if (browserEl) browserEl.textContent = browser;
  }

  setupEventListeners() {
    // Main microphone button
    const mainMicBtn = document.getElementById('main-mic-btn');
    if (mainMicBtn) {
      mainMicBtn.addEventListener('click', () => this.toggleMicrophone());
    }

    // Control buttons
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseMicrophone());

    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeMicrophone());

    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopMicrophone());

    // Test buttons
    const testButtons = document.querySelectorAll('.test-button[data-test]');
    testButtons.forEach(btn => {
      const testNum = btn.getAttribute('data-test');
      btn.addEventListener('click', (event) => this.runTest(parseInt(testNum), event));
    });

    // Run all tests button
    const runAllBtn = document.getElementById('run-all-btn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.runAllTests());
    }
  }

  showTopError(title, error) {
    console.error(title, error);
    const mainStatus = document.getElementById('main-status');
    const mainSub = document.getElementById('main-substatus');
    if (mainStatus) mainStatus.textContent = title;
    if (mainSub) mainSub.textContent = error?.message || String(error);
  }

  async toggleMicrophone() {
    // Check if MicrophoneManager is available
    if (!this.MicrophoneManager) {
      this.showTopError('Service Not Loaded', 'MicrophoneManager is not available. Check console for import errors.');
      return;
    }

    const btn = document.getElementById('main-mic-btn');
    const statusText = document.getElementById('main-status');
    const substatusText = document.getElementById('main-substatus');
    const controlButtons = document.getElementById('control-buttons');

    if (!this.isMainMicActive) {
      statusText.textContent = 'Initializing...';
      substatusText.textContent = 'Requesting permission';
      
      try {
        if (!this.micManager) {
          this.micManager = new this.MicrophoneManager();
          if (this.micManager.onStatusChange) {
            this.micManager.onStatusChange((status) => {
              console.log('Status:', status);
            });
          }
        }

        const success = await this.micManager.initialize();
        
        if (success) {
          this.isMainMicActive = true;
          btn.classList.add('active');
          statusText.textContent = 'Listening';
          substatusText.textContent = 'Microphone is active';
          controlButtons.classList.add('show');
          document.getElementById('pause-btn').style.display = 'inline-block';
          document.getElementById('resume-btn').style.display = 'none';
          this.startVisualization();
          this.startStatusMonitor();
        } else {
          statusText.textContent = 'Error';
          substatusText.textContent = 'Could not access microphone';
        }
      } catch (error) {
        statusText.textContent = 'Error';
        substatusText.textContent = error.message;
      }
    } else {
      this.stopMicrophone();
    }
  }

  pauseMicrophone() {
    if (!this.micManager || !this.isMainMicActive) return;
    
    const btn = document.getElementById('main-mic-btn');
    const statusText = document.getElementById('main-status');
    const substatusText = document.getElementById('main-substatus');
    
    this.micManager.pause();
    btn.classList.remove('active');
    btn.classList.add('paused');
    statusText.textContent = 'Paused';
    substatusText.textContent = 'Microphone is muted';
    
    document.getElementById('pause-btn').style.display = 'none';
    document.getElementById('resume-btn').style.display = 'inline-block';
    
    this.stopVisualization();
  }

  resumeMicrophone() {
    if (!this.micManager) return;
    
    const btn = document.getElementById('main-mic-btn');
    const statusText = document.getElementById('main-status');
    const substatusText = document.getElementById('main-substatus');
    
    this.micManager.resume();
    btn.classList.add('active');
    btn.classList.remove('paused');
    statusText.textContent = 'Listening';
    substatusText.textContent = 'Microphone is active';
    
    document.getElementById('pause-btn').style.display = 'inline-block';
    document.getElementById('resume-btn').style.display = 'none';
    
    this.startVisualization();
  }

  stopMicrophone() {
    if (!this.micManager) return;
    
    const btn = document.getElementById('main-mic-btn');
    const statusText = document.getElementById('main-status');
    const substatusText = document.getElementById('main-substatus');
    const controlButtons = document.getElementById('control-buttons');
    
    this.micManager.stop();
    this.isMainMicActive = false;
    btn.classList.remove('active', 'paused');
    statusText.textContent = 'Stopped';
    substatusText.textContent = 'Click the microphone to restart';
    controlButtons.classList.remove('show');
    
    this.stopVisualization();
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  startVisualization() {
    const bars = document.querySelectorAll('.volume-bar');
    
    this.volumeInterval = setInterval(() => {
      if (!this.micManager) return;
      
      const volume = this.micManager.getVolumeLevel();
      const numActiveBars = Math.floor((volume / 100) * bars.length);
      
      bars.forEach((bar, index) => {
        if (index < numActiveBars) {
          bar.classList.add('active');
          const height = 10 + (Math.random() * 40);
          bar.style.height = `${height}px`;
        } else {
          bar.classList.remove('active');
          bar.style.height = '10px';
        }
      });
    }, 100);
  }

  stopVisualization() {
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      const bars = document.querySelectorAll('.volume-bar');
      bars.forEach(bar => {
        bar.classList.remove('active');
        bar.style.height = '10px';
      });
    }
  }

  startStatusMonitor() {
    this.statusInterval = setInterval(() => {
      if (!this.micManager) return;
      
      const info = this.micManager.getInfo();
      document.getElementById('active').textContent = info.isActive ? 'Yes' : 'No';
      document.getElementById('permission').textContent = info.hasPermission ? 'Yes' : 'No';
      document.getElementById('volume').textContent = info.volumeLevel + '%';
    }, 500);
  }

  async runTest(testNum, event) {
    // Check if MicrophoneManager is available
    if (!this.MicrophoneManager) {
      this.showTopError('Service Not Loaded', 'Cannot run tests - MicrophoneManager not available');
      return;
    }

    const dot = document.getElementById(`dot-${testNum}`);
    const result = document.getElementById(`result-${testNum}`);
    const button = event?.target;
    
    // Disable button and show loading
    if (button) {
      button.disabled = true;
      button.classList.add('running');
    }
    
    dot.className = 'status-dot running';
    if (result) result.classList.remove('show');
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      switch(testNum) {
        case 1: await this.test1(); break;
        case 2: await this.test2(); break;
        case 3: await this.test3(); break;
        case 4: await this.test4(); break;
        case 5: await this.test5(); break;
        case 6: await this.test6(); break;
      }
    } catch (error) {
      this.showResult(testNum, 'fail', `Error: ${error.message}`);
    } finally {
      // Re-enable button and remove loading
      if (button) {
        button.disabled = false;
        button.classList.remove('running');
      }
    }
  }

  async runAllTests() {
    if (!this.MicrophoneManager) {
      this.showTopError('Service Not Loaded', 'Cannot run tests - MicrophoneManager not available');
      return;
    }

    const runAllBtn = document.getElementById('run-all-btn');
    runAllBtn.disabled = true;
    runAllBtn.textContent = '⏳ Running...';
    
    for (let i = 1; i <= 6; i++) {
      await this.runTest(i);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    runAllBtn.disabled = false;
    runAllBtn.textContent = '✓ All Tests Complete';
    
    setTimeout(() => {
      runAllBtn.textContent = '▶ Run All Tests';
    }, 2000);
  }

  async test1() {
    if (!this.micManager) {
      this.micManager = new this.MicrophoneManager();
    }
    const success = await this.micManager.initialize();
    this.showResult(1, success ? 'pass' : 'fail', 
      success ? '✓ Microphone initialized' : '✗ Failed to initialize');
  }

  async test2() {
    const status = this.micManager ? 
      await this.micManager.getPermissionStatus() : 
      await new this.MicrophoneManager().getPermissionStatus();
    this.showResult(2, 'pass', `Status: ${status}`);
  }

  async test3() {
    if (!this.micManager || !this.micManager.hasPermission) {
      this.showResult(3, 'fail', 'Run Test 1 first');
      return;
    }
    
    let maxVolume = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const vol = this.micManager.getVolumeLevel();
      if (vol > maxVolume) maxVolume = vol;
    }
    
    this.showResult(3, maxVolume > 5 ? 'pass' : 'fail',
      `Max volume: ${maxVolume}%${maxVolume > 5 ? ' ✓' : ' (try speaking)'}`);
  }

  async test4() {
    const testMic = new this.MicrophoneManager();
    let errorHandled = false;
    
    if (testMic.onError) {
      testMic.onError((err) => {
        errorHandled = true;
        this.showResult(4, 'pass', '✓ Error handled gracefully');
      });
    }
    
    try {
      await testMic.initialize();
      if (!errorHandled) {
        this.showResult(4, 'pass', '✓ Permission granted');
      }
    } catch (error) {
      if (!errorHandled) {
        this.showResult(4, 'fail', 'Error not handled');
      }
    }
    
    if (testMic.destroy) testMic.destroy();
  }

  async test5() {
    if (!this.micManager || !this.micManager.hasPermission) {
      this.showResult(5, 'fail', 'Run Test 1 first');
      return;
    }
    
    const wasActive = this.micManager.isActive;
    
    // Test pause
    this.micManager.pause();
    await new Promise(resolve => setTimeout(resolve, 300));
    const isPaused = !this.micManager.isActive;
    
    // Test resume
    this.micManager.resume();
    await new Promise(resolve => setTimeout(resolve, 300));
    const isResumed = this.micManager.isActive;
    
    const success = isPaused && isResumed;
    this.showResult(5, success ? 'pass' : 'fail', 
      success ? '✓ Pause/resume works correctly' : '✗ Pause/resume failed');
    
    // Restore original state
    if (!wasActive) this.micManager.pause();
  }

  async test6() {
    const testMic = new this.MicrophoneManager();
    const results = await testMic.testMicrophone();
    
    const allGood = results.supported && results.permission && 
                    results.active && results.errors.length === 0;
    
    this.showResult(6, allGood ? 'pass' : 'fail',
      allGood ? '✓ All systems operational' : 
      `Issues: ${results.errors.join(', ')}`);
    
    if (testMic.destroy) testMic.destroy();
  }

  showResult(testNum, status, message) {
    const dot = document.getElementById(`dot-${testNum}`);
    const result = document.getElementById(`result-${testNum}`);
    
    if (dot) dot.className = `status-dot ${status}`;
    if (result) {
      result.className = `result ${status === 'pass' ? 'success' : 'error'} show`;
      result.textContent = message;
    }
  }

  cleanup() {
    if (this.volumeInterval) clearInterval(this.volumeInterval);
    if (this.statusInterval) clearInterval(this.statusInterval);
    if (this.micManager && this.micManager.destroy) {
      this.micManager.destroy();
    }
  }
}

// Initialize the app when DOM is ready
let app;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new MicrophoneTestApp();
  });
} else {
  app = new MicrophoneTestApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (app) app.cleanup();
});

// Export for global access if needed
window.microphoneTestApp = app;