// Fast-Tube Injection Script
// Advanced ad-blocking, SponsorBlock, and Settings UI integration for YouTube TV on Cobalt
// Derived from TizenTube and VacuumTube

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- 1. Settings Injection (Fast-Tube Settings in YouTube TV) ---
    function PatchSettings(settingsObject) {
        if (!settingsObject || !Array.isArray(settingsObject.items)) return;
        
        // Avoid duplicate category
        for (let i = 0; i < settingsObject.items.length; i++) {
            const cat = settingsObject.items[i]?.settingCategoryCollectionRenderer;
            if (cat && cat.categoryId === 'fast_tube_category') return;
        }

        const fastTubeAction = {
            settingActionRenderer: {
                title: {
                    runs: [{ text: "Fast-Tube Settings" }]
                },
                actionLabel: {
                    runs: [{ text: "Patches Active" }]
                },
                summary: {
                    runs: [{ text: "Ad-Block, SponsorBlock & No-Ad Playback Active" }]
                },
                itemId: "fast_tube_status_item",
                thumbnail: {
                    thumbnails: [
                        { url: "https://www.gstatic.com/ytlr/img/parent_code.png" }
                    ]
                },
                trackingParams: "null"
            }
        };

        const fastTubeCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_category",
                title: {
                    runs: [{ text: "Fast-Tube" }]
                },
                items: [fastTubeAction],
                focused: false,
                trackingParams: "null"
            }
        };

        // Remove "Get YouTube Premium" and promo categories from settings
        for (let i = settingsObject.items.length - 1; i >= 0; i--) {
            const item = settingsObject.items[i];
            const str = JSON.stringify(item);
            if (str && (str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('SPunlimited') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                settingsObject.items.splice(i, 1);
            }
        }

        // Add Fast-Tube category to the top of settings
        settingsObject.items.unshift(fastTubeCategory);
    }

    // --- 2. SponsorBlock Integration ---
    let currentVideoId = null;
    let sponsorSegments = [];
    const segmentCache = new Map();

    function checkSponsorBlock(videoId) {
        if (!videoId || typeof videoId !== 'string' || videoId === currentVideoId) return;
        currentVideoId = videoId;
        if (segmentCache.has(videoId)) {
            sponsorSegments = segmentCache.get(videoId);
            return;
        }
        const fetchFunc = window.fetch;
        if (typeof fetchFunc === 'function') {
            fetchFunc('https://sponsor.ajay.app/api/skipSegments?videoID=' + encodeURIComponent(videoId) + '&categories=["sponsor","interaction","intro","outro","selfpromo","preview","music_offtopic","filler"]')
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

    // --- 3. Core JSON.parse Hook (TizenTube Ad-Block & Settings Hook) ---
    const origParse = JSON.parse;
    JSON.parse = function() {
        const r = origParse.apply(this, arguments);
        if (!r || typeof r !== 'object') return r;
        try {
            // A. Remove video player ads
            if (r.adPlacements) {
                r.adPlacements = [];
            }
            if (r.playerAds) {
                r.playerAds = false;
            }
            if (r.adSlots) {
                r.adSlots = [];
            }
            if (r.adBreakParams) {
                delete r.adBreakParams;
            }
            if (r.paidContentOverlay) {
                r.paidContentOverlay = null;
            }
            if (r.playbackTracking) {
                delete r.playbackTracking.atrUrl;
                delete r.playbackTracking.cpnUrl;
                delete r.playbackTracking.videostatsPlaybackUrl;
                delete r.playbackTracking.videostatsDelayplayUrl;
                delete r.playbackTracking.videostatsWatchtimeUrl;
                delete r.playbackTracking.ptrackingUrl;
                delete r.playbackTracking.qoeUrl;
            }

            // B. Extract videoId for SponsorBlock
            if (r.videoDetails && r.videoDetails.videoId) {
                checkSponsorBlock(r.videoDetails.videoId);
            }

            // C. Remove home screen / browse masthead ads & nudges
            if (r.contents && r.contents.tvBrowseRenderer && r.contents.tvBrowseRenderer.content && r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer && r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content && r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer && r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents) {
                const contents = r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents;
                r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents = contents.filter(elm => !elm.adSlotRenderer && !elm.feedNudgeRenderer && !elm.statementBannerRenderer && !elm.premiumUpsellRenderer);
                for (let i = 0; i < r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.length; i++) {
                    const shelf = r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents[i];
                    if (shelf.shelfRenderer && shelf.shelfRenderer.content && shelf.shelfRenderer.content.horizontalListRenderer && shelf.shelfRenderer.content.horizontalListRenderer.items) {
                        shelf.shelfRenderer.content.horizontalListRenderer.items = shelf.shelfRenderer.content.horizontalListRenderer.items.filter(item => !item.adSlotRenderer && !item.compactPromotedItemRenderer);
                    }
                }
            }

            // D. Remove Shorts ads
            if (!Array.isArray(r) && r.entries && Array.isArray(r.entries)) {
                r.entries = r.entries.filter(elm => !elm?.command?.reelWatchEndpoint?.adClientParams?.isAd);
            }

            // E. Remove 'Get YouTube Premium' & SPunlimited from guide items
            if (r.items && Array.isArray(r.items)) {
                for (let i = r.items.length - 1; i >= 0; i--) {
                    const item = r.items[i];
                    const str = JSON.stringify(item);
                    if (str && (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                        r.items.splice(i, 1);
                    }
                }
            }

            // F. Patch Settings with Fast-Tube option
            if (r.title && r.title.runs && Array.isArray(r.items)) {
                PatchSettings(r);
            }
        } catch (e) {}
        return r;
    };

    window.JSON.parse = JSON.parse;

    // --- 4. Core JSON.stringify Hook (Inline No-Ad Flag) ---
    const origStringify = JSON.stringify;
    JSON.stringify = function(value, replacer, space) {
        if (value && typeof value === 'object' && value.playbackContext && value.playbackContext.contentPlaybackContext) {
            try {
                value.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd = true;
            } catch(e) {}
        }
        return origStringify.call(this, value, replacer, space);
    };

    window.JSON.stringify = JSON.stringify;

    // Patch any existing internal _yttv references
    if (typeof window._yttv === 'object') {
        for (const key in window._yttv) {
            if (window._yttv[key] && window._yttv[key].JSON) {
                window._yttv[key].JSON.parse = JSON.parse;
                window._yttv[key].JSON.stringify = JSON.stringify;
            }
        }
    }

    // --- 5. Network Level Ad Interception (Fetch & XMLHttpRequest) ---
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

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
        window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            if (isAdUrl(url)) {
                return new Response(JSON.stringify({}), {
                    status: 200,
                    statusText: "OK",
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (url.indexOf('/youtubei/v1/player') !== -1 || url.indexOf('/youtubei/v1/reel/') !== -1) {
                try {
                    if (args[1] && args[1].body) {
                        try {
                            const reqData = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
                            if (reqData && reqData.videoId) checkSponsorBlock(reqData.videoId);
                        } catch(e) {}
                    }
                } catch(e) {}
            }
            return originalFetch.apply(this, args);
        };
    }

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

            if (url.indexOf('/youtubei/v1/player') !== -1 && body) {
                try {
                    const reqData = typeof body === 'string' ? JSON.parse(body) : body;
                    if (reqData && reqData.videoId) checkSponsorBlock(reqData.videoId);
                } catch(e) {}
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

    // Ad Watchdog & Fast-Forward Fallback
    setInterval(() => {
        if (typeof document === 'undefined') return;
        const video = document.querySelector('video');
        if (video) {
            hookVideoElement(video);
            
            const adShowing = document.querySelector('.ad-interrupting, .ad-showing, .ytp-ad-module, .ytp-ad-player-overlay, ytlr-ad-renderer, .ytp-ad-self-ad-badge, .ytp-ad-text');
            if (adShowing) {
                if (video.duration && !isNaN(video.duration) && video.currentTime < video.duration) {
                    video.currentTime = video.duration;
                }
                video.playbackRate = 16.0;
            }
            
            const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button');
            if (skipButton && typeof skipButton.click === 'function') {
                skipButton.click();
            }
        }

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
