// Custom UI for video player

import { extractAssignedFunctions } from "../utils/ASTParser.js";
import { configRead } from "../config.js";
import { ButtonRenderer } from "./ytUI.js";
import { t } from "i18next";

// PERF: the AST extraction below used to run inside the constructor on EVERY
// instantiation of the player actions container (i.e. on every navigation to
// the player), stringifying + fully parsing a huge minified class each time.
// On low-end TVs that is a recurring multi-hundred-ms CPU spike. Everything
// derived from origMethod is static, so compute it exactly once and cache it.
let cachedOrigMethod = null;
let cachedIsClass = false;
let cachedFunctions = null;
let cachedSettingActionGroup = null;
let cachedPreviousButtonName = null;
let cachedNextButtonName = null;
let cachedEngagementActionButton = null;
let cachedPromotedActionButton = null;

// PERF: cap boot polling, incrementally scan window._yttv keys without
// repeatedly stringifying thousands of bundle functions, and recover on
// route transitions to watch.
const APPLY_PATCH_MAX_ATTEMPTS = 60;
let applyPatchAttempts = 0;
let applyPatchTimeout = null;
let isPlayerPatched = false;
const checkedYttvKeys = new Set();
let targetKey = null;

function applyPatches() {
    if (isPlayerPatched) return;
    // Nothing to do at all when player patching is disabled - don't poll.
    if (!configRead('enablePatchingVideoPlayer')) return;

    if (!window._yttv) {
        if (++applyPatchAttempts < APPLY_PATCH_MAX_ATTEMPTS) {
            clearTimeout(applyPatchTimeout);
            applyPatchTimeout = setTimeout(applyPatches, 500);
        }
        return;
    }

    if (!targetKey) {
        for (const key in window._yttv) {
            if (checkedYttvKeys.has(key)) continue;
            checkedYttvKeys.add(key);
            if (typeof window._yttv[key] !== 'function') continue;
            const src = window._yttv[key].toString();
            if (src.includes('TRANSPORT_CONTROLS_BUTTON_TYPE_FEATURED_ACTION') || src.includes('TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS')) {
                targetKey = key;
                break;
            }
        }
    }

    if (!targetKey) {
        if (++applyPatchAttempts < APPLY_PATCH_MAX_ATTEMPTS) {
            clearTimeout(applyPatchTimeout);
            applyPatchTimeout = setTimeout(applyPatches, 500);
        }
        return;
    }

    const origMethod = window._yttv[targetKey];

    function YtlrPlayerActionsContainer() {
        const args = Array.prototype.slice.call(arguments);

        // PERF: computed once per origMethod (see cache above) instead of on
        // every single instantiation. Must run before the instanceof branch.
        if (origMethod !== cachedOrigMethod || !cachedFunctions) {
            cachedOrigMethod = origMethod;
            const src = origMethod.toString();
            cachedIsClass = /^class\s/.test(src);
            cachedFunctions = extractAssignedFunctions(src);

            const funcs = cachedFunctions;
            cachedSettingActionGroup = funcs.find(func =>
                func.rhs.includes('TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS')
            )?.left?.split('.')[1];

            const prevFunc = funcs.find(func => {
                if (func.rhs.includes('skipNextButton')) {
                    const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
                    const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
                    if (skipPreviousButtonIndex > skipNextButtonIndex) return true;
                }
            });
            cachedPreviousButtonName = prevFunc?.left?.split('.')[1];

            const nextFunc = funcs.find(func => {
                if (func.rhs.includes('skipPreviousButton')) {
                    const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
                    const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
                    if (skipNextButtonIndex > skipPreviousButtonIndex) return true;
                }
            });
            cachedNextButtonName = nextFunc?.left?.split('.')[1];

            cachedEngagementActionButton = funcs.find(func =>
                func.rhs.includes('props.data.engagementActions')
            )?.left?.split('.')[1];

            cachedPromotedActionButton = funcs.find(func =>
                func.rhs.includes('props.data.promotedActions') && func.rhs.includes('setReminderButton')
            )?.left?.split('.')[1];
        }
        const isClass = cachedIsClass;

        function constructAsNew(ctor, argsList) {
            if (typeof Reflect !== 'undefined' && typeof Reflect.construct === 'function') {
                return Reflect.construct(ctor, argsList, YtlrPlayerActionsContainer);
            }
            return new origMethod(...argsList);
        }

        if (!(this instanceof YtlrPlayerActionsContainer)) {
            if (isClass) return constructAsNew(origMethod, args);
            return origMethod.apply(this, args);
        }

        let inst;
        if (isClass) {
            inst = constructAsNew(origMethod, args);
        } else {
            origMethod.apply(this, args);
            inst = this;
        }

        const pipCommand = {
            "type": "TRANSPORT_CONTROLS_BUTTON_TYPE_PIP",
            "button": {
                "buttonRenderer": ButtonRenderer(
                    false,
                    configRead('enableSwapMPWithPIP') ? (t('player.pictureInPicture') || 'Picture in Picture') : (t('player.miniPlayer') || 'Mini Player'),
                    'CLEAR_COOKIES',
                    {
                        customAction: {
                            action: configRead('enableSwapMPWithPIP') ? 'ENTER_PIP' : 'ENTER_MP',
                        }
                    }
                )
            }
        }

        const settingActionGroup = cachedSettingActionGroup;

        if (settingActionGroup && configRead('enableMPButton')) {
            const origSettingActionGroup = inst[settingActionGroup];
            inst[settingActionGroup] = function () {
                const res = origSettingActionGroup.apply(this, arguments);
                const idx = res.findIndex(item => item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS');
                res.find(item => item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PIP') || res.splice(idx, 0, pipCommand);
                return res;
            };
        }

        const previousButtonName = cachedPreviousButtonName;
        const nextButtonName = cachedNextButtonName;
        const engagementActionButton = cachedEngagementActionButton;
        const promotedActionButton = cachedPromotedActionButton;

        if (promotedActionButton) {
            const origPromotedActionButton = inst[promotedActionButton];
            inst[promotedActionButton] = function () {
                const res = origPromotedActionButton.apply(this, arguments);
                if (!Array.isArray(res)) return res;

                // NOTE: do NOT use TRANSPORT_CONTROLS_BUTTON_TYPE_FEATURED_ACTION here.
                // The promoted actions builder special-cases that type and silently drops
                // items whose button has no `featuredAction` payload.
                const ownType = 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT';

                let highlightTime = null;
                if (configRead('enableSponsorBlockHighlight') && window?.sponsorblock?.segments) {
                    const category = window.sponsorblock.segments.find(seg => seg.category === 'poi_highlight');
                    if (category) highlightTime = category.segment[0];
                }

                const existingIdx = res.findIndex(item => item.type === ownType || item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_FEATURED_ACTION');

                if (highlightTime === null) {
                    // Segments not loaded (yet) or feature disabled: drop any stale button
                    if (existingIdx !== -1) res.splice(existingIdx, 1);
                    return res;
                }

                if (existingIdx !== -1) return res;

                const highlightButton = {
                    type: ownType,
                    button: {
                        buttonRenderer: ButtonRenderer(
                            false,
                            t('sponsorblock.toasts.skipToHighlight') || "Skip to highlight",
                            'SKIP_NEXT',
                            {
                                clickTrackingParams: null,
                                customAction: {
                                    action: 'SKIP',
                                    parameters: {
                                        time: highlightTime
                                    }
                                }
                            }
                        )
                    }
                };

                // Insert directly after the Subscribe button so the two stay adjacent
                // regardless of how many promoted actions YouTube adds.
                const subscribeIdx = res.findIndex(item => item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_SUBSCRIBE');
                if (subscribeIdx === -1) {
                    res.push(highlightButton);
                } else {
                    res.splice(subscribeIdx + 1, 0, highlightButton);
                }
                return res;
            };
        }

        if (engagementActionButton) {
            const origEngagementActionButton = inst[engagementActionButton];
            inst[engagementActionButton] = function () {
                let res = origEngagementActionButton.apply(this, arguments);
                if (configRead('enableSpeedControlsButton')) {
                    if (!res.find(item => item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED')) {
                        res.push({
                            type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED',
                            button: {
                                buttonRenderer: ButtonRenderer(
                                    false,
                                    t('player.playbackSpeed.button') || "Speed Controls",
                                    'SLOW_MOTION_VIDEO',
                                    {
                                        customAction: {
                                            action: 'TT_SPEED_SETTINGS_SHOW',
                                        }
                                    }
                                )
                            }
                        });
                    }
                }
                if (!configRead('enableSuperThanksButton')) {
                    res = res.filter(item => item.type !== 'TRANSPORT_CONTROLS_BUTTON_TYPE_SUPER_THANKS' && item.type !== 'TRANSPORT_CONTROLS_BUTTON_TYPE_SHOPPING');
                }
                if (!configRead('enableAIAskButton')) {
                    res = res.filter(item => item.type !== 'TRANSPORT_CONTROLS_BUTTON_TYPE_YOUCHAT_BUTTON');
                }
                return res;
            };
        }

        if (configRead('enablePreviousNextButtons')) {
            if (!previousButtonName || !nextButtonName) return inst;
            inst[previousButtonName] = function () {
                return ButtonRenderer(
                    false,
                    'Previous',
                    'SKIP_PREVIOUS',
                    {
                        signalAction: {
                            signal: 'PLAYER_PLAY_PREVIOUS'
                        }
                    }
                )
            }

            inst[nextButtonName] = function () {
                return ButtonRenderer(
                    false,
                    'Next',
                    'SKIP_NEXT',
                    {
                        signalAction: {
                            signal: 'PLAYER_PLAY_NEXT'
                        }
                    }
                )
            }

        }

        return inst;
    }

    if (configRead('enablePatchingVideoPlayer')) {
        YtlrPlayerActionsContainer.prototype = origMethod.prototype;
        window._yttv[targetKey] = YtlrPlayerActionsContainer;
        isPlayerPatched = true;
    }
}

applyPatches();

window.addEventListener('hashchange', () => {
    if (!isPlayerPatched && location.hash.includes('watch')) {
        applyPatchAttempts = 0;
        applyPatches();
    }
});