// Fast-Tube Cobalt Update Checker

import { buttonItem, showModal, showToast, overlayPanelItemListRenderer, scrollPaneRenderer, overlayMessageRenderer } from '../ui/ytUI.js';
import { configRead } from '../config.js';

// If Fast-Tube is not running on Cobalt, do nothing
// Add a timeout since reloading the home page while the updater pop up is shown causes the pop up to instantly disappear.
setTimeout(() => {
    if (window.h5vcc && window.h5vcc.fasttube && configRead('enableUpdater')) {
        const currentEpoch = Math.floor(Date.now() / 1000);
        if (configRead('dontCheckUpdateUntil') > currentEpoch) {
            console.info('Skipping update check until', new Date(configRead('dontCheckUpdateUntil') * 1000).toLocaleString());
        } else checkForUpdates();
    }
}, 2500);

function getLatestRelease() {
    return fetch('https://api.github.com/repos/RezoxP/Fast-Tube/releases/latest')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

function checkForUpdates(showNoUpdateToast) {
    const currentAppVersion = window.h5vcc.fasttube.GetVersion();
    const currentEpoch = Math.floor(Date.now() / 1000);

    getLatestRelease()
        .then(release => {
            const latestVersion = release.tag_name.replace('v', '');
            const releaseDate = new Date(release.published_at).getTime() / 1000;

            let architecture;
            let downloadUrl;

            if (window.h5vcc.fasttube.GetArchitecture) {
                architecture = window.h5vcc.fasttube.GetArchitecture();
            }

            if (architecture) {
                if (architecture === 'arm64-v8a') {
                    downloadUrl = release.assets.find(asset => asset.name.includes('arm64.apk')).browser_download_url;
                } else {
                    downloadUrl = release.assets.find(asset => asset.name.includes('arm.apk')).browser_download_url;
                }
            } else downloadUrl = release.assets[0].browser_download_url;

            if (latestVersion !== currentAppVersion) {
                console.info(`New version available: ${latestVersion} (current: ${currentAppVersion})`);
                const msg = `Release Date: ${new Date(releaseDate * 1000).toLocaleString()}\n${release.body}`.replace(/#/g, '').replace(/\*/g, '').trim();

                const buttons = [
                    buttonItem(
                        { title: 'Update Now', subtitle: 'Click to download the latest version.' },
                        { icon: 'DOWN_ARROW' },
                        [
                            {
                                customAction: {
                                    action: 'UPDATE_DOWNLOAD',
                                    parameters: downloadUrl
                                }
                            },
                            {
                                signalAction: {
                                    signal: 'POPUP_BACK'
                                }
                            }
                        ]
                    ),
                    buttonItem(
                        { title: 'Remind Me Later', subtitle: 'Check for updates later.' },
                        { icon: 'SEARCH_HISTORY' },
                        [
                            {
                                customAction: {
                                    action: 'UPDATE_REMIND_LATER',
                                    parameters: currentEpoch + 86400
                                }
                            },
                            {
                                signalAction: {
                                    signal: 'POPUP_BACK'
                                }
                            }
                        ]
                    )
                ];

                // Add an empty message so the CSS doesn't get screwed after user input
                buttons.push(overlayMessageRenderer(' '));
                buttons.push(overlayMessageRenderer(msg));

                showModal(
                    {
                        title: 'Update Available',
                        subtitle: `A new version of Fast-Tube Cobalt is available: ${latestVersion}, current: ${currentAppVersion}`
                    },
                    overlayPanelItemListRenderer(buttons),
                    'tt-update-modal',
                    false
                )
            } else {
                console.info('You are using the latest version of Fast-Tube.');
                if (showNoUpdateToast) {
                    showToast('Fast-Tube is up to date', `You are using the latest version (${currentAppVersion}) of Fast-Tube Cobalt.`, null);
                }
            }
        })
        .catch(error => {
            console.error('Error fetching the latest release:', error);
            showToast('Fast-Tube update check failed', 'Could not check for updates.', null);
        });
}

export default checkForUpdates;