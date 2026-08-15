// Fast-Tube Injection Script
// Complete Return YouTube Dislikes (RYD), DeArrow, Low Memory Mode, Sidebar Toggles,
// SponsorBlock (Auto-Skip vs Manual Skip Button per category), and Leanback Settings for YouTube TV

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- 1. Config Management & Granular Settings ---
    const DEFAULT_CONFIG = {
        // General & Performance
        adblock: true,
        low_memory_mode: false,
        returnDislikes: true,
        dearrow: true,
        dearrow_thumbnails: true,
        hidePaidPromotion: true,
        sb_show_toast: true,

        // Sidebar Tabs
        hideShortsTab: false,
        hideGamingTab: false,
        hideMusicTab: false,
        hideNewsTab: false,
        hidePodcastsTab: false,
        hideMoviesTab: false,
        hideLiveTab: false,
        hideSportsTab: false,

        // SponsorBlock Master Switch
        sponsorblock: true,

        // Auto-Skip per category
        sb_auto_sponsor: true,
        sb_auto_intro: true,
        sb_auto_outro: true,
        sb_auto_selfpromo: true,
        sb_auto_preview: false,
        sb_auto_music_offtopic: false,

        // Manual Skip Button prompt per category
        sb_btn_sponsor: true,
        sb_btn_intro: true,
        sb_btn_outro: true,
        sb_btn_selfpromo: true,
        sb_btn_preview: true,
        sb_btn_music_offtopic: true
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

    // --- 2. Low Memory Mode Optimizations ---
    function applyLowMemoryMode() {
        if (!ftConfig.low_memory_mode) return;
        try {
            if (typeof window.environment === 'object' && window.environment) {
                if (!window.environment.feature_switches) window.environment.feature_switches = {};
                window.environment.feature_switches.enable_memory_saving_mode = true;
            }
            if (typeof window.ytcfg === 'object' && window.ytcfg?.set) {
                window.ytcfg.set({ 'WEB_ENABLE_MEMORY_SAVING_MODE': true });
            }
        } catch(e) {}
    }
    applyLowMemoryMode();

    function clearAllCaches() {
        segmentCache.clear();
        dislikeCache.clear();
        dearrowCache.clear();
    }

    // --- 3. Return YouTube Dislikes (RYD) ---
    const dislikeCache = new Map();
    async function fetchDislikes(videoId) {
        if (!videoId || typeof videoId !== 'string') return null;
        if (dislikeCache.has(videoId)) return dislikeCache.get(videoId);

        try {
            const res = await window.fetch('https://returnyoutubedislikeapi.com/votes?videoId=' + encodeURIComponent(videoId));
            if (res.ok) {
                const data = await res.json();
                dislikeCache.set(videoId, data);
                if (dislikeCache.size > (ftConfig.low_memory_mode ? 20 : 100)) {
                    dislikeCache.delete(dislikeCache.keys().next().value);
                }
                return data;
            }
        } catch(e) {}
        return null;
    }

    function formatCompactNumber(num) {
        if (typeof num !== 'number') return '';
        try {
            return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
        } catch(e) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return String(num);
        }
    }

    async function patchDislikesInResponse(r) {
        if (!ftConfig.returnDislikes || !r || typeof r !== 'object') return r;
        const videoId = r.currentVideoEndpoint?.watchEndpoint?.videoId;
        if (!videoId) return r;

        const votes = await fetchDislikes(videoId);
        if (!votes || votes.dislikes === undefined) return r;

        const formattedDislikes = formatCompactNumber(votes.dislikes);

        // Patch transport controls like/dislike buttons
        const actions = r.transportControls?.transportControlsRenderer?.engagementActions;
        if (Array.isArray(actions)) {
            const likeAction = actions.find(a => a.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_LIKE_BUTTON');
            if (likeAction?.button?.likeButtonRenderer) {
                likeAction.button.likeButtonRenderer.dislikeCountText = { simpleText: formattedDislikes };
                likeAction.button.likeButtonRenderer.dislikeCountWithUndislikeText = { simpleText: formattedDislikes };
            }
        }

        // Patch video description factoid
        const panel = r.engagementPanels?.find(p => p.engagementPanelSectionListRenderer?.panelIdentifier === 'video-description-ep-identifier');
        const header = panel?.engagementPanelSectionListRenderer?.content?.structuredDescriptionContentRenderer?.items?.[0]?.videoDescriptionHeaderRenderer;
        if (header) {
            if (!Array.isArray(header.factoid)) header.factoid = [];
            header.factoid.push({
                factoidRenderer: {
                    value: { simpleText: formattedDislikes },
                    label: { simpleText: "Dislikes" }
                }
            });
        }
        return r;
    }

    // --- 4. DeArrow (Clean Titles & Thumbnails) ---
    const dearrowCache = new Map();
    async function getDeArrowBranding(videoId) {
        if (!videoId || typeof videoId !== 'string') return null;
        if (dearrowCache.has(videoId)) return dearrowCache.get(videoId);

        try {
            const res = await window.fetch('https://sponsor.ajay.app/api/branding?videoID=' + encodeURIComponent(videoId));
            if (res.ok) {
                const data = await res.json();
                dearrowCache.set(videoId, data);
                if (dearrowCache.size > (ftConfig.low_memory_mode ? 20 : 100)) {
                    dearrowCache.delete(dearrowCache.keys().next().value);
                }
                return data;
            }
        } catch(e) {}
        return null;
    }

    function getDeArrowThumbnailUrl(videoId) {
        return 'https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=' + encodeURIComponent(videoId);
    }

    async function patchDeArrowInItem(item) {
        if (!item?.tileRenderer || item.tileRenderer.contentType !== 'TILE_CONTENT_TYPE_VIDEO') return;
        const videoId = item.tileRenderer.contentId;
        if (!videoId) return;

        try {
            if (ftConfig.dearrow) {
                const branding = await getDeArrowBranding(videoId);
                if (branding && Array.isArray(branding.titles)) {
                    const goodTitle = branding.titles.find(t => t.locked || t.votes >= 0);
                    if (goodTitle && goodTitle.title) {
                        let clean = goodTitle.title.split(' ').map(w => w.startsWith('>') ? w.slice(1) : w).join(' ');
                        if (item.tileRenderer.metadata?.tileMetadataRenderer?.title) {
                            item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText = clean;
                        }
                    }
                }
            }
            if (ftConfig.dearrow_thumbnails) {
                const thumbUrl = getDeArrowThumbnailUrl(videoId);
                if (item.tileRenderer.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]) {
                    item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails[0].url = thumbUrl;
                }
            }
        } catch(e) {}
    }

    // --- 5. Sidebar Navigation (Guide Tabs Filtering) ---
    const SIDEBAR_MAP = {
        'YOUTUBE_SHORTS_FILL_24': 'hideShortsTab',
        'GAMING': 'hideGamingTab',
        'YOUTUBE_MUSIC': 'hideMusicTab',
        'NEWS': 'hideNewsTab',
        'BROADCAST': 'hidePodcastsTab',
        'CLAPPERBOARD': 'hideMoviesTab',
        'LIVE': 'hideLiveTab',
        'TROPHY': 'hideSportsTab'
    };

    function filterSidebarGuide(r) {
        if (!r || typeof r !== 'object') return;
        if (r.items && Array.isArray(r.items)) {
            for (let section of r.items) {
                if (section.guideSectionRenderer && Array.isArray(section.guideSectionRenderer.items)) {
                    section.guideSectionRenderer.items = section.guideSectionRenderer.items.filter(entry => {
                        const iconType = entry.guideEntryRenderer?.icon?.iconType;
                        const configKey = SIDEBAR_MAP[iconType];
                        if (configKey && ftConfig[configKey]) return false;
                        return true;
                    });
                }
            }
        }
    }

    // --- 6. SponsorBlock Logic & Categories ---
    function getActiveSBCategories() {
        const cats = [];
        if (ftConfig.sb_auto_sponsor || ftConfig.sb_btn_sponsor) cats.push('sponsor');
        if (ftConfig.sb_auto_intro || ftConfig.sb_btn_intro) { cats.push('intro'); cats.push('intermission'); }
        if (ftConfig.sb_auto_outro || ftConfig.sb_btn_outro) cats.push('outro');
        if (ftConfig.sb_auto_selfpromo || ftConfig.sb_btn_selfpromo) cats.push('selfpromo');
        if (ftConfig.sb_auto_preview || ftConfig.sb_btn_preview) { cats.push('preview'); cats.push('filler'); }
        if (ftConfig.sb_auto_music_offtopic || ftConfig.sb_btn_music_offtopic) cats.push('music_offtopic');
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

    function getCategoryAction(category) {
        let autoKey = null;
        let btnKey = null;
        switch (category) {
            case 'sponsor': autoKey = 'sb_auto_sponsor'; btnKey = 'sb_btn_sponsor'; break;
            case 'intro': case 'intermission': autoKey = 'sb_auto_intro'; btnKey = 'sb_btn_intro'; break;
            case 'outro': autoKey = 'sb_auto_outro'; btnKey = 'sb_btn_outro'; break;
            case 'selfpromo': autoKey = 'sb_auto_selfpromo'; btnKey = 'sb_btn_selfpromo'; break;
            case 'preview': case 'filler': autoKey = 'sb_auto_preview'; btnKey = 'sb_btn_preview'; break;
            case 'music_offtopic': autoKey = 'sb_auto_music_offtopic'; btnKey = 'sb_btn_music_offtopic'; break;
        }
        if (autoKey && ftConfig[autoKey]) return 'auto';
        if (btnKey && ftConfig[btnKey]) return 'button';
        return 'none';
    }

    // --- 7. Interactive Leanback Settings UI ---
    function createSettingBooleanRenderer(title, summary, configKey, enabled) {
        return {
            settingBooleanRenderer: {
                itemId: configKey,
                enabled: !!enabled,
                title: { runs: [{ text: title }] },
                summary: { runs: [{ text: summary }] },
                enableServiceEndpoint: { fastTubeOption: configKey, fastTubeValue: true },
                disableServiceEndpoint: { fastTubeOption: configKey, fastTubeValue: false }
            }
        };
    }

    function PatchSettings(settingsObject) {
        if (!settingsObject || !Array.isArray(settingsObject.items)) return;
        
        for (let i = 0; i < settingsObject.items.length; i++) {
            const cat = settingsObject.items[i]?.settingCategoryCollectionRenderer;
            if (cat && (cat.categoryId === 'fast_tube_general_category' || cat.categoryId === 'fast_tube_sidebar_category' || cat.categoryId === 'fast_tube_sb_auto_category' || cat.categoryId === 'fast_tube_sb_btn_category')) {
                return;
            }
        }

        const ftGeneralCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_general_category",
                title: { runs: [{ text: "Fast-Tube: General & Performance" }] },
                items: [
                    createSettingBooleanRenderer("Ad-Block", "Block video ads, banners, and promoted feed items", "adblock", ftConfig.adblock),
                    createSettingBooleanRenderer("Low Memory Mode", "Enable memory saving mode and reduce cache retention", "low_memory_mode", ftConfig.low_memory_mode),
                    createSettingBooleanRenderer("Return YouTube Dislikes", "Fetch and display true dislike counts on videos", "returnDislikes", ftConfig.returnDislikes),
                    createSettingBooleanRenderer("DeArrow Clean Titles", "Replace clickbait titles with community-submitted titles", "dearrow", ftConfig.dearrow),
                    createSettingBooleanRenderer("DeArrow Clean Thumbnails", "Replace clickbait thumbnails with clean video frames", "dearrow_thumbnails", ftConfig.dearrow_thumbnails),
                    createSettingBooleanRenderer("Hide Paid Promo Badges", "Hide 'Includes paid promotion' overlays on videos", "hidePaidPromotion", ftConfig.hidePaidPromotion),
                    createSettingBooleanRenderer("Show Toast Notifications", "Show on-screen notification when a segment is skipped", "sb_show_toast", ftConfig.sb_show_toast)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftSidebarCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_sidebar_category",
                title: { runs: [{ text: "Fast-Tube: Sidebar Navigation" }] },
                items: [
                    createSettingBooleanRenderer("Hide Shorts Tab", "Hide Shorts button from sidebar navigation", "hideShortsTab", ftConfig.hideShortsTab),
                    createSettingBooleanRenderer("Hide Gaming Tab", "Hide Gaming button from sidebar navigation", "hideGamingTab", ftConfig.hideGamingTab),
                    createSettingBooleanRenderer("Hide Music Tab", "Hide YouTube Music button from sidebar navigation", "hideMusicTab", ftConfig.hideMusicTab),
                    createSettingBooleanRenderer("Hide News Tab", "Hide News button from sidebar navigation", "hideNewsTab", ftConfig.hideNewsTab),
                    createSettingBooleanRenderer("Hide Podcasts Tab", "Hide Podcasts button from sidebar navigation", "hidePodcastsTab", ftConfig.hidePodcastsTab),
                    createSettingBooleanRenderer("Hide Movies & TV Tab", "Hide Movies & TV button from sidebar navigation", "hideMoviesTab", ftConfig.hideMoviesTab),
                    createSettingBooleanRenderer("Hide Live Tab", "Hide Live Streams button from sidebar navigation", "hideLiveTab", ftConfig.hideLiveTab),
                    createSettingBooleanRenderer("Hide Sports Tab", "Hide Sports button from sidebar navigation", "hideSportsTab", ftConfig.hideSportsTab)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftSBAutoCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_sb_auto_category",
                title: { runs: [{ text: "Fast-Tube: SponsorBlock (Auto-Skip)" }] },
                items: [
                    createSettingBooleanRenderer("Enable SponsorBlock", "Master switch for SponsorBlock capabilities", "sponsorblock", ftConfig.sponsorblock),
                    createSettingBooleanRenderer("Auto-Skip: Sponsors", "Automatically skip paid promotions and endorsements", "sb_auto_sponsor", ftConfig.sb_auto_sponsor),
                    createSettingBooleanRenderer("Auto-Skip: Intros & Intermissions", "Automatically skip channel intros and animation pauses", "sb_auto_intro", ftConfig.sb_auto_intro),
                    createSettingBooleanRenderer("Auto-Skip: Outros & End Cards", "Automatically skip end credits and outro screens", "sb_auto_outro", ftConfig.sb_auto_outro),
                    createSettingBooleanRenderer("Auto-Skip: Self-Promotion", "Automatically skip merch plugs and channel reminders", "sb_auto_selfpromo", ftConfig.sb_auto_selfpromo),
                    createSettingBooleanRenderer("Auto-Skip: Previews & Recaps", "Automatically skip episode recaps and teaser clips", "sb_auto_preview", ftConfig.sb_auto_preview),
                    createSettingBooleanRenderer("Auto-Skip: Non-Music Sections", "Automatically skip dialogue breaks and music video intros", "sb_auto_music_offtopic", ftConfig.sb_auto_music_offtopic)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftSBBtnCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_sb_btn_category",
                title: { runs: [{ text: "Fast-Tube: SponsorBlock (Skip Button)" }] },
                items: [
                    createSettingBooleanRenderer("Skip Button: Sponsors", "Show on-screen button to skip sponsors manually", "sb_btn_sponsor", ftConfig.sb_btn_sponsor),
                    createSettingBooleanRenderer("Skip Button: Intros & Intermissions", "Show on-screen button to skip intros manually", "sb_btn_intro", ftConfig.sb_btn_intro),
                    createSettingBooleanRenderer("Skip Button: Outros & End Cards", "Show on-screen button to skip outros manually", "sb_btn_outro", ftConfig.sb_btn_outro),
                    createSettingBooleanRenderer("Skip Button: Self-Promotion", "Show on-screen button to skip self-promotion manually", "sb_btn_selfpromo", ftConfig.sb_btn_selfpromo),
                    createSettingBooleanRenderer("Skip Button: Previews & Recaps", "Show on-screen button to skip previews manually", "sb_btn_preview", ftConfig.sb_btn_preview),
                    createSettingBooleanRenderer("Skip Button: Non-Music Sections", "Show on-screen button to skip non-music manually", "sb_btn_music_offtopic", ftConfig.sb_btn_music_offtopic)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        window.__ftSettingsCategories = [
            ftGeneralCategory.settingCategoryCollectionRenderer,
            ftSidebarCategory.settingCategoryCollectionRenderer,
            ftSBAutoCategory.settingCategoryCollectionRenderer,
            ftSBBtnCategory.settingCategoryCollectionRenderer
        ];

        // Filter out "Get YouTube Premium" and promo categories from settings
        for (let i = settingsObject.items.length - 1; i >= 0; i--) {
            const item = settingsObject.items[i];
            const str = JSON.stringify(item);
            if (str && (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                settingsObject.items.splice(i, 1);
            }
        }

        // Add Fast-Tube categories to top of settings
        settingsObject.items.unshift(ftSBBtnCategory);
        settingsObject.items.unshift(ftSBAutoCategory);
        settingsObject.items.unshift(ftSidebarCategory);
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

                        if (opt === 'low_memory_mode') {
                            applyLowMemoryMode();
                            if (val) clearAllCaches();
                        }

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

    // --- 8. SponsorBlock UI: Toast & On-Screen Skip Button ---
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

    // --- 9. SponsorBlock Fetcher ---
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
                        if (segmentCache.size > (ftConfig.low_memory_mode ? 20 : 100)) {
                            segmentCache.delete(segmentCache.keys().next().value);
                        }
                    } else {
                        sponsorSegments = [];
                    }
                })
                .catch(() => { sponsorSegments = []; });
        }
    }

    // --- 10. Core JSON.parse Hook (Pure Performance Ad-Block + RYD + DeArrow + Settings + Sidebar) ---
    const origParse = JSON.parse;
    JSON.parse = function() {
        const r = origParse.apply(this, arguments);
        if (!r || typeof r !== 'object') return r;
        try {
            // A. Video ads removal (Instant memory zeroing)
            if (ftConfig.adblock) {
                if (r.adPlacements) r.adPlacements = [];
                if (r.playerAds) r.playerAds = false;
                if (r.adSlots) r.adSlots = [];
            }

            if (ftConfig.hidePaidPromotion && r.paidContentOverlay) {
                r.paidContentOverlay = null;
            }

            // B. Extract videoId for SponsorBlock
            if (r.videoDetails && r.videoDetails.videoId) {
                checkSponsorBlock(r.videoDetails.videoId);
                hookActiveVideo();
            }

            // C. Return YouTube Dislikes (RYD)
            if (ftConfig.returnDislikes && r.currentVideoEndpoint?.watchEndpoint?.videoId) {
                patchDislikesInResponse(r);
            }

            // D. Sidebar Guide Tabs Filtering
            filterSidebarGuide(r);

            // E. Home & Search feed filtering + DeArrow
            if (ftConfig.adblock || ftConfig.dearrow || ftConfig.dearrow_thumbnails) {
                let homeFeed = r.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer;
                if (homeFeed && homeFeed.contents) {
                    if (ftConfig.adblock) {
                        homeFeed.contents = homeFeed.contents.filter(shelf => {
                            if (shelf.adSlotRenderer || shelf.promoShelfRenderer || shelf.shelfRenderer?.tvhtml5Metadata?.hideLogo) {
                                return false;
                            }
                            if (ftConfig.hideShortsTab && JSON.stringify(shelf).indexOf('reelWatchEndpoint') !== -1) {
                                return false;
                            }
                            return true;
                        });
                    }
                    for (let feed of homeFeed.contents) {
                        let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                        if (horizontal && horizontal.items) {
                            if (ftConfig.adblock) {
                                horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer && !i.compactPromotedItemRenderer);
                            }
                            if (ftConfig.dearrow || ftConfig.dearrow_thumbnails) {
                                for (let it of horizontal.items) patchDeArrowInItem(it);
                            }
                        }
                    }
                }

                // Search feed
                let searchFeed = r.contents?.sectionListRenderer;
                if (searchFeed && searchFeed.contents) {
                    for (let feed of searchFeed.contents) {
                        let horizontal = feed?.shelfRenderer?.content?.horizontalListRenderer;
                        if (horizontal && horizontal.items) {
                            if (ftConfig.adblock) {
                                horizontal.items = horizontal.items.filter(i => !i.adSlotRenderer && !i.compactPromotedItemRenderer);
                            }
                            if (ftConfig.dearrow || ftConfig.dearrow_thumbnails) {
                                for (let it of horizontal.items) patchDeArrowInItem(it);
                            }
                        }
                    }
                }

                // Shorts ads removal
                if (ftConfig.adblock && !Array.isArray(r) && r.entries && Array.isArray(r.entries)) {
                    r.entries = r.entries.filter(elm => !elm?.command?.reelWatchEndpoint?.adClientParams?.isAd);
                }

                // Remove "Get YouTube Premium" from guide items
                if (ftConfig.adblock && r.items && Array.isArray(r.items)) {
                    for (let i = r.items.length - 1; i >= 0; i--) {
                        const item = r.items[i];
                        const str = JSON.stringify(item);
                        if (str && (str.indexOf('SPunlimited') !== -1 || str.indexOf('Get YouTube Premium') !== -1 || str.indexOf('ypc_get_offline_upsell') !== -1)) {
                            r.items.splice(i, 1);
                        }
                    }
                }
            }

            // F. Patch Settings with Fast-Tube categories
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

    // --- 11. Network Level Ad Interception ---
    const AD_URL_REGEX = /\/api\/stats\/ads|\/ptracking|\/pagead\/|doubleclick\.net|adservice\.google\.com/;
    function isAdUrl(url) {
        return typeof url === 'string' && AD_URL_REGEX.test(url);
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

    // --- 12. Event-Driven Video Hooking & Per-Category SponsorBlock ---
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
            const action = getCategoryAction(inSegment.category);

            if (action === 'auto') {
                removeSkipButton();
                trackedVideo.currentTime = inSegment.end;
                if (ftConfig.sb_show_toast !== false) {
                    showToast("Fast-Tube", "Skipped " + catName + " segment");
                }
            } else if (action === 'button') {
                if (activePromptSegment !== inSegment) {
                    activePromptSegment = inSegment;
                    showSkipButton(inSegment, catName);
                }
            } else {
                removeSkipButton();
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

    // --- 13. UI Styling Injection ---
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
