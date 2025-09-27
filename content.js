// content.js
// P2's focus: DOM Scraper & Highlighting Logic

//Phase 1
// 1. Set up the message listener to receive commands from the service worker (P3)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    // Listen ONLY for the LLM_INSTRUCTION command
    if (message.type === 'LLM_INSTRUCTION' && message.selector) {
        
        console.log("P2: Received LLM_INSTRUCTION:", message.instruction);
        console.log("P2: Target Selector:", message.selector);
        
        // Execute the highlight action immediately
        highlightElement(message.selector);
    }


    if (message.type === 'GET_CONTEXT') {
        sendResponse(scrapeContext());
        return true;
    }


});




function scrapeContext() {
    console.log("P2: Executing scrapeContext() to gather basic page information.");
    
    return {
        // Retrieves the text content of the HTML <title> tag
        title: document.title, 
        
        // Retrieves the full URL of the current window/tab
        url: window.location.href,
        
        // Optionally add a timestamp for diagnostic purposes
        timestamp: Date.now() 
    };
}









/**
 * PHASE 2: Highlighting Logic (Tasks 10-12h)
 * Applies a persistent, high-visibility style to the element.
 * @param {string} selector - The CSS selector for the element to highlight.
 */
function highlightElement(selector) {
    // 1. Clear any previously highlighted elements
    document.querySelectorAll('.elder-guide-highlight').forEach(el => {
        el.classList.remove('elder-guide-highlight');
        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.zIndex = '';
    });

    const targetElement = document.querySelector(selector);

    if (targetElement) {
        // 2. Apply high-visibility styles
        targetElement.classList.add('elder-guide-highlight');
        targetElement.style.boxShadow = '0 0 0 5px #FF5733'; // Bright orange/red shadow
        targetElement.style.outline = '3px solid #C70039'; // Solid outline
        targetElement.style.zIndex = '999999'; // Ensure visibility over page content

        // 3. Scroll the highlighted element into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        console.log(`Elder-Guide: Successfully highlighted element: ${selector}`);
    } else {
        console.error(`Elder-Guide: Could not find element with selector: ${selector}`);
    }
}
