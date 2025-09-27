
function handleChatRequest(question, context) {
    return {
        "instruction": "Mock: Click the main search box.",
        "selector": "#search-box"
    };
}

// receives messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 
    if (message.type === 'CHAT_REQUEST') {

   // const tabId = sender.tab.id;
    const userQuestion = message.question;

    console.log("Service Worker received query from Popup:", userQuestion);

    //request content from content script (P2)
    // chrome.tabs.sendMessage(tabId, { type: 'GET_CONTEXT' }, (response) => {
    //   if (chrome.runtime.lastError) {
    //     console.error("Error sending message to content script:", chrome.runtime.lastError);
    //     sendResponse({ error: "Failed to get context from page." });
    //     return;
    //   }

    //   const pageContext = response ? response.context : "";
   //   console.log("Service Worker received context from Content Script:", pageContext);


    // *** Mock LLM Response Structure ***
    const mockResponse = {
      instruction: "Mock: Click the main search box.",
      selector: "#search-box",
    };


    console.log("Service Worker sending mock response to Popup:", mockResponse);
    sendResponse(mockResponse); // Send back to P1 (popup.js)
  
   // }); // end sendMessage to content script
    return true; // Keep the message channel open for sendResponse
    }
});

