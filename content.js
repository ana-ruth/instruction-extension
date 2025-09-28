chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // Handles the request for context (P3 sends { type: 'GET_CONTEXT' } in the initial step)
    if (message.type === 'GET_CONTEXT') {
        // Calls the refined scraper and sends the context back to P3
        sendResponse({ type: 'CONTEXT_RESPONSE', context: scrapeContext() });
        return true;
    }

    //  'LLM_INSTRUCTION' is typed and ensures instruction is present
    if (message.type === 'LLM_INSTRUCTION' && message.selector && message.instruction) {
        // Pass both the selector and the instruction to the visual handler
        highlightElement(message.selector, message.instruction);
    }
});

// -----------------------------------------------------------------------------

/**
 * PHASE 2: Robust DOM Context Scraper 
 * (Remains the same as before)
 */
function scrapeContext() {
    const MAX_ELEMENTS = 25;

    const interactiveElements = Array.from(document.querySelectorAll('a, button, input:not([type="hidden"]):not([type="submit"]):not([type="reset"]), textarea'))
        .filter(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) return false;
            if (el.disabled) return false;
            return true;
        })
        .slice(0, MAX_ELEMENTS)
        .map((el, index) => {
            const uniqueSelector = `[data-elder-guide-id="${index}"]`;
            el.setAttribute('data-elder-guide-id', index);
            let textContent = el.innerText ? el.innerText.trim().substring(0, 70) : el.getAttribute('placeholder') || el.getAttribute('value') || el.getAttribute('aria-label') || '';
            textContent = textContent.replace(/\s+/g, ' ').trim();

            return {
                type: el.tagName.toLowerCase(),
                text: textContent,
                id: el.id || '',
                selector: uniqueSelector,
                isClickable: el.tagName === 'A' || el.tagName === 'BUTTON',
            };
        });

    return {
        pageTitle: document.title,
        pageURL: document.URL,
        elementCount: interactiveElements.length,
        interactiveElements: interactiveElements
    };
}

// -----------------------------------------------------------------------------

/**
 * PHASE 2: Highlighting and Instruction Display Logic (Tasks 10-12h + Visual Instruction)
 * Applies highlighting and displays the instruction on the page.
 * @param {string} selector - The CSS selector for the element to highlight.
 * @param {string} instructionText - The guidance text from the LLM.
 */
function highlightElement(selector, instructionText) {
    // 1. Clear any previously highlighted elements and instruction boxes
    document.querySelectorAll('.elder-guide-highlight').forEach(el => {
        el.classList.remove('elder-guide-highlight');
        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.zIndex = '';
    });
    // Remove old instruction box
    document.querySelectorAll('#elder-guide-instruction-box').forEach(el => el.remove());

    const targetElement = document.querySelector(selector);

    if (targetElement) {
        // 2. Apply high-visibility styles
        targetElement.classList.add('elder-guide-highlight');
        targetElement.style.boxShadow = '0 0 0 5px #FF5733'; // Highlight
        targetElement.style.outline = '3px solid #C70039';
        targetElement.style.zIndex = '999999'; // Ensure visibility
        // Optional: Ensure the element itself can be positioned relative to other elements
        targetElement.style.position = targetElement.style.position || 'relative';

        // 3. Create the instruction box 💡
        const instructionBox = document.createElement('div');
        instructionBox.id = 'elder-guide-instruction-box';

        // Get the target element's position on the screen
        const rect = targetElement.getBoundingClientRect();

        instructionBox.style.cssText = `
            position: fixed;
            /* Position the box slightly below and to the left of the element */
            top: ${rect.bottom + window.scrollY + 10}px;
            left: ${rect.left + window.scrollX}px;
            max-width: 300px;
            background-color: #C70039;
            color: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            font-size: 18px; /* Larger, more readable font */
            font-family: Arial, sans-serif;
            z-index: 1000000;
            line-height: 1.4;
            opacity: 1;
        `;
        instructionBox.innerHTML = `<strong>➡️ Guide:</strong> ${instructionText}`;
        document.body.appendChild(instructionBox);

        // 4. Scroll the highlighted element into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        console.log(`Elder-Guide: Displaying instruction for element: ${selector}`);
    } else {
        console.error(`Elder-Guide: Could not find element with selector: ${selector}`);
    }
}