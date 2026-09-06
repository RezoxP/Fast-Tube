import { configWrite, configRead } from './config.js';
import { enablePip } from './features/pictureInPicture.js';
import modernUI, { optionShow } from './ui/settings.js';
import { speedSettings } from './ui/speedUI.js';
import { showToast, buttonItem, showModal, QrCodeRenderer, overlayPanelItemListRenderer, overlayMessageRenderer } from './ui/ytUI.js';
import { requestNextAndNavigateChannel } from './utils/innerTubeCalls.js';
import qrcode from 'qrcode-npm';
import checkForUpdates from './features/updater.js';

let cachedResolveCommandKey = null;

export default function resolveCommand(cmd, _) {
    // resolveCommand function is pretty OP, it can do from opening modals, changing client settings and way more.
    // Because the client might change, we should find it first.

    if (cachedResolveCommandKey && window._yttv?.[cachedResolveCommandKey]?.instance?.resolveCommand) {
        return window._yttv[cachedResolveCommandKey].instance.resolveCommand(cmd, _);
    }

    for (const key in window._yttv) {
        if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
            cachedResolveCommandKey = key;
            return window._yttv[key].instance.resolveCommand(cmd, _);
        }
    }
}

export function findFunction(funcName) {
    for (const key in window._yttv) {
        if (window._yttv[key] && window._yttv[key][funcName] && typeof window._yttv[key][funcName] === 'function') {
            return window._yttv[key][funcName];
        }
    }
}

// Patch resolveCommand to be able to change Fast-Tube settings
// Returns true once at least one app instance with resolveCommand has been
// wrapped (idempotent on repeated calls).
//
// NOTE: the app's command-resolver singleton (_.RC.instance, returned by the
// bundle's _.H() accessor) is constructed asynchronously during app boot —
// potentially AFTER the <video> element exists. Callers must keep polling
// this function until it returns true, otherwise Fast-Tube customAction
// commands that reach _.H() (menus and any component dispatching through
// props.data.action) would silently fall through to the native resolver.

