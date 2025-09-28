document.addEventListener('DOMContentLoaded', () => {
    
    // Get references to the key UI elements
    const sendButton = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatHistory = document.getElementById('chat-history'); 

    // Next Step elements
    const nextStepContainer = document.getElementById('next-step-container'); 
    const nextStepBtn = document.getElementById('next-step-btn'); 

    // Add initial system message (Accessibility)
    appendMessage("system", "Hello! Ask me how to perform an action on this page.");

    // Attach listeners
    sendButton.addEventListener('click', handleSend);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    });

    nextStepBtn.addEventListener('click', handleAdvanceStep);


    // --- ADVANCE STEP HANDLER ---

    function handleAdvanceStep() {
        // Disable button immediately to prevent double-clicks
        nextStepBtn.disabled = true; 
        
        const advanceLoadingMessage = appendMessage("system", "Guide preparing next step...", true);
        
        // Send the advance request to the Service Worker
        chrome.runtime.sendMessage({
            type: 'ADVANCE_STEP'
        }, (response) => {
            // Remove loading indicator immediately upon receiving any response
            advanceLoadingMessage.remove(); 
            
            if (chrome.runtime.lastError) {
                console.error("Popup Error:", chrome.runtime.lastError.message);
                appendMessage("error", "Error: Connection lost during step advance.");
                sendButton.disabled = false;
                return;
            }

            processResponse(response);
        });
    }


    /**
     * Handles the user sending a message (CHAT_REQUEST).
     */
    function handleSend() {
        const question = userInput.value.trim();

        if (question === "") {
            console.log("Input is empty. Skipping message send.");
            return;
        }

        // 1. Display and clear user's question
        appendMessage("user", question);
        userInput.value = '';

        sendButton.disabled = true; 
        nextStepBtn.disabled = true; 

        // 2. Display a loading message while waiting for the LLM
        const initialLoadingMessage = appendMessage("system", "Guide is thinking...", true);

        // 3. Send message to the Service Worker (P3)
        chrome.runtime.sendMessage({
            type: 'CHAT_REQUEST',
            question: question
        },(response) => {
            
            // Remove the specific loading indicator that was created
            initialLoadingMessage.remove(); 
            
            if (chrome.runtime.lastError) {
                console.error("Popup Error:", chrome.runtime.lastError.message);
                appendMessage("error", "Error: Lost connection to the guide service. Please reload the extension.");
                sendButton.disabled = false;
                return;
            }

            // Call the shared function to display the result and control the flow
            processResponse(response);
        });
    }


    /**
     * CRITICAL: Processes the response from the Service Worker for BOTH CHAT_REQUEST and ADVANCE_STEP.
     */
    function processResponse(response) {
        
        if (response.status === "success") {
            // New instruction received (Step 1 or Step N)
            appendMessage("system", response.instruction);
            
            // Enable next step controls
            nextStepBtn.innerText = response.isLastStep ? "Finish Guide" : "Done with this step? Next →";
            nextStepBtn.disabled = false;
            nextStepContainer.style.display = 'block';
            sendButton.disabled = true; // Keep chat disabled during flow

            // Log the selector for debug (P4)
            console.log("Popup received target selector:", response.selector);

        } else if (response.status === "complete") {
            // Plan finished or no plan found (End of conversation)
            appendMessage("system", response.instruction);
            
            // Reset UI for a new conversation
            nextStepContainer.style.display = 'none';
            sendButton.disabled = false; // Allow new chat requests

        } else {
            // LLM/API Error (status is 'error' or unrecognized)
            const errorText = response.instruction || "An unknown error occurred. Try again.";
            appendMessage("error", errorText);

            // Reset UI for a new conversation
            sendButton.disabled = false; 
            nextStepContainer.style.display = 'none';
        }
    }


    /**
     * Appends a message to the chat history container (Utility function).
     */
    function appendMessage(role, text, isLoading = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${role}-message`);
        
        // Use innerText for security and clean display
        messageElement.innerText = text;

        if (isLoading) {
            // Use a unique ID for easy removal
            messageElement.id = 'loading-indicator'; 
        }

        chatHistory.appendChild(messageElement);
        
        // Always scroll to the bottom to show the newest message
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        return messageElement;
    }
});