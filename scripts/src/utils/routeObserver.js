// Fast-Tube Unified SPA Route Observer
// Intercepts history.pushState, history.replaceState, hashchange, and popstate
// Provides zero-latency route change events without background polling loops.

const listeners = new Set();
let currentUrl = typeof window !== 'undefined' && window.location ? (window.location.href || '') : '';

export function onRoute(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function notifyRoute(force = false) {
    if (typeof window === 'undefined') return;
    const newUrl = window.location ? (window.location.href || '') : '';
    if (!force && newUrl === currentUrl) return;
    currentUrl = newUrl;
    for (const cb of listeners) {
        try {
            cb(newUrl);
        } catch (e) {
            console.error('[Fast-Tube] Route observer callback error:', e);
        }
    }
}

if (typeof window !== 'undefined') {
    const wrap = (target, method) => {
        if (!target) return;
        const orig = target[method];
        if (typeof orig !== 'function') return;
        target[method] = function () {
            const res = orig.apply(this, arguments);
            notifyRoute();
            return res;
        };
    };

    if (window.history) {
        wrap(window.history, 'pushState');
        wrap(window.history, 'replaceState');
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('hashchange', () => notifyRoute(true));
        window.addEventListener('popstate', () => notifyRoute(true));
    }
}