export function patchResolveCommand() {
    let patched = false;
    for (const key in window._yttv) {
        if (window._yttv[key] && window._yttv[key].instance && window._yttv[key].instance.resolveCommand) {
            if (window._yttv[key].instance.resolveCommand.__ftPatched) {
                patched = true;
                continue;
            }

            const ogResolve = window._yttv[key].instance.resolveCommand;
            const wrappedResolve = function (cmd, _) {
                if (cmd.setClientSettingEndpoint) {
                    // Command to change client settings. Use Fast-Tube configuration to change settings.
                    let handled = false;
                    for (const setting of cmd.setClientSettingEndpoint.settingDatas) {
                        if (!setting.clientSettingEnum.item.includes('_')) {
                            const valName = Object.keys(setting).find(key => key.includes('Value'));
                            const value = valName === 'intValue' ? Number(setting[valName]) : setting[valName];
                            if (valName === 'arrayValue') {
                                const arr = [...(configRead(setting.clientSettingEnum.item) || [])];
                                if (arr.includes(value)) {
                                    arr.splice(arr.indexOf(value), 1);
                                } else {
                                    arr.push(value);
                                }
                                configWrite(setting.clientSettingEnum.item, arr);
                            } else {
                                configWrite(setting.clientSettingEnum.item, value);
                            }
                            handled = true;
                        } else if (setting.clientSettingEnum.item === 'I18N_LANGUAGE') {
                            const lang = setting.stringValue;
                            const date = new Date();
                            date.setFullYear(date.getFullYear() + 10);
                            document.cookie = `PREF=hl=${lang}; expires=${date.toUTCString()};`;
                            resolveCommand({
                                signalAction: {
                                    signal: 'RELOAD_PAGE'
                                }
                            });
                            return true;
                        }
                    }
                    if (handled) return true;
                } else if (cmd.customAction) {
                    customAction(cmd.customAction.action, cmd.customAction.parameters);
                    return true;
                } else if (cmd?.signalAction?.customAction) {
                    customAction(cmd.signalAction.customAction.action, cmd.signalAction.customAction.parameters);
                    return true;
                } else if (cmd?.showEngagementPanelEndpoint?.customAction) {
                    customAction(cmd.showEngagementPanelEndpoint.customAction.action, cmd.showEngagementPanelEndpoint.customAction.parameters);
                    return true;
                } else if (cmd?.playlistEditEndpoint?.customAction) {
                    customAction(cmd.playlistEditEndpoint.customAction.action, cmd.playlistEditEndpoint.customAction.parameters);
                    return true;
                } else if (cmd?.openPopupAction?.uniqueId === 'playback-settings') {
                    // Patch the playback settings popup to use Fast-Tube speed settings
                    const items = cmd.openPopupAction.popup.overlaySectionRenderer.overlay.overlayTwoPanelRenderer.actionPanel.overlayPanelRenderer.content.overlayPanelItemListRenderer.items;
                    for (const item of items) {
                        if (item?.compactLinkRenderer?.icon?.iconType === 'SLOW_MOTION_VIDEO') {
                            item.compactLinkRenderer.subtitle && (item.compactLinkRenderer.subtitle.simpleText = 'with Fast-Tube');
                            item.compactLinkRenderer.serviceEndpoint = {
                                clickTrackingParams: "null",
                                signalAction: {
                                    customAction: {
                                        action: 'TT_SPEED_SETTINGS_SHOW',
                                        parameters: []
                                    }
                                }
                            };
                        }
                    }

                    const alreadyHasMiniPlayer = items.some(item =>
                        item?.compactLinkRenderer?.serviceEndpoint?.signalAction?.customAction?.action === 'ENTER_MP' ||
                        item?.compactLinkRenderer?.serviceEndpoint?.commandExecutorCommand?.commands?.some(c => c?.customAction?.action === 'ENTER_MP') ||
                        item?.compactLinkRenderer?.title?.simpleText === 'Mini Player'
                    );
                    if (!alreadyHasMiniPlayer) {
                        items.splice(2, 0,
                            buttonItem(
                                { title: 'Mini Player' },
                                { icon: 'CLEAR_COOKIES' }, [
                                {
                                    customAction: {
                                        action: 'ENTER_MP'
                                    }
                                }
                            ])
                        );
                    }

                    // Share button (QR code) - ported from upstream TizenTube
                    const alreadyHasShare = items.some(item =>
                        item?.compactLinkRenderer?.serviceEndpoint?.signalAction?.customAction?.action === 'SHARE' ||
                        item?.compactLinkRenderer?.serviceEndpoint?.commandExecutorCommand?.commands?.some(c => c?.customAction?.action === 'SHARE') ||
                        item?.compactLinkRenderer?.title?.simpleText === 'Share'
                    );
                    if (!alreadyHasShare) {
                        items.splice(3, 0,
                            buttonItem(
                                { title: 'Share' },
                                { icon: 'OPEN_IN_NEW' }, [
                                {
                                    customAction: {
                                        action: 'SHARE'
                                    }
                                }
                            ])
                        );
                    }

                    if (window.h5vcc && window.h5vcc.fasttube && window.h5vcc.fasttube.HasSystemFeature && 
                        window.h5vcc.fasttube.HasSystemFeature('android.software.picture_in_picture')) {
                        const alreadyHasPip = items.some(item =>
                            item?.compactLinkRenderer?.serviceEndpoint?.signalAction?.customAction?.action === 'ENTER_PIP' ||
                            item?.compactLinkRenderer?.serviceEndpoint?.commandExecutorCommand?.commands?.some(c => c?.customAction?.action === 'ENTER_PIP') ||
                            item?.compactLinkRenderer?.title?.simpleText === 'Picture in Picture'
                        );
                        if (!alreadyHasPip) {
                            items.splice(3, 0,
                                buttonItem(
                                    { title: 'Picture in Picture' },
                                    { icon: 'PIP' }, [
                                    {
                                        customAction: {
                                            action: 'ENTER_PIP'
                                        }
                                    },
                                    {
                                        signalAction: {
                                             signal: 'POPUP_BACK'
                                        }
                                    }
                                ])
                            );
                        }
                    }
                } else if (cmd?.watchEndpoint?.videoId) {
                    window.isPipPlaying = false;
                    const ytlrPlayerContainer = document.querySelector('ytlr-player-container');
                    ytlrPlayerContainer?.style?.removeProperty('z-index');
                }

                if (cmd.commandExecutorCommand && cmd.commandExecutorCommand.commands) {
                    for (const command of cmd.commandExecutorCommand.commands) {
                        if (command.customAction) {
                            customAction(command.customAction.action, command.customAction.parameters);
                        } else if (command.signalAction?.customAction) {
                            customAction(command.signalAction.customAction.action, command.signalAction.customAction.parameters);
                        } else if (command.showEngagementPanelEndpoint?.customAction) {
                            customAction(command.showEngagementPanelEndpoint.customAction.action, command.showEngagementPanelEndpoint.customAction.parameters);
                        } else if (command.playlistEditEndpoint?.customAction) {
                            customAction(command.playlistEditEndpoint.customAction.action, command.playlistEditEndpoint.customAction.parameters);
                        } else {
                            window._yttv[key].instance.resolveCommand(command, _);
                        }
                    }
                    return true;
                }

                if (cmd?.requestAccountSelectorCommand
                    && cmd.requestAccountSelectorCommand?.identityActionContext?.eventTrigger === 'ACCOUNT_EVENT_TRIGGER_ON_EXIT') {
                    if (!configRead('enableWhosWatchingMenuOnAppExit')) {
                        ogResolve.call(this, {
                            signalAction: {
                                signal: 'EXIT_APP'
                            }
                        });
                        return false;
                    }
                }

                return ogResolve.call(this, cmd, _);
            }
            wrappedResolve.__ftPatched = true;
            if (ogResolve.isPatchedBySubtitleLocalization) {
                wrappedResolve.isPatchedBySubtitleLocalization = true;
            }
            window._yttv[key].instance.resolveCommand = wrappedResolve;
            patched = true;
        }
    }
    return patched;
}

