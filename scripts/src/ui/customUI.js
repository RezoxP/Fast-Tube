import { extractAssignedFunctions } from "../utils/ASTParser.js";
import { configRead } from "../config.js";
import { ButtonRenderer } from "./ytUI.js";
import { t } from "i18next";

let cachedMethodNames = null;

function getMethodNames(origMethod) {
    if (cachedMethodNames) return cachedMethodNames;

    const functions = extractAssignedFunctions(origMethod.toString());

    const settingActionItem = functions.find(func => {
        return func.rhs && func.rhs.includes('TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS');
    });
    const settingActionGroup = settingActionItem?.left ? settingActionItem.left.split('.')[1] : null;

    const previousButtonItem = functions.find(func => {
        if (func.rhs && func.rhs.includes('skipNextButton')) {
            const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
            const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
            return skipPreviousButtonIndex > skipNextButtonIndex;
        }
        return false;
    });
    const previousButtonName = previousButtonItem?.left ? previousButtonItem.left.split('.')[1] : null;

    const nextButtonItem = functions.find(func => {
        if (func.rhs && func.rhs.includes('skipPreviousButton')) {
            const skipNextButtonIndex = func.rhs.indexOf('skipNextButton');
            const skipPreviousButtonIndex = func.rhs.indexOf('skipPreviousButton');
            return skipNextButtonIndex > skipPreviousButtonIndex;
        }
        return false;
    });
    const nextButtonName = nextButtonItem?.left ? nextButtonItem.left.split('.')[1] : null;

    const engagementActionItem = functions.find(func => func.rhs && func.rhs.includes('props.data.engagementActions'));
    const engagementActionButton = engagementActionItem?.left ? engagementActionItem.left.split('.')[1] : null;

    cachedMethodNames = {
        settingActionGroup,
        previousButtonName,
        nextButtonName,
        engagementActionButton
    };

    return cachedMethodNames;
}

function applyPatches() {
    if (!window._yttv) return setTimeout(applyPatches, 250);
    if (!document.querySelector('video')) return setTimeout(applyPatches, 250);

    const methods = Object.keys(window._yttv).filter(key => {
        return typeof window._yttv[key] === 'function' && window._yttv[key].toString().includes('TRANSPORT_CONTROLS_BUTTON_TYPE_FEATURED_ACTION');
    });

    if (methods.length === 0) {
        setTimeout(applyPatches, 250);
        return;
    }

    if (window._yttv[methods[0]]?.isPatchedByCustomUI) return;

    const origMethod = window._yttv[methods[0]];
    const isClass = /^class\s/.test(origMethod.toString());
    const methodNames = getMethodNames(origMethod);

    function YtlrPlayerActionsContainer() {
        const args = Array.prototype.slice.call(arguments);

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

        const { settingActionGroup, previousButtonName, nextButtonName, engagementActionButton } = methodNames;

        if (settingActionGroup && configRead('enableMPButton')) {
            const origSettingActionGroup = inst[settingActionGroup];
            const pipCommand = {
                type: "TRANSPORT_CONTROLS_BUTTON_TYPE_PIP",
                button: {
                    buttonRenderer: ButtonRenderer(
                        false,
                        configRead('enableSwapMPWithPIP') ? 'Picture in Picture' : 'Mini Player',
                        'CLEAR_COOKIES',
                        {
                            customAction: {
                                action: configRead('enableSwapMPWithPIP') ? 'ENTER_PIP' : 'ENTER_MP',
                            }
                        }
                    )
                }
            };

            inst[settingActionGroup] = function () {
                const res = origSettingActionGroup.apply(this, arguments);
                if (!Array.isArray(res)) return res;

                // Deduplicate: filter out any existing PIP/Mini Player button to guarantee single entry
                const filtered = res.filter(item => {
                    if (!item) return false;
                    if (item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PIP') return false;
                    const txt = item.button?.buttonRenderer?.text?.runs?.[0]?.text 
                             || item.buttonRenderer?.text?.runs?.[0]?.text 
                             || item.text?.runs?.[0]?.text;
                    if (txt === 'Mini Player' || txt === 'Picture in Picture') return false;
                    const act = item.button?.buttonRenderer?.command?.customAction?.action
                             || item.buttonRenderer?.command?.customAction?.action;
                    if (act === 'ENTER_MP' || act === 'ENTER_PIP') return false;
                    return true;
                });

                const idx = filtered.findIndex(item => item && item.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_PLAYBACK_SETTINGS');
                if (idx !== -1) {
                    filtered.splice(idx, 0, pipCommand);
                } else {
                    filtered.push(pipCommand);
                }
                return filtered;
            };
        }

        if (engagementActionButton) {
            const origEngagementActionButton = inst[engagementActionButton];
            const enableSpeed = configRead('enableSpeedControlsButton');
            const enableSuperThanks = configRead('enableSuperThanksButton');
            const enableAIAsk = configRead('enableAIAskButton');
            const enableHighlight = configRead('enableSponsorBlockHighlight');

            const speedButtonObj = {
                type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED',
                button: {
                    buttonRenderer: ButtonRenderer(
                        false,
                        "Speed Controls",
                        'SLOW_MOTION_VIDEO',
                        {
                            customAction: {
                                action: 'TT_SPEED_SETTINGS_SHOW',
                            }
                        }
                    )
                }
            };

            const blockedTypes = new Set();
            if (!enableSuperThanks) {
                blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SUPER_THANKS');
                blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SHOPPING');
            }
            if (!enableAIAsk) {
                blockedTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_YOUCHAT_BUTTON');
            }

            inst[engagementActionButton] = function () {
                const rawRes = origEngagementActionButton.apply(this, arguments);
                if (!Array.isArray(rawRes)) return rawRes;

                const seenTypes = new Set();
                let filtered = [];
                for (const item of rawRes) {
                    if (!item || blockedTypes.has(item.type)) continue;
                    if (item.type) {
                        if (seenTypes.has(item.type)) continue;
                        seenTypes.add(item.type);
                    }
                    filtered.push(item);
                }

                // Dynamically inject SponsorBlock Skip to Highlight button if present
                const highlightSegment = window.sponsorblock?.segments?.find(s => s.category === 'poi_highlight');
                if (enableHighlight && highlightSegment && !seenTypes.has('TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT')) {
                    seenTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT');
                    filtered.push({
                        type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT',
                        button: {
                            buttonRenderer: ButtonRenderer(
                                false,
                                t('sponsorblock.toasts.skipToHighlight') || 'Skip to highlight',
                                'FAST_FORWARD',
                                {
                                    clickTrackingParams: null,
                                    customAction: {
                                        action: 'SKIP',
                                        parameters: {
                                            time: highlightSegment.segment[0]
                                        }
                                    }
                                }
                            )
                        }
                    });
                }

                if (enableSpeed && !seenTypes.has('TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED')) {
                    seenTypes.add('TRANSPORT_CONTROLS_BUTTON_TYPE_SPEED');
                    filtered.push(speedButtonObj);
                }

                return filtered;
            };
        }

        if (configRead('enablePreviousNextButtons')) {
            if (previousButtonName) {
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
                    );
                };
            }

            if (nextButtonName) {
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
                    );
                };
            }
        }

        return inst;
    }

    if (configRead('enablePatchingVideoPlayer')) {
        YtlrPlayerActionsContainer.prototype = origMethod.prototype;
        YtlrPlayerActionsContainer.isPatchedByCustomUI = true;
        window._yttv[methods[0]] = YtlrPlayerActionsContainer;
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    applyPatches();
} else {
    window.addEventListener('DOMContentLoaded', applyPatches);
}