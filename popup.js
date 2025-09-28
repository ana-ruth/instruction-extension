/*
document.addEventListener('DOMContentLoaded', () => {
    
    // Get references to the key UI elements
    const sendButton = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatHistory = document.getElementById('chat-history'); 

    // Attach the event listener to the Send button
    sendButton.addEventListener('click', () => {
        
        // Get the value (the user's question) from the input field
        const question = userInput.value.trim();

        if (question === "") {
            // Prevent sending empty messages
            console.log("Input is empty. Skipping message send.");
            return;
        }

        console.log(`P1 sending message to P3: ${question}`);

        // 3. Send the message to the Service Worker (P3)
        chrome.runtime.sendMessage({
            type: 'CHAT_REQUEST',
            question: question
        }, 
        // 4. Callback function to handle the response from P3
        (response) => {
            // P1 verifies the communication works by logging the mock response
            console.log("✅ Mock Response received from P3 (Service Worker):", response);
            
            // In Phase 2, P1 will update the #chat-history div here
            // Example: displayMessage(response.llmText);
        });
        
        // Clear the input field after sending
        userInput.value = '';
    });
});
*/

// popup.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Get references to the key UI elements
    const sendButton = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const chatHistory = document.getElementById('chat-history'); 

    // Add initial system message (Accessibility)
    appendMessage("system", "Hello! Ask me how to perform an action on this page.");

    // Attach listeners
    sendButton.addEventListener('click', handleSend);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    });

    /**
     * Handles the user sending a message.
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

        // 2. Display a loading message while waiting for the LLM
        const loadingMessage = appendMessage("system", "Guide is thinking...", true);

        // 3. Send message to the Service Worker (P3)
        chrome.runtime.sendMessage({
            type: 'CHAT_REQUEST',
            question: question
        }, 
        // 4. Callback function to handle the response from P3
        (response) => {
            // Remove the loading indicator immediately
            loadingMessage.remove(); 
            
            if (chrome.runtime.lastError) {
                console.error("Popup Error:", chrome.runtime.lastError.message);
                appendMessage("error", "Error: Lost connection to the guide service. Please reload the extension.");
                return;
            }

            // 5. Process and display LLM's response
            if (response && response.status === "success") {
                // P3 sends back instruction and selector
                const instructionText = response.instruction;
                
                // Final display of the LLM's instruction
                appendMessage("system", instructionText);

                // Log the selector for debug (P4)
                console.log("Popup received target selector:", response.selector);

            } else {
                // Display error from the Service Worker/LLM
                const errorText = response.instruction || "Could not complete the request. Try asking a simple question.";
                appendMessage("error", errorText);
                console.error("LLM Request Failed:", response);
            }
        });
    }

    /**
     * Appends a message to the chat history container. (P1's core display utility)
     */
    function appendMessage(role, text, isLoading = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${role}-message`);
        
        // Ensure text is clearly readable and handles line breaks
        messageElement.innerText = text;

        if (isLoading) {
            messageElement.id = 'loading-indicator';
        }

        chatHistory.appendChild(messageElement);
        
        // Always scroll to the bottom to show the newest message
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        return messageElement;
    }
});