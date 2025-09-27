// content.js
// P2's focus: DOM Scraper & Highlighting Logic


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
