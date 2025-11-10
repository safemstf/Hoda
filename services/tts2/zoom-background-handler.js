/**
 * Zoom Background Service Worker Handler
 * Integrates with Chrome's background service worker
 * Handles zoom API calls and storage
 * 
 * Add to background.js:
 * ```
 * // Zoom handlers
 * chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 *   if (message.type === 'SET_PAGE_ZOOM') {
 *     handleSetZoom(message, sender, sendResponse);
 *     return true;
 *   }
 *   if (message.type === 'GET_PAGE_ZOOM') {
 *     handleGetZoom(message, sender, sendResponse);
 *     return true;
 *   }
 * });
 * ```
 */

/**
 * Handle SET_PAGE_ZOOM message
 * @param {Object} message - Message with zoom level
 * @param {Object} sender - Sender (tab info)
 * @param {Function} sendResponse - Response callback
 */
async function handleSetZoom(message, sender, sendResponse) {
  try {
    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    const zoom = Math.max(0.5, Math.min(3.0, message.zoom || 1.0));
    
    // Set zoom for the tab
    await chrome.tabs.setZoom(sender.tab.id, zoom);
    
    // Save to storage
    await chrome.storage.local.set({
      [`zoom_${sender.tab.id}`]: {
        zoom: zoom,
        timestamp: Date.now(),
        url: sender.tab.url
      }
    });

    console.log(`[Background] Zoom set to ${(zoom * 100).toFixed(0)}% for tab ${sender.tab.id}`);
    
    sendResponse({
      success: true,
      zoom: zoom,
      message: `Zoom set to ${(zoom * 100).toFixed(0)}%`
    });

  } catch (error) {
    console.error('[Background] Error setting zoom:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle GET_PAGE_ZOOM message
 * @param {Object} message - Message (empty)
 * @param {Object} sender - Sender (tab info)
 * @param {Function} sendResponse - Response callback
 */
async function handleGetZoom(message, sender, sendResponse) {
  try {
    if (!sender.tab?.id) {
      throw new Error('No tab ID available');
    }

    const zoom = await chrome.tabs.getZoom(sender.tab.id);
    
    console.log(`[Background] Current zoom for tab ${sender.tab.id}: ${(zoom * 100).toFixed(0)}%`);
    
    sendResponse({
      success: true,
      zoom: zoom
    });

  } catch (error) {
    console.error('[Background] Error getting zoom:', error);
    sendResponse({
      success: false,
      zoom: 1.0,
      error: error.message
    });
  }
}

/**
 * Reset zoom for a tab
 * @param {number} tabId - Tab ID
 */
async function resetTabZoom(tabId) {
  try {
    await chrome.tabs.setZoom(tabId, 1.0);
    await chrome.storage.local.remove([`zoom_${tabId}`]);
    console.log(`[Background] Zoom reset for tab ${tabId}`);
  } catch (error) {
    console.error('[Background] Error resetting tab zoom:', error);
  }
}

/**
 * Get zoom history
 */
async function getZoomHistory() {
  try {
    const storage = await chrome.storage.local.get();
    const zoomEntries = Object.entries(storage)
      .filter(([key]) => key.startsWith('zoom_'))
      .map(([key, value]) => ({
        tabId: key.replace('zoom_', ''),
        ...value
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return zoomEntries;
  } catch (error) {
    console.error('[Background] Error getting zoom history:', error);
    return [];
  }
}

/**
 * Clear all zoom settings
 */
async function clearAllZoomSettings() {
  try {
    const storage = await chrome.storage.local.get();
    const zoomKeys = Object.keys(storage).filter(key => key.startsWith('zoom_'));
    await chrome.storage.local.remove(zoomKeys);
    console.log(`[Background] Cleared ${zoomKeys.length} zoom settings`);
  } catch (error) {
    console.error('[Background] Error clearing zoom settings:', error);
  }
}

/**
 * Handle tab close - cleanup zoom settings
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([`zoom_${tabId}`]);
});

module.exports = {
  handleSetZoom,
  handleGetZoom,
  resetTabZoom,
  getZoomHistory,
  clearAllZoomSettings
};
