import { configRead } from '../config.js';

const style = document.createElement('style');
let css = '';

function updateStyle() {
    css = `
    ytlr-guide-response yt-focus-container {
        background-color: ${configRead('focusContainerColor')};
    }

    #container {
        background-color: ${configRead('routeColor')} !important;
    }
`;
    const existingStyle = document.querySelector('style[nonce]');
    if (existingStyle) {
        existingStyle.textContent += css;
    } else {
        style.textContent = css;
    }
};

// document.head is null when the userscript is injected at document_start
// (the userscript-manager path). Mount the style once a head exists instead
// of throwing at import time and aborting the whole bundle.
function mountStyle() {
    if (!document.head) {
        setTimeout(mountStyle, 200);
        return;
    }
    document.head.appendChild(style);
    updateStyle();
}
mountStyle();
export default updateStyle;