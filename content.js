// content.js
// P2's focus: DOM Scraper & Highlighting Logic




// message listener to receive commands from the service worker (P3)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Listen ONLY for the LLM_INSTRUCTION command
    if (message.type === 'LLM_INSTRUCTION' && message.selector) {

        console.log("P2: Received LLM_INSTRUCTION:", message.instruction);
        console.log("P2: Target Selector:", message.selector);

        // Execute the highlight action immediately
        highlightElement(message.selector);


    }


    if (message.type === 'GET_CONTEXT') {
        const contextData = scrapeContext();
        console.log("P2: Scraped Context Data:", contextData);

        // Send the scraped data back to the Service Worker (P3)
        sendResponse({
            type: 'CONTEXT_RESPONSE',
            context: contextData
        });

        // Must return true to signal Chrome that sendResponse will be called asynchronously.
        // Even though scrapeContext is synchronous, the messaging flow is asynchronous.
        return true;
    }


});

//}); 


function scrapeContext() {
    const MAX_ELEMENTS = 25;

    //  common interactive elements: links, buttons etc
    const interactiveElements = Array.from(document.querySelectorAll('a, button, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]), textarea'))
        .filter(el => {
            // 1.  visibility
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            // 2. size
            const rect = el.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) {
                return false;
            }
            // 3. state
            if (el.disabled) {
                return false;
            }
            return true;
        })
        .slice(0, MAX_ELEMENTS) // token-limit
        .map((el, index) => {

            // stable selector for the LLM to return
            //  temporary, custom attribute for reliability (P2's best practice)
            const uniqueSelector = `[data-elder-guide-id="${index}"]`;
            el.setAttribute('data-elder-guide-id', index);

            // this extracts primary text content 
            let textContent = el.innerText
                ? el.innerText.trim().substring(0, 70)
                : el.getAttribute('placeholder') || el.getAttribute('value') || el.getAttribute('aria-label') || '';


            textContent = textContent.replace(/\s+/g, ' ').trim();

            return {
                type: el.tagName.toLowerCase(),
                text: textContent,
                id: el.id || '', // Include element's actual ID if present
                selector: uniqueSelector, // The simple selector for the LLM's response
                isClickable: el.tagName === 'A' || el.tagName === 'BUTTON',
            };
        });

    return {
        pageTitle: document.title,
        pageURL: document.URL,
        // Provide the total element count to P3's prompt engineering for context
        elementCount: interactiveElements.length,
        interactiveElements: interactiveElements
    };
}




/**
 * PHASE 2: Highlighting
 * @param {string} selector - The CSS selector for the element to highlight.
 */
function highlightElement(selector) {

    document.querySelectorAll('.elder-guide-highlight').forEach(el => {
        el.classList.remove('elder-guide-highlight');
        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.zIndex = '';
    });

    //fallback
    if (selector.toLowerCase() === 'document.body') {
        // Option A (Best): Just scroll to the top/bottom gently and exit.
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
        console.log("Guide: Element not found, gentle scroll executed.");
        return;


    }




    const targetElement = document.querySelector(selector);

    if (targetElement) {
        // high-visibility styles
        targetElement.classList.add('elder-guide-highlight');
        targetElement.style.boxShadow = '0 0 0 5px #FF5733'; // Bright orange/red shadow
        targetElement.style.outline = '3px solid #C70039'; // Solid outline
        targetElement.style.zIndex = '999999'; // Ensures visibility over page content

        // Scroll the highlighted part into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        console.log(`Elder-Guide: Successfully highlighted element: ${selector}`);
    } else {
        console.error(`Elder-Guide: Could not find element with selector: ${selector}`);
    }
}
