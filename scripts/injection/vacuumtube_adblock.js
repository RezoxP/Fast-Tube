// Fast-Tube Injection Script
// Complete SponsorBlock capabilities (Auto-Skip, On-Screen Skip Button Prompt, Granular Categories, Toast Notifications)
// Configurable Leanback Settings for YouTube TV on Cobalt

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- 1. Config Management & Granular Settings ---
    const DEFAULT_CONFIG = {
        // General
        adblock: true,
        hideShorts: false,
        hidePaidPromotion: true,

        // SponsorBlock Modes & Controls
        sponsorblock: true,
        sb_auto_skip: true,
        sb_show_skip_button: true,
        sb_show_toast: true,

        // SponsorBlock Granular Categories
        sb_sponsor: true,
        sb_intro: true,
        sb_outro: true,
        sb_selfpromo: true,
        sb_preview: false,
        sb_music_offtopic: false
    };

    let ftConfig = Object.assign({}, DEFAULT_CONFIG);
    try {
        const saved = localStorage.getItem('fast_tube_config');
        if (saved) {
            Object.assign(ftConfig, JSON.parse(saved));
        }
    } catch(e) {}

    function saveConfig() {
        try {
            localStorage.setItem('fast_tube_config', JSON.stringify(ftConfig));
        } catch(e) {}
    }

    function getActiveSBCategories() {
        const cats = [];
        if (ftConfig.sb_sponsor !== false) cats.push('sponsor');
        if (ftConfig.sb_intro !== false) { cats.push('intro'); cats.push('intermission'); }
        if (ftConfig.sb_outro !== false) cats.push('outro');
        if (ftConfig.sb_selfpromo !== false) cats.push('selfpromo');
        if (ftConfig.sb_preview !== false) { cats.push('preview'); cats.push('filler'); }
        if (ftConfig.sb_music_offtopic !== false) cats.push('music_offtopic');
        return cats;
    }

    function getCategoryName(category) {
        switch (category) {
            case 'sponsor': return 'Sponsor';
            case 'intro': case 'intermission': return 'Intro';
            case 'outro': return 'Outro';
            case 'selfpromo': return 'Self-Promotion';
            case 'preview': case 'filler': return 'Preview';
            case 'music_offtopic': return 'Non-Music';
            default: return 'Segment';
        }
    }

    // --- 2. Interactive Leanback Settings Categories ---
    function createSettingBooleanRenderer(title, summary, configKey, enabled) {
        return {
            settingBooleanRenderer: {
                itemId: configKey,
                enabled: !!enabled,
                title: {
                    runs: [{ text: title }]
                },
                summary: {
                    runs: [{ text: summary }]
                },
                enableServiceEndpoint: {
                    fastTubeOption: configKey,
                    fastTubeValue: true
                },
                disableServiceEndpoint: {
                    fastTubeOption: configKey,
                    fastTubeValue: false
                }
            }
        };
    }

    function PatchSettings(settingsObject) {
        if (!settingsObject || !Array.isArray(settingsObject.items)) return;
        
        for (let i = 0; i < settingsObject.items.length; i++) {
            const cat = settingsObject.items[i]?.settingCategoryCollectionRenderer;
            if (cat && (cat.categoryId === 'fast_tube_general_category' || cat.categoryId === 'fast_tube_sb_category')) {
                return;
            }
        }

        const ftGeneralCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_general_category",
                title: {
                    runs: [{ text: "Fast-Tube: General" }]
                },
                items: [
                    createSettingBooleanRenderer("Ad-Block", "Block video ads, banners, and promoted feed items", "adblock", ftConfig.adblock),
                    createSettingBooleanRenderer("Hide Shorts", "Hide Shorts from home feeds and navigation bar", "hideShorts", ftConfig.hideShorts),
                    createSettingBooleanRenderer("Hide Paid Promo Badges", "Hide 'Includes paid promotion' overlays on videos", "hidePaidPromotion", ftConfig.hidePaidPromotion)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftSBCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_sb_category",
                title: {
                    runs: [{ text: "Fast-Tube: SponsorBlock" }]
                },
                items: [
                    createSettingBooleanRenderer("Enable SponsorBlock", "Master switch for automatic segment skipping", "sponsorblock", ftConfig.sponsorblock),
                    createSettingBooleanRenderer("Auto-Skip Segments", "Instantly skip segments (turn OFF to show Skip Button)", "sb_auto_skip", ftConfig.sb_auto_skip),
                    createSettingBooleanRenderer("Show Skip Button Prompt", "Show on-screen button to skip segments manually", "sb_show_skip_button", ftConfig.sb_show_skip_button),
                    createSettingBooleanRenderer("Show Toast Notifications", "Show on-screen notification when a segment is skipped", "sb_show_toast", ftConfig.sb_show_toast),
                    createSettingBooleanRenderer("Skip Sponsors", "Skip paid promotions, sponsorships, and endorsements", "sb_sponsor", ftConfig.sb_sponsor),
                    createSettingBooleanRenderer("Skip Intros & Intermissions", "Skip channel intros, intro animations, and pauses", "sb_intro", ftConfig.sb_intro),
                    createSettingBooleanRenderer("Skip Outros & End Cards", "Skip end credits, outro cards, and subscribe screens", "sb_outro", ftConfig.sb_outro),
                    createSettingBooleanRenderer("Skip Self-Promotion", "Skip merch plugs, channel memberships, and sub reminders", "sb_selfpromo", ftConfig.sb_selfpromo),
                    createSettingBooleanRenderer("Skip Previews & Recaps", "Skip 'Coming up', episode recaps, and teaser clips", "sb_preview", ftConfig.sb_preview),
                    createSettingBooleanRenderer("Skip Non-Music Sections", "Skip music video intros, outros, and dialogue breaks", "sb_music_offtopic", ftConfig.sb_music_offtopic)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        window.__ftSettingsCategories = [
            ftGeneralCategory.settingCategoryCollectionRenderer,
            ftSBCategory.settingCategoryCollectionRenderer
        ];

        // Filter out "Get YouTube Premium" and promo categories from settings
        for (let i = settingsObject.items.length - 1; i >= 0; i--) {
            const item = settingsObject.items[i];
            const str = JSON.stringify(item);
            if (str && (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                settingsObject.items.splice(i, 1);
            }
        }

        // Add Fast-Tube categories to the top of settings
        settingsObject.items.unshift(ftSBCategory);
        settingsObject.items.unshift(ftGeneralCategory);
    }

    function hookResolveCommand() {
        if (typeof window._yttv !== 'object' || !window._yttv) return;
        for (let key in window._yttv) {
            const inst = window._yttv[key]?.instance;
            if (inst && typeof inst.resolveCommand === 'function' && !inst.__ft_rc_hooked) {
                inst.__ft_rc_hooked = true;
                const origRC = inst.resolveCommand;
                inst.resolveCommand = function(command) {
                    if (command && command.fastTubeOption !== undefined) {
                        const opt = command.fastTubeOption;
                        const val = !!command.fastTubeValue;
                        ftConfig[opt] = val;
                        saveConfig();

                        if (opt.startsWith('sb_') || opt === 'sponsorblock') {
                            segmentCache.clear();
                            currentVideoId = null;
                            removeSkipButton();
                        }

                        if (window.__ftSettingsCategories) {
                            for (let cat of window.__ftSettingsCategories) {
                                if (cat && cat.items) {
                                    for (let it of cat.items) {
                                        if (it?.settingBooleanRenderer?.itemId === opt) {
                                            it.settingBooleanRenderer.enabled = val;
                                        }
                                    }
                                }
                            }
                        }
                        return true;
                    }
                    return origRC.apply(this, arguments);
                };
            }
        }
    }
    hookResolveCommand();

    // --- 3. SponsorBlock UI: Toast & On-Screen Skip Button ---
    function showToast(title, subtitle) {
        if (typeof window._yttv === 'object') {
            for (let key in window._yttv) {
                if (window._yttv[key]?.instance?.resolveCommand) {
                    try {
                        window._yttv[key].instance.resolveCommand({
                            openPopupAction: {
                                popupType: 'TOAST',
                                popup: {
                                    overlayToastRenderer: {
                                        title: { simpleText: title },
                                        subtitle: { simpleText: subtitle }
                                    }
                                }
                            }
                        });
                        return;
                    } catch(e) {}
                }
            }
        }
        // Fallback DOM toast
        if (typeof document !== 'undefined') {
            let toastEl = document.getElementById('fast-tube-toast');
            if (!toastEl) {
                toastEl = document.createElement('div');
                toastEl.id = 'fast-tube-toast';
                (document.body || document.documentElement).appendChild(toastEl);
            }
            toastEl.textContent = title + ': ' + subtitle;
            toastEl.style.opacity = '1';
            clearTimeout(toastEl.__fadeTimeout);
            toastEl.__fadeTimeout = setTimeout(() => {
                toastEl.style.opacity = '0';
            }, 3000);
        }
    }

    let activePromptSegment = null;
    function showSkipButton(segment, categoryName) {
        removeSkipButton();
        if (typeof document === 'undefined') return;
        const btn = document.createElement('div');
        btn.id = 'fast-tube-skip-btn';
        btn.tabIndex = 0;
        btn.setAttribute('role', 'button');
        btn.innerHTML = '<span style="margin-right:10px;font-size:20px;">⏭</span> Skip ' + categoryName + ' <span style="margin-left:10px;font-size:13px;opacity:0.75;">(Press OK)</span>';
        btn.onclick = () => {
            if (trackedVideo) trackedVideo.currentTime = segment.end;
            removeSkipButton();
            if (ftConfig.sb_show_toast !== false) {
                showToast("Fast-Tube", "Skipped " + categoryName + " segment");
            }
        };
        btn.onkeydown = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                if (trackedVideo) trackedVideo.currentTime = segment.end;
                removeSkipButton();
                if (ftConfig.sb_show_toast !== false) {
                    showToast("Fast-Tube", "Skipped " + categoryName + " segment");
                }
            }
        };
        (document.body || document.documentElement).appendChild(btn);
        try { btn.focus(); } catch(e) {}
    }

    function removeSkipButton() {
        if (typeof document === 'undefined') return;
        const existing = document.getElementById('fast-tube-skip-btn');
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
        activePromptSegment = null;
    }

    // --- 4. SponsorBlock Integration ---
    let currentVideoId = null;
    let sponsorSegments = [];
    const segmentCache = new Map();

    function checkSponsorBlock(videoId) {
        if (!ftConfig.sponsorblock || !videoId || typeof videoId !== 'string' || videoId === currentVideoId) return;
        currentVideoId = videoId;
        removeSkipButton();
        if (segmentCache.has(videoId)) {
            sponsorSegments = segmentCache.get(videoId);
            return;
        }

        const activeCats = getActiveSBCategories();
        if (activeCats.length === 0) {
            sponsorSegments = [];
            return;
        }

        const fetchFunc = window.fetch;
        if (typeof fetchFunc === 'function') {
            const catParam = encodeURIComponent(JSON.stringify(activeCats));
            fetchFunc('https://sponsor.ajay.app/api/skipSegments?videoID=' + encodeURIComponent(videoId) + '&categories=' + catParam)
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    if (Array.isArray(data)) {
                        sponsorSegments = data.map(s => ({ start: s.segment[0], end: s.segment[1], category: s.category }));
                        segmentCache.set(videoId, sponsorSegments);
                        if (segmentCache.size > 100) segmentCache.delete(segmentCache.keys().next().value);
                    } else {
                        sponsorSegments = [];
                    }
                })
                .catch(() => { sponsorSegments = []; });
        }
    }

    // --- 5. Core JSON.parse Hook (VacuumTube-Style Pure Performance Ad-Block) ---
    const origParse = JSON.parse;
    JSON.parse = function() {
        const r = origParse.apply(this, arguments);
        if (!r || typeof r !== 'object') return r;
        try {
            // A. Video ads removal (Instant memory zeroing)
            if (ftConfig.adblock) {
                if (r.adPlacements) {
                    r.adPlacements = [];
                }
                if (r.playerAds) {
                    r.playerAds = false;
                }
                if (r.adSlots) {
                    r.adSlots = [];
                }
            }

            if (ftConfig.hidePaidPromotion && r.paidContentOverlay) {
                r.paidContentOverlay = null;
            }

            // B. Extract videoId for SponsorBlock
            if (r.videoDetails && r.videoDetails.videoId) {
                checkSponsorBlock(r.videoDetails.videoId);
                hookActiveVideo();
            }

            // C. Home feed ads & promos removal
            if (ftConfig.adblock) {
                let homeFeed = r.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer;
                if (homeFeed && homeFeed.contents) {
                    homeFeed.contents = homeFeed.contents.filter(shelf => {
                        if (shelf.adSlotRenderer || shelf.promoShelfRenderer || shelf.shelfRenderer?.tvhtml5Metadata?.hideLogo) {
                            return false;
                        }
                        if (ftConfig.hideShorts && JSON.stringify(shelf).indexOf('reelWatchEndpoint') !== -1) {
                            return false;
                        }
                        return true;
                    });
                    for (let feed of homeFeed.contents) {
                        let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                        if (horizontal && horizontal.items) {
                            horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer && !i.compactPromotedItemRenderer);
                        }
                    }
                }

                // Search feed ads
                let searchFeed = r.contents?.sectionListRenderer;
                if (searchFeed && searchFeed.contents) {
                    for (let feed of searchFeed.contents) {
                        let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                        if (horizontal && horizontal.items) {
                            horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer && !i.compactPromotedItemRenderer);
                        }
                    }
                }

                // Shorts ads removal
                if (!Array.isArray(r) && r.entries && Array.isArray(r.entries)) {
                    r.entries = r.entries.filter(elm => !elm?.command?.reelWatchEndpoint?.adClientParams?.isAd);
                }

                // Remove "Get YouTube Premium" from guide items
                if (r.items && Array.isArray(r.items)) {
                    for (let i = r.items.length - 1; i >= 0; i--) {
                        const item = r.items[i];
                        const str = JSON.stringify(item);
                        if (str && (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                            r.items.splice(i, 1);
                        }
                    }
                }
            }

            // D. Patch Settings with Fast-Tube categories
            if (r.title && r.title.runs && Array.isArray(r.items)) {
                PatchSettings(r);
            }
        } catch (e) {}
        return r;
    };

    window.JSON.parse = JSON.parse;

    if (typeof window._yttv === 'object') {
        for (const key in window._yttv) {
            if (window._yttv[key] && window._yttv[key].JSON) {
                window._yttv[key].JSON.parse = JSON.parse;
            }
        }
    }

    // --- 6. Network Level Ad Interception ---
    const AD_URL_PATTERNS = [
        '/api/stats/ads',
        '/ptracking',
        '/pagead/',
        'googleads.g.doubleclick.net',
        'doubleclick.net',
        'adservice.google.com'
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
            if (ftConfig.adblock && isAdUrl(url)) {
                return new Response(JSON.stringify({}), {
                    status: 200,
                    statusText: "OK",
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (url.indexOf('/youtubei/v1/player') !== -1) {
                try {
                    if (args[1] && args[1].body) {
                        const reqData = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
                        if (reqData && reqData.videoId) checkSponsorBlock(reqData.videoId);
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
            if (ftConfig.adblock && isAdUrl(url)) {
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

    // --- 7. Event-Driven Video Hooking & SponsorBlock Handling ---
    let trackedVideo = null;
    function onTimeUpdate() {
        if (!ftConfig.sponsorblock || !trackedVideo || trackedVideo.paused || !sponsorSegments.length) {
            removeSkipButton();
            return;
        }

        const ct = trackedVideo.currentTime;
        let inSegment = null;

        for (let i = 0; i < sponsorSegments.length; i++) {
            const seg = sponsorSegments[i];
            if (ct >= seg.start && ct < (seg.end - 0.15)) {
                inSegment = seg;
                break;
            }
        }

        if (inSegment) {
            const catName = getCategoryName(inSegment.category);
            if (ftConfig.sb_auto_skip !== false) {
                // Auto-skip mode
                removeSkipButton();
                trackedVideo.currentTime = inSegment.end;
                if (ftConfig.sb_show_toast !== false) {
                    showToast("Fast-Tube", "Skipped " + catName + " segment");
                }
            } else {
                // Manual Skip Button mode
                if (ftConfig.sb_show_skip_button !== false && activePromptSegment !== inSegment) {
                    activePromptSegment = inSegment;
                    showSkipButton(inSegment, catName);
                }
            }
        } else {
            if (activePromptSegment) {
                removeSkipButton();
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

    function hookActiveVideo() {
        if (typeof document === 'undefined') return;
        const video = document.querySelector('video');
        if (video) hookVideoElement(video);
        hookResolveCommand();
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('play', (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                hookVideoElement(e.target);
            }
        }, true);
    }

    // --- 8. CSS Rules & UI Styling Injection ---
    const injectStyles = () => {
        if (typeof document === 'undefined' || document.getElementById('fast-tube-styles')) return;
        const style = document.createElement('style');
        style.id = 'fast-tube-styles';
        style.textContent = `
ytd-ad-slot-renderer,ytd-promoted-sparkles-web-renderer,.ytd-display-ad-renderer,.ytp-ad-overlay-container,.ytp-ad-message-container,.ytp-ad-skip-button-container,.ytp-ad-preview-container,.ytp-ad-player-overlay,.ytp-ad-image-overlay,yt-mealbar-promo-renderer,ytd-statement-banner-renderer,.badge-style-type-ad,ytlr-ad-badge-renderer,ytlr-ad-renderer,ytlr-compact-promoted-item-renderer,ytlr-promoted-video-renderer,ytlr-statement-banner-renderer,ytlr-mealbar-promo-renderer,ytlr-premium-promo-renderer,.ytlr-ad-badge,[class*="ad-showing"] .ytp-ad-overlay-container,[class*="ad-interrupting"] .ytp-ad-overlay-container,[aria-label="Get YouTube Premium"],[aria-label*="YouTube Premium"],.ytp-paid-content-overlay{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;height:0 !important;width:0 !important;}

#fast-tube-skip-btn {
    position: fixed;
    bottom: 72px;
    right: 72px;
    z-index: 9999999;
    background: rgba(28, 28, 28, 0.95);
    color: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.7);
    border-radius: 32px;
    padding: 14px 28px;
    font-size: 18px;
    font-weight: 600;
    font-family: Roboto, sans-serif;
    cursor: pointer;
    box-shadow: 0 8px 32px rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

#fast-tube-skip-btn:focus, #fast-tube-skip-btn:hover {
    background: #ffffff;
    color: #000000;
    border-color: #ffffff;
    transform: scale(1.08);
    outline: none;
}

#fast-tube-toast {
    position: fixed;
    top: 48px;
    right: 48px;
    z-index: 9999999;
    background: rgba(24, 24, 24, 0.92);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    padding: 12px 24px;
    font-size: 16px;
    font-family: Roboto, sans-serif;
    pointer-events: none;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    opacity: 0;
    transition: opacity 0.3s ease;
}
`;
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
