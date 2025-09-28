
import { GEMINI_API_KEY } from './config.js';

async function callGeminiApi(question, context) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_PLACEHOLDER_KEY') {
        // Handle the case where the key is missing (e.g., in a development environment)
        console.error("API Key is not configured correctly in config.js.");

        return { error: "Developer API Key is not configured." };
    }



    const systemPrompt = `You are a patient, helpful guide specializing in instructing seniors on website navigation.
    Your response MUST achieve two goals:
    1. Provide the SINGLE, most logical next step to help the user achieve their goal.
    2. Identify the exact CSS selector for the element mentioned in your instruction, using the provided DOM Context.

    INSTRUCTION GUIDELINES:
    * Use extremely simple, direct language. Avoid technical terms.
    * Focus only on the single, immediate next action.
    
    RESPONSE FORMATTING:
    * You MUST respond ONLY with a valid JSON object adhering to the specified schema.
    * If no relevant element is found in the DOM Context, use 'document.body' for the selector and state, 'The item is not visible right now. Please scroll down.'

    DOM Context:
    ---
    ${context}
    ---
    
    User Question: ${question}`;


       // CONSTRUCT THE API PAYLOAD
    const payload = {
        model: "gemini-2.5-flash", 
        contents: [{ 
                    role: "user", 
                    parts: [{ 
                        text: systemPrompt 
                    }] 
                }],
        generationConfig: {
            // CRUCIAL: Forces the model to output a JSON string
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    instruction: { type: "string", description: "The single, simple instruction for the user." },
                    selector: { type: "string", description: "The most precise CSS selector for the target element." }
                },
                required: ["instruction", "selector"]
            }
        }
    };




    //fetch call to Gemini API

try { 
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)

        }
    );
    

    if (!response.ok) {
        const errorDetails = await response.text();
        console.error("Gemini API Error:", response.status, errorDetails);
        return { error: `API Error: ${response.status}` };
    }

    const data = await response.json();
    console.log("Raw Gemini API Response:", data);

    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        //const parsedData = JSON.parse(jsonText); 
        
        if (!jsonText) {
        console.error("Gemini Response Missing Text/Content. Full response:", data);
        return { 
            error: "The guide couldn't generate a response for this request. Please try rephrasing." 
        };
    }


    try {
        const parsedData = JSON.parse(jsonText); 
        console.log("Parsed Gemini JSON:", parsedData);

        return {
            instruction: parsedData.instruction,
            selector: parsedData.selector
        };
    } catch (e) {
        console.error("Failed to parse JSON from Gemini text:", jsonText, e);
        return { error: "Failed to read guide instructions. Please ask again." };
    }


        
    } catch (error) {
        console.error("LLM API Call Failed:", error);
        return { error: "Error contacting the guide service. Please try again." };
    }

}



const contextCache = {}; 

/////////////////

const getContext = (tabId, tabUrl) => {
    // 1. Check cache first
    if (contextCache[tabId]) {
        console.log("Context found in cache.");
        return Promise.resolve(contextCache[tabId]);
    }
    
    // 2. If not in cache, request it from content.js
    console.log("Context missing. Injecting script to get context.");
    
    return new Promise((resolve, reject) => {
        
        // Inject content.js (if not already injected)
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Context script injection failed:", chrome.runtime.lastError.message);
                return reject("Failed to load guide features.");
            }
            
            // Send the context request to content.js
            chrome.tabs.sendMessage(tabId, { type: 'GET_CONTEXT' }, (response) => {
                if (chrome.runtime.lastError) {
                    // This handles errors like "receiving end does not exist" if it still occurs
                    console.error("Failed to receive context response:", chrome.runtime.lastError);
                    reject("Failed to communicate with the page.");
                } else if (!response || response.type !== 'CONTEXT_RESPONSE') {
                    // This handles if content.js sends an unexpected or empty response
                     resolve({
                        pageTitle: 'Fallback Context',
                        pageURL: tabUrl,
                        interactiveElements: [],
                        elementCount: 0
                    }); 
                } else {
                    // SUCCESS: Context is received
                    contextCache[tabId] = response.context; // Cache for next time
                    resolve(response.context);
                }
            });
        });
    });
};







////////////////

