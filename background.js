chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "processText") {
    console.log("Processing text:", request.text);
    const intent = await window.getIntent(request.text);
    sendResponse({ intent });
  }
  return true;
});
