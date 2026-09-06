// InnerTube request helpers (ported from upstream TizenTube).
// These reuse the app's own KabukiInnerTubeClient, so requests are
// authenticated and identical to what the TV app itself sends.

import resolveCommand from '../resolveCommand.js';

function requestNextAndNavigateChannel(params) {
    const mappings = Object.values(window._yttv).find(a => a && a.mappings);
    if (!mappings) return;
    const CurrentIdentityService = mappings.get('CurrentIdentityService');
    const KabukiInnerTubeClient = mappings.get('KabukiInnerTubeClient');
    if (!CurrentIdentityService || !KabukiInnerTubeClient) return;

    const data = params.tileRenderer;
    if (!data || !data.contentId) return;

    // A small random delay mirrors the app's own lactMilliseconds jitter.
    const randomDelay = Math.floor(Math.random() * 2000);

    CurrentIdentityService.get().then(identity => {
        const request = {
            identity,
            isPrefetch: false,
            path: '/youtubei/v1/next',
            payload: {
                videoId: data.contentId,
                params: data.onSelectCommand?.watchEndpoint?.params,
                racyCheckOk: true,
                contentCheckOk: true,
                playbackContext: {
                    lactMilliseconds: randomDelay,
                    isLyricsMode: false
                },
                autonavState: 'STATE_NONE',
                mdxContext: {
                    mdxReceiverContext: {
                        mdxConnectedDevices: []
                    }
                }
            },
            clickTracking: {
                clickTrackingParams: null,
            }
        };

        KabukiInnerTubeClient.fetch(request).subscribe({
            next: (response) => {
                const contents = response?.contents?.singleColumnWatchNextResults?.results?.results?.contents;
                if (contents) {
                    const itemSectionRenderer = contents.find(item => item.itemSectionRenderer);
                    const videoMetadataRenderer = itemSectionRenderer?.itemSectionRenderer?.contents?.find(item => item.videoMetadataRenderer);
                    if (videoMetadataRenderer) {
                        const navigation = videoMetadataRenderer.videoMetadataRenderer?.owner?.videoOwnerRenderer?.navigationEndpoint;
                        if (navigation) resolveCommand(navigation);
                    }
                }
            },
            error: () => { }
        });
    }).catch(() => { });
}

export {
    requestNextAndNavigateChannel
}
