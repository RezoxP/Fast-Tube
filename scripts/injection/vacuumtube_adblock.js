// Fast-Tube Injection Script
// High-performance ad-blocking, SponsorBlock, and Premium promo cleanup for YouTube TV (Cobalt)

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- 1. Ad URL Patterns ---
    const AD_URL_PATTERNS = [
        '/api/stats/ads',
        '/ptracking',
        '/pagead/',
        'googleads.g.doubleclick.net',
        'doubleclick.net',
        '/youtubei/v1/att/get',
        'adservice.google.com',
        '/api/stats/qoe'
    ];

    function isAdUrl(url) {
        if (!url || typeof url !== 'string') return false;
        for (let i = 0; i < AD_URL_PATTERNS.length; i++) {
            if (url.indexOf(AD_URL_PATTERNS[i]) !== -1) return true;
        }
        return false;
    }

    // --- 2. Response Sanitization ---
    function sanitizePlayerResponse(data) {
        if (!data || typeof data !== 'object') return data;
        delete data.adPlacements;
        delete data.playerAds;
        delete data.adSlots;
        delete data.adBreakParams;
        if (data.playbackTracking) {
            delete data.playbackTracking.atrUrl;
            delete data.playbackTracking.cpnUrl;
            delete data.playbackTracking.videostatsPlaybackUrl;
            delete data.playbackTracking.videostatsDelayplayUrl;
            delete data.playbackTracking.videostatsWatchtimeUrl;
            delete data.playbackTracking.ptrackingUrl;
            delete data.playbackTracking.qoeUrl;
        }
        return data;
    }

    function sanitizeBrowseResponse(data) {
        if (!data || typeof data !== 'object') return data;
        function cleanNode(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                for (let i = obj.length - 1; i >= 0; i--) {
                    const item = obj[i];
                    if (item) {
                        const keys = Object.keys(item);
                        let remove = false;
                        for (let k = 0; k < keys.length; k++) {
                            const key = keys[k];
                            if (key.indexOf('adPlacement') !== -1 ||
                                key.indexOf('promotedSparkles') !== -1 ||
                                key.indexOf('statementBanner') !== -1 ||
                                key.indexOf('premiumUpsell') !== -1 ||
                                key.indexOf('mealbarPromo') !== -1) {
                                remove = true;
                                break;
                            }
                        }
                        const str = JSON.stringify(item);
                        if (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1) {
                            remove = true;
                        }
                        if (remove) {
                            obj.splice(i, 1);
                        } else {
                            cleanNode(item);
                        }
                    }
                }
            } else {
                delete obj.adPlacements;
                delete obj.playerAds;
                delete obj.adSlots;
                delete obj.adBreakParams;
                delete obj.statementBannerRenderer;
                delete obj.premiumUpsellRenderer;
                delete obj.mealbarPromoRenderer;
                const keys = Object.keys(obj);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        cleanNode(obj[key]);
                    }
                }
            }
        }
        cleanNode(data);
        return data;
    }

    // --- 3. SponsorBlock Integration ---
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
        const fetchFunc = originalFetch || window.fetch;
        if (typeof fetchFunc === 'function') {
            fetchFunc(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=["sponsor","interaction","intro","outro","selfpromo","preview","music_offtopic","filler"]`)
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    if (Array.isArray(data)) {
                        sponsorSegments = data.map(s => ({ start: s.segment[0], end: s.segment[1] }));
                        segmentCache.set(videoId, sponsorSegments);
                        if (segmentCache.size > 100) segmentCache.delete(segmentCache.keys().next().value);
                    } else {
                        sponsorSegments = [];
                    }
                })
                .catch(() => { sponsorSegments = []; });
        }
    }

    // --- 4. Fetch Interception ---
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
        window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            
            // Block ad URLs immediately
            if (isAdUrl(url)) {
                return new Response(JSON.stringify({}), {
                    status: 200,
                    statusText: "OK",
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Intercept player & Shorts
            if (url.indexOf('/youtubei/v1/player') !== -1 || url.indexOf('/youtubei/v1/reel/') !== -1) {
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
                    sanitizePlayerResponse(data);
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                } catch (e) {
                    return originalFetch.apply(this, args);
                }
            }

            // Intercept browse / guide / next / account
            if (url.indexOf('/youtubei/v1/browse') !== -1 || url.indexOf('/youtubei/v1/guide') !== -1 || url.indexOf('/youtubei/v1/next') !== -1 || url.indexOf('/youtubei/v1/account/') !== -1) {
                try {
                    const response = await originalFetch.apply(this, args);
                    const clone = response.clone();
                    const data = await clone.json();
                    sanitizeBrowseResponse(data);
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
    }

    // --- 5. XMLHttpRequest Interception ---
    if (typeof XMLHttpRequest !== 'undefined') {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this.__url = url;
            this.__method = method;
            return origOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
            const url = this.__url || '';
            if (isAdUrl(url)) {
                // Mock instant 200 OK
                setTimeout(() => {
                    try {
                        Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                        Object.defineProperty(this, 'status', { value: 200, configurable: true });
                        Object.defineProperty(this, 'statusText', { value: 'OK', configurable: true });
                        Object.defineProperty(this, 'responseText', { value: '{}', configurable: true });
                        Object.defineProperty(this, 'response', { value: '{}', configurable: true });
                        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
                        if (typeof this.onload === 'function') this.onload();
                        if (typeof this.onloadend === 'function') this.onloadend();
                    } catch(e) {}
                }, 0);
                return;
            }

            const isPlayer = url.indexOf('/youtubei/v1/player') !== -1 || url.indexOf('/youtubei/v1/reel/') !== -1;
            const isBrowse = url.indexOf('/youtubei/v1/browse') !== -1 || url.indexOf('/youtubei/v1/guide') !== -1 || url.indexOf('/youtubei/v1/next') !== -1 || url.indexOf('/youtubei/v1/account/') !== -1;

            if (isPlayer && body) {
                try {
                    const reqData = typeof body === 'string' ? JSON.parse(body) : body;
                    if (reqData && reqData.videoId) checkSponsorBlock(reqData.videoId);
                } catch(e) {}
            }

            if (isPlayer || isBrowse) {
                const self = this;
                const sanitizeXHR = function() {
                    try {
                        if (self.readyState === 4 && (self.status === 200 || self.status === 0) && self.responseText) {
                            let data = JSON.parse(self.responseText);
                            if (isPlayer) {
                                if (data && data.videoDetails && data.videoDetails.videoId) {
                                    checkSponsorBlock(data.videoDetails.videoId);
                                }
                                data = sanitizePlayerResponse(data);
                            } else if (isBrowse) {
                                data = sanitizeBrowseResponse(data);
                            }
                            const sanitizedStr = JSON.stringify(data);
                            Object.defineProperty(self, 'responseText', { value: sanitizedStr, configurable: true });
                            Object.defineProperty(self, 'response', { value: (self.responseType === 'json' ? data : sanitizedStr), configurable: true });
                        }
                    } catch(e) {}
                };

                if (typeof this.addEventListener === 'function') {
                    this.addEventListener('readystatechange', sanitizeXHR, true);
                    this.addEventListener('load', sanitizeXHR, true);
                }
            }

            return origSend.call(this, body);
        };
    }

    // --- 6. Video Element Hooking & SponsorBlock Skipper ---
    let trackedVideo = null;
    function onTimeUpdate() {
        if (!trackedVideo || trackedVideo.paused || !sponsorSegments.length) return;
        const ct = trackedVideo.currentTime;
        for (let i = 0; i < sponsorSegments.length; i++) {
            const seg = sponsorSegments[i];
            if (ct >= seg.start && ct < (seg.end - 0.15)) {
                trackedVideo.currentTime = seg.end;
                break;
            }
        }
    }

    function hookVideoElement(video) {
        if (!video || video === trackedVideo) return;
        if (trackedVideo) {
            try { trackedVideo.removeEventListener('timeupdate', onTimeUpdate); } catch(e) {}
        }
        trackedVideo = video;
        try { trackedVideo.addEventListener('timeupdate', onTimeUpdate, { passive: true }); } catch(e) {}
    }

    // High frequency ad skipper & watchdog
    setInterval(() => {
        if (typeof document === 'undefined') return;
        const video = document.querySelector('video');
        if (video) {
            hookVideoElement(video);
            
            // Check for ad containers or ad interrupting state
            const adShowing = document.querySelector('.ad-interrupting, .ad-showing, .ytp-ad-module, .ytp-ad-player-overlay, ytlr-ad-renderer, .ytp-ad-self-ad-badge, .ytp-ad-text');
            if (adShowing) {
                if (video.duration && !isNaN(video.duration) && video.currentTime < video.duration) {
                    video.currentTime = video.duration;
                }
                video.playbackRate = 16.0;
            }
            
            // Click skip buttons
            const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button');
            if (skipButton && typeof skipButton.click === 'function') {
                skipButton.click();
            }
        }

        // Hash video ID check
        const hash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash : '';
        if (hash && hash.indexOf('v=') !== -1) {
            const vMatch = hash.match(/v=([a-zA-Z0-9_-]{11})/);
            if (vMatch && vMatch[1]) checkSponsorBlock(vMatch[1]);
        }
    }, 500);

    // --- 7. CSS Rules Injection ---
    const injectStyles = () => {
        if (typeof document === 'undefined' || document.getElementById('fast-tube-styles')) return;
        const style = document.createElement('style');
        style.id = 'fast-tube-styles';
        style.textContent = 'ytd-ad-slot-renderer,ytd-promoted-sparkles-web-renderer,.ytd-display-ad-renderer,.ytp-ad-overlay-container,.ytp-ad-message-container,.ytp-ad-skip-button-container,.ytp-ad-preview-container,.ytp-ad-player-overlay,.ytp-ad-image-overlay,yt-mealbar-promo-renderer,ytd-statement-banner-renderer,.badge-style-type-ad,ytlr-ad-badge-renderer,ytlr-ad-renderer,ytlr-compact-promoted-item-renderer,ytlr-promoted-video-renderer,ytlr-statement-banner-renderer,ytlr-mealbar-promo-renderer,ytlr-premium-promo-renderer,.ytlr-ad-badge,[class*="ad-showing"] .ytp-ad-overlay-container,[class*="ad-interrupting"] .ytp-ad-overlay-container,[aria-label="Get YouTube Premium"],[aria-label*="YouTube Premium"]{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;height:0 !important;width:0 !important;}';
        const target = document.head || document.documentElement || document.body;
        if (target && typeof target.appendChild === 'function') {
            target.appendChild(style);
        }
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
        } else {
            injectStyles();
        }
    }
})();
