// Fast-Tube Injection Script
// High-performance, event-driven ad-blocking and SponsorBlock integration for YouTube TV on Cobalt

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- High-Performance Network Request Interception ---
    const originalFetch = window.fetch;
    const AD_URL_PATTERNS = ['/api/stats/ads', '/ptracking', '/pagead/', 'googleads.g.doubleclick.net', '/youtubei/v1/att/get'];

    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        
        // Fast URL filter for ads & tracking
        for (let i = 0; i < AD_URL_PATTERNS.length; i++) {
            if (url.includes(AD_URL_PATTERNS[i])) {
                return new Response(JSON.stringify({}), { status: 200, statusText: "OK", headers: { 'Content-Type': 'application/json' } });
            }
        }

        // Intercept player responses to strip ad payloads & extract video ID
        if (url.includes('/youtubei/v1/player')) {
            try {
                if (args[1] && args[1].body) {
                    try {
                        const reqData = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
                        if (reqData && reqData.videoId) checkSponsorBlock(reqData.videoId);
                    } catch(e) {}
                }

                const response = await originalFetch.apply(this, args);
                const clone = response.clone();
                const data = await clone.json();
                
                if (data && data.videoDetails && data.videoDetails.videoId) {
                    checkSponsorBlock(data.videoDetails.videoId);
                }

                if (data) {
                    delete data.adPlacements;
                    delete data.playerAds;
                    delete data.adSlots;
                    delete data.adBreakParams;
                    if (data.playbackTracking) {
                        delete data.playbackTracking.atrUrl;
                        delete data.playbackTracking.cpnUrl;
                    }
                }
                
                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                return originalFetch.apply(this, args);
            }
        }

        return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest with fast bypass
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._url) {
            for (let i = 0; i < AD_URL_PATTERNS.length; i++) {
                if (this._url.includes(AD_URL_PATTERNS[i])) return;
            }
        }
        return origSend.call(this, body);
    };

    // --- SponsorBlock Integration (Cached & Event-Driven) ---
    let currentVideoId = null;
    let sponsorSegments = [];
    const segmentCache = new Map();

    function checkSponsorBlock(videoId) {
        if (!videoId || videoId === currentVideoId) return;
        currentVideoId = videoId;
        
        if (segmentCache.has(videoId)) {
            sponsorSegments = segmentCache.get(videoId);
            return;
        }

        originalFetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["sponsor","interaction","intro","outro","selfpromo","music_offtopic"]`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    sponsorSegments = data.map(s => ({ start: s.segment[0], end: s.segment[1] }));
                    segmentCache.set(videoId, sponsorSegments);
                    if (segmentCache.size > 50) {
                        const firstKey = segmentCache.keys().next().value;
                        segmentCache.delete(firstKey);
                    }
                } else {
                    sponsorSegments = [];
                }
            })
            .catch(() => {
                sponsorSegments = [];
            });
    }

    // --- Event-Driven Video Element Hooking ---
    let trackedVideo = null;

    function onTimeUpdate() {
        if (!trackedVideo || trackedVideo.paused || !sponsorSegments.length) return;
        const ct = trackedVideo.currentTime;
        for (let i = 0; i < sponsorSegments.length; i++) {
            const seg = sponsorSegments[i];
            if (ct >= seg.start && ct < (seg.end - 0.2)) {
                trackedVideo.currentTime = seg.end;
                break;
            }
        }
    }

    function hookVideoElement(video) {
        if (!video || video === trackedVideo) return;
        if (trackedVideo) {
            trackedVideo.removeEventListener('timeupdate', onTimeUpdate);
        }
        trackedVideo = video;
        trackedVideo.addEventListener('timeupdate', onTimeUpdate, { passive: true });
    }

    // Lightweight Watchdog (Runs at low frequency 1s only to detect new video instances)
    setInterval(() => {
        const video = document.querySelector('video');
        if (video) {
            hookVideoElement(video);
            const adContainer = document.querySelector('.ad-interrupting, .ytp-ad-self-ad-badge, .ytp-ad-text');
            if (adContainer && video.duration && !isNaN(video.duration)) {
                video.currentTime = video.duration;
            }
        }
        const hash = (window.location && window.location.hash) ? window.location.hash : '';
        if (hash && hash.includes('v=')) {
            const vMatch = hash.match(/v=([a-zA-Z0-9_-]{11})/);
            if (vMatch && vMatch[1]) checkSponsorBlock(vMatch[1]);
        }
    }, 1000);

    // CSS Rule injection (runs once)
    const injectStyles = () => {
        if (document.getElementById('fast-tube-styles')) return;
        const style = document.createElement('style');
        style.id = 'fast-tube-styles';
        style.textContent = 'ytd-ad-slot-renderer,ytd-promoted-sparkles-web-renderer,.ytd-display-ad-renderer,.ytp-ad-overlay-container,.ytp-ad-message-container,.ytp-ad-skip-button-container,yt-mealbar-promo-renderer,ytd-statement-banner-renderer,.badge-style-type-ad{display:none !important;}';
        (document.head || document.documentElement).appendChild(style);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
    } else {
        injectStyles();
    }
})();
