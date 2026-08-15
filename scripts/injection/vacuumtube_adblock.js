// Fast-Tube Injection Script
// 1. Dual-layer Ad-Blocking & Video Playback Error Fix via isInlinePlaybackNoAd
// 2. Interactive Fast-Tube Leanback Settings Modal + Direct Settings Toggling with full D-Pad support
// 3. Return YouTube Dislikes (RYD) + DeArrow + Low Memory Mode + Sidebar Tabs Filtering + Per-Category SponsorBlock
// 4. Startup Account Picker / Who's Watching bypass

(function() {
    if (window.__fast_tube_injected__) return;
    window.__fast_tube_injected__ = true;

    // --- 0. Startup Screen / Who's Watching Bypass ---
    function bypassWhosWatching() {
        try {
            let recurring = localStorage.getItem('yt.leanback.default::recurring_actions');
            let data = recurring ? JSON.parse(recurring) : { data: { data: {} } };
            if (!data.data) data.data = {};
            if (!data.data.data) data.data.data = {};
            const futureTime = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days ahead
            data.data.data['startup-screen-account-selector-with-guest'] = { lastFired: futureTime };
            data.data.data['whos_watching_fullscreen_zero_accounts'] = { lastFired: futureTime };
            data.data.data['startup-screen-signed-out-welcome-back'] = { lastFired: futureTime };
            localStorage.setItem('yt.leanback.default::recurring_actions', JSON.stringify(data));
        } catch(e) {}
    }
    bypassWhosWatching();

    // --- 1. Config Management & Defaults ---
    const DEFAULT_CONFIG = {
        // General & Performance
        adblock: true,
        low_memory_mode: false,
        returnDislikes: true,
        dearrow: true,
        dearrow_thumbnails: true,
        hidePaidPromotion: true,
        sb_show_toast: true,

        // Sidebar Navigation
        hideShortsTab: false,
        hideGamingTab: false,
        hideMusicTab: false,
        hideNewsTab: false,
        hidePodcastsTab: false,
        hideMoviesTab: false,
        hideLiveTab: false,
        hideSportsTab: false,

        // SponsorBlock
        sponsorblock: true,
        sb_auto_sponsor: true,
        sb_auto_intro: true,
        sb_auto_outro: true,
        sb_auto_selfpromo: true,
        sb_auto_preview: false,
        sb_auto_music_offtopic: false,
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

    function toggleOption(key) {
        if (ftConfig[key] !== undefined) {
            ftConfig[key] = !ftConfig[key];
            saveConfig();
            if (key === 'low_memory_mode') {
                applyLowMemoryMode();
                if (ftConfig.low_memory_mode) clearAllCaches();
            }
            if (key.startsWith('sb_') || key === 'sponsorblock') {
                segmentCache.clear();
                currentVideoId = null;
                removeSkipButton();
            }
            updateDirectSettingsCategories();
            return ftConfig[key];
        }
        return false;
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

        const actions = r.transportControls?.transportControlsRenderer?.engagementActions;
        if (Array.isArray(actions)) {
            const likeAction = actions.find(a => a.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_LIKE_BUTTON');
            if (likeAction?.button?.likeButtonRenderer) {
                likeAction.button.likeButtonRenderer.dislikeCountText = { simpleText: formattedDislikes };
                likeAction.button.likeButtonRenderer.dislikeCountWithUndislikeText = { simpleText: formattedDislikes };
            }
        }

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

    // --- 7. YouTube TV Leanback Settings: Native Modal UI & Command Execution ---
    function callResolveCommand(cmd) {
        if (typeof window._yttv === 'object' && window._yttv) {
            for (let key in window._yttv) {
                if (window._yttv[key]?.instance?.resolveCommand) {
                    try {
                        window._yttv[key].instance.resolveCommand(cmd);
                        return true;
                    } catch(e) {}
                }
            }
        }
        return false;
    }

    function createModalButtonItem(title, subtitle, icon, secondaryIcon, commands) {
        const btn = {
            compactLinkRenderer: {
                title: { simpleText: title },
                serviceEndpoint: {
                    commandExecutorCommand: {
                        commands: commands
                    }
                }
            }
        };
        if (subtitle) {
            btn.compactLinkRenderer.subtitle = { simpleText: subtitle };
        }
        if (icon) {
            btn.compactLinkRenderer.icon = { iconType: icon };
        }
        if (secondaryIcon) {
            btn.compactLinkRenderer.secondaryIcon = { iconType: secondaryIcon };
        }
        return btn;
    }

    function showLeanbackModal(headerTitle, headerSubtitle, items, uniqueId, update, selectedIndex) {
        const modalCmd = {
            openPopupAction: {
                popupType: 'MODAL',
                popup: {
                    overlaySectionRenderer: {
                        overlay: {
                            overlayTwoPanelRenderer: {
                                actionPanel: {
                                    overlayPanelRenderer: {
                                        header: {
                                            overlayPanelHeaderRenderer: {
                                                title: { simpleText: headerTitle },
                                                subtitle: { simpleText: headerSubtitle || '' }
                                            }
                                        },
                                        content: {
                                            overlayPanelItemListRenderer: {
                                                items: items,
                                                selectedIndex: selectedIndex || 0
                                            }
                                        }
                                    }
                                },
                                backButton: {
                                    buttonRenderer: {
                                        accessibilityData: {
                                            accessibilityData: { label: 'Back' }
                                        },
                                        command: {
                                            signalAction: { signal: 'POPUP_BACK' }
                                        }
                                    }
                                }
                            }
                        },
                        dismissalCommand: {
                            signalAction: { signal: 'POPUP_BACK' }
                        }
                    }
                },
                uniqueId: uniqueId || 'fast-tube-settings-modal'
            }
        };

        if (update) {
            modalCmd.openPopupAction.shouldMatchUniqueId = true;
            modalCmd.openPopupAction.updateAction = true;
        }

        callResolveCommand(modalCmd);
    }

    // Modal Submenus Definition
    function openFastTubeSubmenu(submenuName, update, selectedIndex) {
        let title = "Fast-Tube Settings";
        let subtitle = "";
        let items = [];

        if (submenuName === 'general') {
            title = "General & Performance";
            subtitle = "Ad-block, memory optimization, dislikes & DeArrow";
            const toggles = [
                { key: 'adblock', title: 'Ad-Block', sub: 'Block all video ads, sponsored feed cards, and banners', icon: 'DOLLAR_SIGN' },
                { key: 'low_memory_mode', title: 'Low Memory Mode', sub: 'Optimize RAM usage and aggressively free video caches', icon: 'SETTINGS' },
                { key: 'returnDislikes', title: 'Return YouTube Dislikes', sub: 'Fetch and display public dislike counts on video player', icon: 'DISLIKE' },
                { key: 'dearrow', title: 'DeArrow Clean Titles', sub: 'Replace clickbait titles with community-submitted titles', icon: 'VISIBILITY_OFF' },
                { key: 'dearrow_thumbnails', title: 'DeArrow Clean Thumbnails', sub: 'Replace misleading thumbnails with clean video stills', icon: 'TV' },
                { key: 'hidePaidPromotion', title: 'Hide Paid Promo Badges', sub: 'Remove "Includes paid promotion" overlays from video player', icon: 'MONEY_HAND' },
                { key: 'sb_show_toast', title: 'Show Toast Notifications', sub: 'Display on-screen banner popup when skipping a segment', icon: 'FEED' }
            ];
            items = toggles.map((t, idx) => {
                const isEnabled = !!ftConfig[t.key];
                return createModalButtonItem(
                    t.title,
                    t.sub,
                    t.icon,
                    isEnabled ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK',
                    [{ customAction: { action: 'FT_TOGGLE', parameters: { key: t.key, submenu: 'general', index: idx } } }]
                );
            });
        } else if (submenuName === 'sidebar') {
            title = "Sidebar Navigation";
            subtitle = "Choose which tabs to display or hide on the sidebar";
            const toggles = [
                { key: 'hideShortsTab', title: 'Hide Shorts Tab', sub: 'Hide Shorts button from navigation sidebar', icon: 'YOUTUBE_SHORTS_FILL_24' },
                { key: 'hideGamingTab', title: 'Hide Gaming Tab', sub: 'Hide Gaming section from navigation sidebar', icon: 'GAMING' },
                { key: 'hideMusicTab', title: 'Hide Music Tab', sub: 'Hide YouTube Music from navigation sidebar', icon: 'YOUTUBE_MUSIC' },
                { key: 'hideNewsTab', title: 'Hide News Tab', sub: 'Hide News section from navigation sidebar', icon: 'NEWS' },
                { key: 'hidePodcastsTab', title: 'Hide Podcasts Tab', sub: 'Hide Podcasts section from navigation sidebar', icon: 'BROADCAST' },
                { key: 'hideMoviesTab', title: 'Hide Movies & TV Tab', sub: 'Hide Movies & TV from navigation sidebar', icon: 'CLAPPERBOARD' },
                { key: 'hideLiveTab', title: 'Hide Live Tab', sub: 'Hide Live Streams section from navigation sidebar', icon: 'LIVE' },
                { key: 'hideSportsTab', title: 'Hide Sports Tab', sub: 'Hide Sports section from navigation sidebar', icon: 'TROPHY' }
            ];
            items = toggles.map((t, idx) => {
                const isEnabled = !!ftConfig[t.key];
                return createModalButtonItem(
                    t.title,
                    t.sub,
                    t.icon,
                    isEnabled ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK',
                    [{ customAction: { action: 'FT_TOGGLE', parameters: { key: t.key, submenu: 'sidebar', index: idx } } }]
                );
            });
        } else if (submenuName === 'sponsorblock') {
            title = "SponsorBlock Settings";
            subtitle = "Configure automatic skipping and on-screen skip buttons";
            const toggles = [
                { key: 'sponsorblock', title: 'Enable SponsorBlock', sub: 'Master switch to enable SponsorBlock segment skipping', icon: 'MONEY_HAND' },
                { key: 'sb_auto_sponsor', title: 'Auto-Skip: Sponsors', sub: 'Automatically jump past paid sponsors and endorsements', icon: 'PLAY_CIRCLE' },
                { key: 'sb_auto_intro', title: 'Auto-Skip: Intros', sub: 'Automatically jump past intro animations and pause breaks', icon: 'PLAY_CIRCLE' },
                { key: 'sb_auto_outro', title: 'Auto-Skip: Outros', sub: 'Automatically jump past end credits and subscribe screens', icon: 'PLAY_CIRCLE' },
                { key: 'sb_auto_selfpromo', title: 'Auto-Skip: Self-Promotion', sub: 'Automatically jump past merch plugs and channel reminders', icon: 'PLAY_CIRCLE' },
                { key: 'sb_auto_preview', title: 'Auto-Skip: Previews', sub: 'Automatically jump past episode recaps and teaser clips', icon: 'PLAY_CIRCLE' },
                { key: 'sb_auto_music_offtopic', title: 'Auto-Skip: Non-Music', sub: 'Automatically jump past dialogue breaks in music videos', icon: 'PLAY_CIRCLE' },
                { key: 'sb_btn_sponsor', title: 'Skip Button: Sponsors', sub: 'Show on-screen button to skip sponsors manually with OK', icon: 'SKIP_NEXT' },
                { key: 'sb_btn_intro', title: 'Skip Button: Intros', sub: 'Show on-screen button to skip intros manually with OK', icon: 'SKIP_NEXT' },
                { key: 'sb_btn_outro', title: 'Skip Button: Outros', sub: 'Show on-screen button to skip outros manually with OK', icon: 'SKIP_NEXT' },
                { key: 'sb_btn_selfpromo', title: 'Skip Button: Self-Promotion', sub: 'Show on-screen button to skip self-promotion manually with OK', icon: 'SKIP_NEXT' },
                { key: 'sb_btn_preview', title: 'Skip Button: Previews', sub: 'Show on-screen button to skip previews manually with OK', icon: 'SKIP_NEXT' },
                { key: 'sb_btn_music_offtopic', title: 'Skip Button: Non-Music', sub: 'Show on-screen button to skip non-music manually with OK', icon: 'SKIP_NEXT' }
            ];
            items = toggles.map((t, idx) => {
                const isEnabled = !!ftConfig[t.key];
                return createModalButtonItem(
                    t.title,
                    t.sub,
                    t.icon,
                    isEnabled ? 'CHECK_BOX' : 'CHECK_BOX_OUTLINE_BLANK',
                    [{ customAction: { action: 'FT_TOGGLE', parameters: { key: t.key, submenu: 'sponsorblock', index: idx } } }]
                );
            });
        } else {
            // Main settings modal menu
            title = "Fast-Tube Settings";
            subtitle = "Customizable Ad-Block, SponsorBlock, RYD & DeArrow";
            items = [
                createModalButtonItem(
                    "General & Performance",
                    "Ad-Block, memory optimization, dislikes & DeArrow",
                    "SETTINGS",
                    "CHEVRON_RIGHT",
                    [{ customAction: { action: 'FT_SUBMENU_SHOW', parameters: 'general' } }]
                ),
                createModalButtonItem(
                    "Sidebar Navigation",
                    "Customize and hide navigation sidebar tabs",
                    "MENU",
                    "CHEVRON_RIGHT",
                    [{ customAction: { action: 'FT_SUBMENU_SHOW', parameters: 'sidebar' } }]
                ),
                createModalButtonItem(
                    "SponsorBlock",
                    "Configure auto-skip & skip button per category",
                    "MONEY_HAND",
                    "CHEVRON_RIGHT",
                    [{ customAction: { action: 'FT_SUBMENU_SHOW', parameters: 'sponsorblock' } }]
                )
            ];
        }

        showLeanbackModal(title, subtitle, items, 'fast-tube-' + submenuName, update, selectedIndex);
    }

    function openFastTubeSettingsModal() {
        openFastTubeSubmenu('main', false, 0);
    }

    // Direct Setting Boolean Renderer
    function createSettingBooleanRenderer(title, summary, configKey, enabled) {
        return {
            settingBooleanRenderer: {
                itemId: 'VOICE_AND_AUDIO_ACTIVITY',
                enabled: !!enabled,
                title: { runs: [{ text: title }] },
                summary: { runs: [{ text: summary }] },
                enableServiceEndpoint: {
                    setClientSettingEndpoint: {
                        settingDatas: [{ clientSettingEnum: { item: configKey }, boolValue: true }]
                    },
                    fastTubeOption: configKey,
                    fastTubeValue: true
                },
                disableServiceEndpoint: {
                    setClientSettingEndpoint: {
                        settingDatas: [{ clientSettingEnum: { item: configKey }, boolValue: false }]
                    },
                    fastTubeOption: configKey,
                    fastTubeValue: false
                }
            }
        };
    }

    function updateDirectSettingsCategories() {
        if (window.__ftSettingsCategories) {
            for (let cat of window.__ftSettingsCategories) {
                if (cat && cat.items) {
                    for (let it of cat.items) {
                        const opt = it?.settingBooleanRenderer?.enableServiceEndpoint?.fastTubeOption;
                        if (opt && ftConfig[opt] !== undefined) {
                            it.settingBooleanRenderer.enabled = !!ftConfig[opt];
                        }
                    }
                }
            }
        }
    }

    function PatchSettings(settingsObject) {
        if (!settingsObject || !Array.isArray(settingsObject.items)) return;
        
        for (let i = 0; i < settingsObject.items.length; i++) {
            const cat = settingsObject.items[i]?.settingCategoryCollectionRenderer;
            if (cat && (cat.categoryId === 'fast_tube_main_category' || cat.categoryId === 'fast_tube_general_category')) {
                return;
            }
        }

        // Fast-Tube Main Action Entry Point
        const ftMainActionEntry = {
            settingActionRenderer: {
                title: { runs: [{ text: "Fast-Tube Settings" }] },
                summary: { runs: [{ text: "Configure Ad-Block, SponsorBlock, Dislikes, DeArrow & Tabs" }] },
                actionLabel: { runs: [{ text: "Fast-Tube Settings" }] },
                itemId: "fast_tube_settings_action",
                serviceEndpoint: {
                    customAction: {
                        action: 'FT_SETTINGS_SHOW'
                    }
                },
                thumbnail: {
                    thumbnails: [{ url: "https://www.gstatic.com/ytlr/img/parent_code.png" }]
                }
            }
        };

        const ftMainCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_main_category",
                title: { runs: [{ text: "Fast-Tube" }] },
                items: [ftMainActionEntry],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftGeneralCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_general_category",
                title: { runs: [{ text: "Fast-Tube: General & Performance" }] },
                items: [
                    createSettingBooleanRenderer("Ad-Block", "Block all video ads, sponsored feed cards, and banners", "adblock", ftConfig.adblock),
                    createSettingBooleanRenderer("Low Memory Mode", "Optimize RAM usage and aggressively free video caches", "low_memory_mode", ftConfig.low_memory_mode),
                    createSettingBooleanRenderer("Return YouTube Dislikes", "Fetch and display public dislike counts on video player", "returnDislikes", ftConfig.returnDislikes),
                    createSettingBooleanRenderer("DeArrow Clean Titles", "Replace clickbait titles with community-submitted titles", "dearrow", ftConfig.dearrow),
                    createSettingBooleanRenderer("DeArrow Clean Thumbnails", "Replace misleading thumbnails with clean video stills", "dearrow_thumbnails", ftConfig.dearrow_thumbnails),
                    createSettingBooleanRenderer("Hide Paid Promo Badges", "Remove 'Includes paid promotion' overlays from video player", "hidePaidPromotion", ftConfig.hidePaidPromotion),
                    createSettingBooleanRenderer("Show Toast Notifications", "Display on-screen banner popup when skipping a segment", "sb_show_toast", ftConfig.sb_show_toast)
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
                    createSettingBooleanRenderer("Hide Shorts Tab", "Hide Shorts button from navigation sidebar", "hideShortsTab", ftConfig.hideShortsTab),
                    createSettingBooleanRenderer("Hide Gaming Tab", "Hide Gaming section from navigation sidebar", "hideGamingTab", ftConfig.hideGamingTab),
                    createSettingBooleanRenderer("Hide Music Tab", "Hide YouTube Music from navigation sidebar", "hideMusicTab", ftConfig.hideMusicTab),
                    createSettingBooleanRenderer("Hide News Tab", "Hide News section from navigation sidebar", "hideNewsTab", ftConfig.hideNewsTab),
                    createSettingBooleanRenderer("Hide Podcasts Tab", "Hide Podcasts section from navigation sidebar", "hidePodcastsTab", ftConfig.hidePodcastsTab),
                    createSettingBooleanRenderer("Hide Movies & TV Tab", "Hide Movies & TV from navigation sidebar", "hideMoviesTab", ftConfig.hideMoviesTab),
                    createSettingBooleanRenderer("Hide Live Tab", "Hide Live Streams section from navigation sidebar", "hideLiveTab", ftConfig.hideLiveTab),
                    createSettingBooleanRenderer("Hide Sports Tab", "Hide Sports section from navigation sidebar", "hideSportsTab", ftConfig.hideSportsTab)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        const ftSBCategory = {
            settingCategoryCollectionRenderer: {
                categoryId: "fast_tube_sb_category",
                title: { runs: [{ text: "Fast-Tube: SponsorBlock" }] },
                items: [
                    createSettingBooleanRenderer("Enable SponsorBlock", "Master switch to enable SponsorBlock segment skipping", "sponsorblock", ftConfig.sponsorblock),
                    createSettingBooleanRenderer("Auto-Skip: Sponsors", "Automatically jump past paid sponsors and endorsements", "sb_auto_sponsor", ftConfig.sb_auto_sponsor),
                    createSettingBooleanRenderer("Auto-Skip: Intros & Intermissions", "Automatically jump past intro animations and pause breaks", "sb_auto_intro", ftConfig.sb_auto_intro),
                    createSettingBooleanRenderer("Auto-Skip: Outros & End Cards", "Automatically jump past end credits and subscribe screens", "sb_auto_outro", ftConfig.sb_auto_outro),
                    createSettingBooleanRenderer("Auto-Skip: Self-Promotion", "Automatically jump past merch plugs and channel reminders", "sb_auto_selfpromo", ftConfig.sb_auto_selfpromo),
                    createSettingBooleanRenderer("Auto-Skip: Previews & Recaps", "Automatically jump past episode recaps and teaser clips", "sb_auto_preview", ftConfig.sb_auto_preview),
                    createSettingBooleanRenderer("Auto-Skip: Non-Music Sections", "Automatically jump past dialogue breaks in music videos", "sb_auto_music_offtopic", ftConfig.sb_auto_music_offtopic),
                    createSettingBooleanRenderer("Skip Button: Sponsors", "Show on-screen button to skip sponsors manually with OK", "sb_btn_sponsor", ftConfig.sb_btn_sponsor),
                    createSettingBooleanRenderer("Skip Button: Intros & Intermissions", "Show on-screen button to skip intros manually with OK", "sb_btn_intro", ftConfig.sb_btn_intro),
                    createSettingBooleanRenderer("Skip Button: Outros & End Cards", "Show on-screen button to skip outros manually with OK", "sb_btn_outro", ftConfig.sb_btn_outro),
                    createSettingBooleanRenderer("Skip Button: Self-Promotion", "Show on-screen button to skip self-promotion manually with OK", "sb_btn_selfpromo", ftConfig.sb_btn_selfpromo),
                    createSettingBooleanRenderer("Skip Button: Previews & Recaps", "Show on-screen button to skip previews manually with OK", "sb_btn_preview", ftConfig.sb_btn_preview),
                    createSettingBooleanRenderer("Skip Button: Non-Music Sections", "Show on-screen button to skip non-music manually with OK", "sb_btn_music_offtopic", ftConfig.sb_btn_music_offtopic)
                ],
                focused: false,
                trackingParams: "null"
            }
        };

        window.__ftSettingsCategories = [
            ftGeneralCategory.settingCategoryCollectionRenderer,
            ftSidebarCategory.settingCategoryCollectionRenderer,
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

        // Add Fast-Tube categories to top of settings
        settingsObject.items.unshift(ftSBCategory);
        settingsObject.items.unshift(ftSidebarCategory);
        settingsObject.items.unshift(ftGeneralCategory);
        settingsObject.items.unshift(ftMainCategory);
    }

    function handleCustomAction(action, params) {
        if (action === 'FT_SETTINGS_SHOW' || action === 'TT_SETTINGS_SHOW') {
            openFastTubeSettingsModal();
            return true;
        }
        if (action === 'FT_SUBMENU_SHOW') {
            openFastTubeSubmenu(params, false, 0);
            return true;
        }
        if (action === 'FT_TOGGLE') {
            if (params && params.key) {
                toggleOption(params.key);
                openFastTubeSubmenu(params.submenu, true, params.index || 0);
            }
            return true;
        }
        return false;
    }

    function hookResolveCommand() {
        if (typeof window._yttv !== 'object' || !window._yttv) return;
        for (let key in window._yttv) {
            const inst = window._yttv[key]?.instance;
            if (inst && typeof inst.resolveCommand === 'function' && !inst.__ft_rc_hooked) {
                inst.__ft_rc_hooked = true;
                const origRC = inst.resolveCommand;
                inst.resolveCommand = function(cmd, _) {
                    if (!cmd) return origRC.apply(this, arguments);

                    // 1. Handle fastTubeOption directly
                    if (cmd.fastTubeOption !== undefined) {
                        const opt = cmd.fastTubeOption;
                        const val = !!cmd.fastTubeValue;
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
                        updateDirectSettingsCategories();
                        return true;
                    }

                    // 2. Handle setClientSettingEndpoint
                    if (cmd.setClientSettingEndpoint && Array.isArray(cmd.setClientSettingEndpoint.settingDatas)) {
                        for (let s of cmd.setClientSettingEndpoint.settingDatas) {
                            const item = s?.clientSettingEnum?.item;
                            if (item && ftConfig[item] !== undefined) {
                                const val = s.boolValue !== undefined ? !!s.boolValue : (s.intValue !== undefined ? Number(s.intValue) : s.stringValue);
                                ftConfig[item] = val;
                                saveConfig();
                                if (item === 'low_memory_mode') {
                                    applyLowMemoryMode();
                                    if (val) clearAllCaches();
                                }
                                updateDirectSettingsCategories();
                            }
                        }
                    }

                    // 3. Handle customAction
                    if (cmd.customAction) {
                        if (handleCustomAction(cmd.customAction.action, cmd.customAction.parameters)) return true;
                    }
                    if (cmd.signalAction?.customAction) {
                        if (handleCustomAction(cmd.signalAction.customAction.action, cmd.signalAction.customAction.parameters)) return true;
                    }

                    // 4. Handle commandExecutorCommand
                    if (cmd.commandExecutorCommand && Array.isArray(cmd.commandExecutorCommand.commands)) {
                        for (let c of cmd.commandExecutorCommand.commands) {
                            if (c.customAction && handleCustomAction(c.customAction.action, c.customAction.parameters)) {
                                return true;
                            }
                            if (c.fastTubeOption !== undefined) {
                                ftConfig[c.fastTubeOption] = !!c.fastTubeValue;
                                saveConfig();
                                updateDirectSettingsCategories();
                            }
                        }
                    }

                    return origRC.apply(this, arguments);
                };
            }
        }
    }
    hookResolveCommand();
    setInterval(hookResolveCommand, 500);

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

    // --- 10. Playback Error Fix via isInlinePlaybackNoAd in JSON.stringify ---
    const origStringify = JSON.stringify;
    JSON.stringify = function (value, replacer, space) {
        if (value?.playbackContext?.contentPlaybackContext) {
            try {
                const copiedValue = JSON.parse(origStringify(value));
                if (!copiedValue.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd) {
                    copiedValue.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd = true;
                    return origStringify.call(this, copiedValue, replacer, space);
                }
            } catch(e) {}
        }
        return origStringify.call(this, value, replacer, space);
    };
    window.JSON.stringify = JSON.stringify;

    // --- 11. Core JSON.parse Hook (Ad-Stripping, Feeds & Settings) ---
    const origParse = JSON.parse;
    JSON.parse = function() {
        const r = origParse.apply(this, arguments);
        if (!r || typeof r !== 'object') return r;
        try {
            // A. Video ads removal (safely clear without breaking object types)
            if (ftConfig.adblock) {
                if (r.adPlacements) r.adPlacements = [];
                if (r.playerAds) r.playerAds = [];
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
                            if (shelf.adSlotRenderer || shelf.promoShelfRenderer || shelf.shelfRenderer?.tvhtml5Metadata?.hideLogo) return false;
                            if (ftConfig.hideShortsTab && JSON.stringify(shelf).indexOf('reelWatchEndpoint') !== -1) return false;
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

                // Continuation contents
                let contFeed = r.continuationContents?.sectionListContinuation?.contents;
                if (contFeed) {
                    for (let feed of contFeed) {
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

            // F. Patch Settings with Fast-Tube Categories & Modal Action
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
                window._yttv[key].JSON.stringify = JSON.stringify;
            }
        }
    }

    // --- 12. Network Level Ad Interception ---
    // Strictly block only ad statistics, tracking, and doubleclick endpoints without blocking playback/video chunks
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

    // --- 13. Event-Driven Video Hooking, Watchdog & Per-Category SponsorBlock ---
    let trackedVideo = null;
    function onTimeUpdate() {
        if (!trackedVideo) return;

        // Ad Watchdog: Auto-skip residual ad if in ad container
        if (ftConfig.adblock) {
            try {
                const isAdShowing = document.querySelector('.ad-showing, .ad-interrupting, [class*="ad-showing"], [class*="ad-interrupting"]');
                if (isAdShowing && trackedVideo.duration && isFinite(trackedVideo.duration) && trackedVideo.duration > 0) {
                    trackedVideo.currentTime = trackedVideo.duration;
                }
            } catch(e) {}
        }

        if (!ftConfig.sponsorblock || trackedVideo.paused || !sponsorSegments.length) {
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

    // --- 14. UI Styling Injection ---
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