// Listener receives messages from popup.js and content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    // --- 1. HANDLE CONTEXT RECEIPT FROM CONTENT.JS ---
    if (message.type === 'CONTEXT_DATA') {
        const tabId = sender.tab.id;
        contextCache[tabId] = message.context;
        console.log(`Context received and cached for tab ${tabId}.`);
        sendResponse({ status: "Context cached." });
        return true; // Keep channel open
    }
    
    // --- 2. HANDLE CHAT REQUEST FROM POPUP.JS (The main trigger) ---
    if (message.type === 'CHAT_REQUEST') {
        const userQuestion = message.question;
        
        // Find the active tab to execute commands and get context
        chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
            
            const tab = tabs[0];
            const tabId = tab.id;
            
            if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                 sendResponse({ status: "error", instruction: "Extension cannot run on this page." });
                 return;
            }






try {
                // A. Await context data (handles caching, injection, and messaging)
                let pageContextData = await getContext(tabId, tab.url);
                
                // Convert object context to a clean JSON string for the LLM prompt
                const contextString = JSON.stringify(pageContextData);

                // B. Call the LLM with the *real* context string
                const llmResponse = await callGeminiApi(userQuestion, contextString);

                // C. Handle LLM errors
                if (llmResponse.error) {
                    sendResponse({ status: "error", instruction: llmResponse.error });
                    return;
                }

                // D. Send instruction back to Popup (P1)
                sendResponse({ 
                    status: "success", 
                    instruction: llmResponse.instruction,
                    selector: llmResponse.selector // For debug/logging in popup
                }); 
                
                // E. INJECT AND SEND INSTRUCTION (Final fix for connection errors)
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js'] 
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Script injection failed:", chrome.runtime.lastError.message);
                        return;
                    }
                    
                    // Send the command *after* injection is successful
                    chrome.tabs.sendMessage(tabId, { 
                        type: 'LLM_INSTRUCTION', 
                        selector: llmResponse.selector,
                        instruction: llmResponse.instruction 
                    }).catch(error => {
                        console.error("Error sending highlight command (Post-Injection):", error.message);
                    });
                });

            } catch (e) {
                // Handle critical failure during context retrieval
                console.error("Critical error in chat flow:", e);
                sendResponse({ status: "error", instruction: `A critical error occurred while preparing the guide: ${e}` });
            }
        }); 

        return true; // Keep channel open for the async sendResponse
    }
});

            // A. Check if context is already available
            // let pageContext = contextCache[tabId];
            // if (!pageContext) {
            //      // If not, inject content.js and request context *before* calling the LLM
            //      // NOTE: For simplicity, we are combining the context gathering and chat in one call here.
            //      // A more robust app would have the content script send context on load.
            //      // For now, we'll try to execute and get context first.
                 
            //      // Fallback or Initial Context Request: Inject content.js to get the data
            //      // The actual scraping must be done by P2 and returned via a dedicated message.
            //      pageContext = `Page URL: ${tab.url}. Current elements: (No context received yet. Using URL only.)`;
            // }

            // // B. Call the LLM with the question and context
            // const llmResponse = await callGeminiApi(userQuestion, pageContext);

            // REVISED FLOW




//             if (llmResponse.error) {
//                 sendResponse({ status: "error", instruction: llmResponse.error });
//                 return;
//             }

//             // C. Send instruction back to Popup (P1)
//             sendResponse({ 
//                 status: "success", 
//                 instruction: llmResponse.instruction,
//                 selector: llmResponse.selector // Send selector to popup for logging/debug
//             }); 
            
// /////////



// // Inject content.js and then send the message inside the callback
// chrome.scripting.executeScript({
//     target: { tabId: tabId },
//     files: ['content.js'] // Path to your content script
// }, () => {
//     // Check for injection errors
//     if (chrome.runtime.lastError) {
//         console.error("Script injection failed:", chrome.runtime.lastError.message);
//         // You should send an error back to the popup here too!
//         // sendResponse({ status: "error", instruction: "Failed to load guide features on the page." });
//         return;
//     }
    
//     //  THIS IS THE FINAL SEND THAT MUST BE RUN AFTER SCRIPT IS LOADED
//     chrome.tabs.sendMessage(tabId, { 
//         type: 'LLM_INSTRUCTION', 
//         selector: llmResponse.selector,
//         instruction: llmResponse.instruction // Include instruction for robust P2 logging
//     }).catch(error => {
//         // This catch handles errors if the connection immediately closes after sending
//         console.error("Error sending highlight command (Post-Injection):", error.message);
//     });

// }); // End of chrome.scripting.executeScript()

// });


//         return true; 
//     }
// });







/*

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
*/
