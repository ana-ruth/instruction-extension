
function handleChatRequest(question, context) {
    return {
        "instruction": "Mock: Click the main search box.",
        "selector": "#search-box",
        "llmText": `Guide: I see you are on the page titled: "${context.title}". I suggest you click the main search box.`

    };
}

// receives messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 
    // receives chat request from popup.js
    if (message.type === 'CHAT_REQUEST') {
    const userQuestion = message.question;
    console.log("Service Worker received query from Popup:", userQuestion);



    //get active tab in browser
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length === 0) {
                // Handle case where no active tab is found (e.g., user is on chrome://extensions)
                sendResponse({ status: "error", message: "No active tab to guide." });
                return;
            }
            const tab = tabs[0]
            const tabId = tab.id;


    // Check if the URL is restricted before attempting injection
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.error("Cannot run script on restricted URL:", tab.url);
        sendResponse({ 
            status: "error", 
            message: "Extension cannot run on this Chrome internal page." 
        });
        return; // Stop processing immediately
    }



    // *** Mock LLM Response Structure ***
    const mockResponse = {
      instruction: "Mock: Click the main search box.",
      selector: "#search-box",
      llmText: `Guide: I received your question about "${userQuestion}". I suggest you click the main search box.`

    };

    //send response to popup.js
    console.log("Service Worker sending mock response to Popup:", mockResponse);
    sendResponse(mockResponse); // Send back to (popup.js)
  

    //Inject content.js before sending the command
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js'] // Path to your content script
    }, () => {
        // Check for potential injection errors
        if (chrome.runtime.lastError) {
            console.error("Script injection failed:", chrome.runtime.lastError.message);
            return;
        }
        
        console.log("content.js injected successfully. Sending command now.");

        

        // Send message to content.js to highlight the element
        chrome.tabs.sendMessage(tabId, { 
            type: 'GET_CONTEXT', 
            instruction: mockResponse.instruction, 
            selector: mockResponse.selector 
        });

    }); // End of chrome.scripting.executeScript

 });

    //return true; // Keep the message channel open for sendResponse
    }
});

