import { configRead } from '../config.js';

let style = null;

function updateStyle() {
    const css = `
    ytlr-guide-response yt-focus-container {
        background-color: ${configRead('focusContainerColor')};
    }

    #container {
        background-color: ${configRead('routeColor')} !important;
    }
`;
    if (!style) {
        style = document.getElementById('fasttube-theme');
    }
    if (style) {
        style.textContent = css;
    }
}

function mountStyle() {
    const head = document.head || document.documentElement;
    if (!head) {
        setTimeout(mountStyle, 200);
        return;
    }
    style = document.getElementById('fasttube-theme');
    if (!style) {
        style = document.createElement('style');
        style.id = 'fasttube-theme';
        head.appendChild(style);
    }
    updateStyle();
}

mountStyle();
export default updateStyle;