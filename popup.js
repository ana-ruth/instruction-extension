
document.addEventListener('DOMContentLoaded', () => {
    
    // Get references to the key UI elements
    const sendButton = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');

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