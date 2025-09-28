
import { GEMINI_API_KEY } from './config.js';


chrome.runtime.onInstalled.addListener(() => {
    // This tells Chrome to open the side panel when the action (icon click) occurs.
    chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true
    }).catch((error) => console.error("Error setting sidePanel behavior:", error));
});


async function callGeminiApi(question, context) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_PLACEHOLDER_KEY') {
        // Handle the case where the key is missing (e.g., in a development environment)
        console.error("API Key is not configured correctly in config.js.");

        return { error: "Developer API Key is not configured." };
    }



    const systemPrompt = `You are a patient, expert, and helpful guide specializing in instructing seniors on website navigation.
    Your single task is to generate a comprehensive, ordered list of ALL necessary steps to achieve the user's ultimate goal.
    RESPONSE GUIDELINES:
    * The final response MUST be a single JSON object containing the "fullPlan" array.
    * Instructions must be **extremely simple and direct** (e.g., "Type your email here", "Click the 'Next' button").
    * Each step MUST correspond to an element found in the DOM Context.
    * If the first necessary element is not found in the DOM Context, the FIRST step's selector MUST be 'document.body' and the instruction must be a prompt to scroll or wait.


    DOM Context (Interactive Elements Available on Page):
    ---
    ${context}
    ---
    
    User Goal: ${question}
    Generate the full step-by-step plan now, ensuring the output adheres strictly to the defined schema.`;


       // API PAYLOAD
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
            
            // CHANGE STARTS HERE: Define the expected array structure
            responseSchema: {
                type: "object",
                properties: {
                    fullPlan: {
                        type: "array",
                        description: "A list of ordered steps to complete the user's goal.",
                        items: { // Define the schema for EACH item in the array
                            type: "object",
                            properties: {
                                // These properties match the structure of a single step
                                instruction: { 
                                    type: "string", 
                                    description: "The simplified, single-action instruction." 
                                },
                                selector: { 
                                    type: "string", 
                                    description: "The CSS selector for the element." 
                                }
                            },
                            required: ["instruction", "selector"]
                        }
                    }
                },
                required: ["fullPlan"] // Only the fullPlan property is required in the root object
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
            fullPlan: parsedData.fullPlan 
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
                if (chrome.runtime.lastError ) {
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


////////

const CONVERSATION_KEY = 'guideConversation'; // Key for chrome.storage

// Utility function to inject and send the command to P2
function executeStep(tabId, step) {
    // This function ensures the script is loaded on the current tab (new or old page)
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Script injection failed:", chrome.runtime.lastError.message);
            return;
        }
        chrome.tabs.sendMessage(tabId, { 
            type: 'LLM_INSTRUCTION', 
            selector: step.selector,
            instruction: step.instruction
        }).catch(error => {
            console.error("Error sending highlight command:", error.message);
        });
    });
}





////////////////

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    // 1. HANDLE CONTEXT RECEIPT FROM CONTENT.JS (No major change needed here)
    if (message.type === 'CONTEXT_DATA') {
        const tabId = sender.tab.id;
        contextCache[tabId] = message.context;
        sendResponse({ status: "Context cached." });
        return true; 
    }
    
    // 2. HANDLE CHAT REQUEST / ADVANCE STEP (Primary Logic)
    if (message.type === 'CHAT_REQUEST' || message.type === 'ADVANCE_STEP') {
        
        // This is a complex asynchronous path.
        // We use an immediately invoked async function to manage the promises cleanly.
        (async () => {
            try {
                // 1. Get Tab Context (Essential for both requests)
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs.length === 0) {
                    throw new Error("Please ensure you have an active webpage open.");
                }
                const tab = tabs[0];
                const tabId = tab.id;

                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                    throw new Error("Extension cannot run on this internal page.");
                }

                let responseData;
                let convData = await chrome.storage.local.get(CONVERSATION_KEY);
                let conv = convData[CONVERSATION_KEY] || {};
                
                // --- A. INITIAL REQUEST: GENERATE NEW PLAN ---
                if (message.type === 'CHAT_REQUEST') {
                    
                    const contextString = JSON.stringify(await getContext(tabId, tab.url));
                    const llmResponse = await callGeminiApi(message.question, contextString);

                    if (llmResponse.error || !llmResponse.fullPlan || llmResponse.fullPlan.length === 0) {
                        throw new Error(llmResponse.error || "Could not create a valid plan.");
                    }
                    
                    // Store new plan and start at step 0
                    conv.plan = llmResponse.fullPlan;
                    conv.currentStepIndex = 0;
                    await chrome.storage.local.set({ [CONVERSATION_KEY]: conv });

                    const currentStep = conv.plan[0];
                    const isLastStep = conv.plan.length === 1;
                    
                    responseData = {
                        status: "success", 
                        instruction: currentStep.instruction, 
                        selector: currentStep.selector,
                        isLastStep: isLastStep
                    };
                    executeStep(tabId, currentStep); // Execute step 0 immediately

                // --- B. ADVANCE STEP REQUEST: MOVE TO NEXT STEP ---
                } else if (message.type === 'ADVANCE_STEP') {

                    if (!conv.plan) {
                        throw new Error("No active guide plan found. Please start a new chat.");
                    }
                    
                    const nextStepIndex = conv.currentStepIndex + 1;
                    if (nextStepIndex >= conv.plan.length) {
                        await chrome.storage.local.remove(CONVERSATION_KEY);
                        responseData = { status: "complete", instruction: "You have completed all the steps! Guide finished." };
                    } else {
                        const nextStep = conv.plan[nextStepIndex];
                        conv.currentStepIndex = nextStepIndex;
                        await chrome.storage.local.set({ [CONVERSATION_KEY]: conv });
                        
                        const isLast = nextStepIndex === conv.plan.length - 1;
                        
                        responseData = { 
                            status: "success", 
                            instruction: nextStep.instruction, 
                            selector: nextStep.selector,
                            isLastStep: isLast
                        };
                        executeStep(tabId, nextStep); // Execute the new step
                    }
                }
                
                // 3. FINAL RESPONSE: Send the accumulated response data back to the popup (P1)
                sendResponse(responseData);

            } catch (error) {
                // Handle ALL errors that occurred during the asynchronous process
                console.error("Critical error in chat flow:", error.message);
                
                // Send a structured error response back to the popup
                sendResponse({ 
                    status: "error", 
                    instruction: `A critical error occurred: ${error.message}` 
                });
            }
        })(); // End of immediately invoked async function

        return true; // CRITICAL: Keeps the message port open for the async response
    }
    
    // Return false for any other messages
    return false;
});

