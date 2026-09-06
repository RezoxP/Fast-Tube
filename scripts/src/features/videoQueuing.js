window.queuedVideos = {
    videos: [],
    lastVideoId: null
};

import resolveCommand from '../resolveCommand.js';

let attachedQueuePlayer = null;
let queuePollAttempts = 0;
const QUEUE_MAX_ATTEMPTS = 30;

function addListener() {
    const videoPlayer = document.querySelector('.html5-video-player');
    if (!videoPlayer) {
        if (++queuePollAttempts < QUEUE_MAX_ATTEMPTS) {
            setTimeout(addListener, 1000);
        }
        return;
    }

    if (attachedQueuePlayer === videoPlayer && attachedQueuePlayer.isConnected) return;
    attachedQueuePlayer = videoPlayer;

    videoPlayer.addEventListener('onStateChange', () => {
        const playerStateObject = videoPlayer.getPlayerStateObject ? videoPlayer.getPlayerStateObject() : null;
        const videoData = videoPlayer.getVideoData ? videoPlayer.getVideoData() : null;
        if (!playerStateObject || !videoData || window.queuedVideos.videos.length === 0) return;

        const getVideoId = (v) => v?.tileRenderer?.contentId || v?.contentId || v?.videoId;

        if (playerStateObject.isEnded) {
            const index = window.queuedVideos.videos.findIndex(v => getVideoId(v) === videoData.video_id);
            if (index !== -1) {
                if (index + 1 >= window.queuedVideos.videos.length) {
                    resolveCommand({
                        customAction: {
                            action: 'CLEAR_QUEUE'
                        }
                    });
                    return;
                }
                const nextItem = window.queuedVideos.videos[index + 1];
                const videoWatchEndpoint = nextItem?.tileRenderer?.onSelectCommand || nextItem?.onSelectCommand;
                if (videoWatchEndpoint) setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
            } else if (window.queuedVideos.lastVideoId) {
                const lastIndex = window.queuedVideos.videos.findIndex(v => getVideoId(v) === window.queuedVideos.lastVideoId);
                if (lastIndex !== -1 && lastIndex + 1 < window.queuedVideos.videos.length) {
                    const nextItem = window.queuedVideos.videos[lastIndex + 1];
                    const videoWatchEndpoint = nextItem?.tileRenderer?.onSelectCommand || nextItem?.onSelectCommand;
                    if (videoWatchEndpoint) setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
                } else {
                    resolveCommand({
                        customAction: {
                            action: 'CLEAR_QUEUE'
                        }
                    });
                    return;
                }
            } else {
                const firstItem = window.queuedVideos.videos[0];
                const videoWatchEndpoint = firstItem?.tileRenderer?.onSelectCommand || firstItem?.onSelectCommand;
                if (videoWatchEndpoint) setTimeout(() => resolveCommand(videoWatchEndpoint), 500);
            }
        } else if (playerStateObject.isPlaying) {
            const container = document.getElementById('container');
            if (container) container.style.setProperty('opacity', '1', 'important');
            if (window.queuedVideos.videos.find(v => getVideoId(v) === videoData.video_id)) {
                window.queuedVideos.lastVideoId = videoData.video_id;
            }
        }
    });
}

window.addEventListener('hashchange', () => {
    if (location.hash.includes('watch')) {
        queuePollAttempts = 0;
        addListener();
    }
});

addListener();