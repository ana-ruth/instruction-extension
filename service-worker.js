chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHAT_REQUEST') {
    // *** Mock LLM Response Structure ***
    const mockResponse = {
      instruction: "Mock: Click the main search box.",
      selector: "#search-box"
    };
    sendResponse(mockResponse); // Send back to P1 (popup.js)
  }
  return true; // Keep the message channel open for sendResponse
});