function customAction(action, parameters) {
    switch (action) {
        case 'SETTINGS_UPDATE':
            modernUI(true, parameters);
            break;
        case 'OPTIONS_SHOW':
            optionShow(parameters, parameters.update);
            break;
        case 'SKIP':
            const kE = document.createEvent('Event');
            kE.initEvent('keydown', true, true);
            kE.keyCode = 27;
            kE.which = 27;
            document.dispatchEvent(kE);

            document.querySelector('video').currentTime = parameters.time;
            break;
        case 'TT_SETTINGS_SHOW':
            modernUI();
            break;
        case 'TT_SPEED_SETTINGS_SHOW':
            speedSettings();
            break;
        case 'UPDATE_REMIND_LATER':
            configWrite('dontCheckUpdateUntil', parameters);
            break;
        case 'UPDATE_DOWNLOAD':
            window.h5vcc.fasttube.InstallAppFromURL(parameters);
            showToast('Fast-Tube Update', 'Downloading update, please wait...');
            break;
        case 'SET_PLAYER_SPEED':
            const speed = Number(parameters);
            document.querySelector('video').playbackRate = speed;
            break;
        case 'ENTER_MP':
            enablePip();
            break;
        case 'ENTER_PIP':
            window.h5vcc.fasttube.EnterPIP();
            break;
        case 'SHOW_TOAST':
            showToast('Fast-Tube', parameters);
            break;
        case 'ADD_TO_QUEUE':
            window.queuedVideos.videos.push(parameters);
            showToast('Fast-Tube', 'Video added to queue.');
            break;
        case 'CLEAR_QUEUE':
            window.queuedVideos.videos = [];
            showToast('Fast-Tube', 'Video queue cleared.');
            break;
        case 'CHECK_FOR_UPDATES':
            checkForUpdates(true);
            break;
        case 'GO_TO_CHANNEL':
            requestNextAndNavigateChannel(parameters);
            break;
        case 'SHARE': {
            // QR-code video sharing (ported from upstream TizenTube)
            try {
                let videoId = (typeof parameters === 'string' ? parameters : parameters?.videoId) || null;
                if (!videoId) {
                    const videoPlayer = document.querySelector('.html5-video-player');
                    const videoData = videoPlayer && typeof videoPlayer.getVideoData === 'function' ? videoPlayer.getVideoData() : null;
                    videoId = videoData && videoData.video_id ? videoData.video_id : null;
                }
                if (!videoId) {
                    const match = location.hash.match(/(?:[?&]v=|\/watch(?:\/|\?v=))([A-Za-z0-9_-]{11})/);
                    if (match) videoId = match[1];
                }
                if (!videoId) {
                    const img = document.querySelector('ytlr-watch-page img[src*="/vi/"]');
                    if (img) {
                        const m = (img.getAttribute('src') || '').match(/\/vi\/([A-Za-z0-9_-]{11})\//);
                        if (m) videoId = m[1];
                    }
                }
                if (!videoId) break;
                const shareUrl = `https://www.youtube.com/watch?v=${videoId}`;

                const qr = qrcode.qrcode(6, 'H');
                qr.addData(shareUrl);
                qr.make();

                const qrDataImgTag = qr.createImgTag(8, 8);
                const qrDataUrl = qrDataImgTag.match(/src="([^"]+)"/)[1];

                showModal({
                    title: 'Share Video',
                }, overlayPanelItemListRenderer([
                    buttonItem({ title: 'Close' }, null, [{ signalAction: { signal: 'POPUP_BACK' } }])
                ]), 'ft-share-modal');

                // Render QR image and caption into modal container safely using DOM APIs (avoiding TrustedHTML restrictions)
                const checkModalInterval = setInterval(() => {
                    const container = document.querySelector('ytlr-overlay-panel-item-list-renderer');
                    if (container) {
                        clearInterval(checkModalInterval);
                        if (!container.querySelector('#ft-qr-wrapper')) {
                            const wrapper = document.createElement('div');
                            wrapper.id = 'ft-qr-wrapper';
                            wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 10px; width: 100%; box-sizing: border-box;';

                            const text = document.createElement('div');
                            text.textContent = 'Scan the QR code below to share this video:';
                            text.style.cssText = 'color: #fff; font-size: 1.8rem; margin-bottom: 20px; text-align: center; font-family: Roboto, sans-serif;';

                            const img = document.createElement('img');
                            img.src = qrDataUrl;
                            img.style.cssText = 'background: #fff; padding: 12px; border-radius: 12px; width: 200px; height: 200px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);';

                            wrapper.appendChild(text);
                            wrapper.appendChild(img);
                            container.prepend(wrapper);
                        }
                    }
                }, 50);
                setTimeout(() => clearInterval(checkModalInterval), 2000);
            } catch (e) {
                console.error('Fast-Tube: SHARE failed', e);
            }
            break;
        }
    }
}