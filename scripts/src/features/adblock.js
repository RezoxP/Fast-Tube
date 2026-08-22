import { configRead } from '../config.js';
import Chapters from '../ui/chapters.js';
import resolveCommand from '../resolveCommand.js';
import { timelyAction, longPressData, MenuServiceItemRenderer, ShelfRenderer, TileRenderer, ButtonRenderer } from '../ui/ytUI.js';
import { PatchSettings } from '../ui/customYTSettings.js';
import { t } from 'i18next';

/**
 * Minimal fast ad-filtering and metadata processing for YouTube TV
 */
const origParse = JSON.parse;
JSON.parse = function () {
  const r = origParse.apply(this, arguments);
  if (!r || typeof r !== 'object') return r;

  try {
    const adBlockEnabled = configRead('enableAdBlock');
    const signinReminderEnabled = configRead('enableSigninReminder');

    if (adBlockEnabled) {
      if (r.adPlacements) r.adPlacements = [];
      if (r.playerAds) r.playerAds = false;
      if (r.adSlots) r.adSlots = [];
    }

    if (r.paidContentOverlay && !configRead('enablePaidPromotionOverlay')) {
      r.paidContentOverlay = null;
    }

    const preferredCodec = configRead('videoPreferredCodec');
    if (preferredCodec !== 'any' && r?.streamingData?.adaptiveFormats) {
      const hasPreferredCodec = r.streamingData.adaptiveFormats.some(format => format.mimeType && format.mimeType.includes(preferredCodec));
      if (hasPreferredCodec) {
        r.streamingData.adaptiveFormats = r.streamingData.adaptiveFormats.filter(format => {
          if (format.mimeType && format.mimeType.startsWith('audio/')) return true;
          return format.mimeType && format.mimeType.includes(preferredCodec);
        });
      }
    }

    // Drop "masthead" ad from home screen
    const sectionListContents = r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
    if (Array.isArray(sectionListContents)) {
      let filteredContents = sectionListContents;
      if (!signinReminderEnabled) {
        filteredContents = filteredContents.filter((elm) => !elm.feedNudgeRenderer);
      }

      if (adBlockEnabled) {
        filteredContents = filteredContents.filter((elm) => !elm.adSlotRenderer);

        for (const shelve of filteredContents) {
          if (shelve.shelfRenderer?.content?.horizontalListRenderer?.items) {
            shelve.shelfRenderer.content.horizontalListRenderer.items =
              shelve.shelfRenderer.content.horizontalListRenderer.items.filter(
                (item) => !item.adSlotRenderer
              );
          }
        }
      }

      r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents = filteredContents;
      processShelves(filteredContents);
    }

    if (r.endscreen && configRead('enableHideEndScreenCards')) {
      r.endscreen = null;
    }

    if (Array.isArray(r.messages) && !configRead('enableYouThereRenderer')) {
      r.messages = r.messages.filter((msg) => !msg?.youThereRenderer);
    }

    // Remove shorts ads
    if (!Array.isArray(r) && Array.isArray(r.entries) && adBlockEnabled) {
      r.entries = r.entries.filter(
        (elm) => !elm?.command?.reelWatchEndpoint?.adClientParams?.isAd
      );
    }

    // Patch settings
    if (r.title?.runs) {
      PatchSettings(r);
    }

    // DeArrow / Shelf processing
    if (r.contents?.sectionListRenderer?.contents) {
      processShelves(r.contents.sectionListRenderer.contents);
    }

    if (r.continuationContents?.sectionListContinuation?.contents) {
      processShelves(r.continuationContents.sectionListContinuation.contents);
    }

    if (r.continuationContents?.horizontalListContinuation?.items) {
      const items = r.continuationContents.horizontalListContinuation.items;
      deArrowify(items);
      hqify(items);
      addLongPress(items);
      r.continuationContents.horizontalListContinuation.items = hideVideo(items);
    }

    const navSections = r.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer?.sections;
    if (Array.isArray(navSections)) {
      const sortAlphabet = configRead('sortSubscriptionsByAlphabet');
      for (let i = 0; i < navSections.length; i++) {
        const section = navSections[i]?.tvSecondaryNavSectionRenderer;
        if (!section || !Array.isArray(section.tabs)) continue;

        if (sortAlphabet) {
          section.tabs.sort((a, b) => {
            if (a.tabRenderer?.selected && !b.tabRenderer?.selected) return -1;
            if (!a.tabRenderer?.selected && b.tabRenderer?.selected) return 1;
            return (a.tabRenderer?.title || '').localeCompare(b.tabRenderer?.title || '');
          });
        }

        for (let j = 0; j < section.tabs.length; j++) {
          const tab = section.tabs[j];
          const tabSectionContents = tab?.tabRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents;
          if (Array.isArray(tabSectionContents)) {
            processShelves(tabSectionContents);
          }
        }
      }
    }

    const watchNextPivot = r.contents?.singleColumnWatchNextResults?.pivot?.sectionListRenderer;
    if (Array.isArray(watchNextPivot?.contents)) {
      if (!signinReminderEnabled) {
        watchNextPivot.contents = watchNextPivot.contents.filter(
          (elm) => !elm.alertWithActionsRenderer
        );
      }
      processShelves(watchNextPivot.contents, false);
      if (window.queuedVideos?.videos?.length > 0) {
        const queuedVideosClone = window.queuedVideos.videos.slice();
        queuedVideosClone.unshift(TileRenderer(
          'Clear Queue',
          {
            customAction: {
              action: 'CLEAR_QUEUE'
            }
          }));
        watchNextPivot.contents.unshift(ShelfRenderer(
          'Queued Videos',
          queuedVideosClone,
          queuedVideosClone.findIndex(v => v.contentId === window.queuedVideos.lastVideoId) !== -1 ?
            queuedVideosClone.findIndex(v => v.contentId === window.queuedVideos.lastVideoId)
            : 0
        ));
      }
    }

    // Manual SponsorBlock Skips
    const manualSkippedSegments = configRead('sponsorBlockManualSkips');
    if (Array.isArray(manualSkippedSegments) && manualSkippedSegments.length > 0 && r.playerOverlays?.playerOverlayRenderer) {
      if (Array.isArray(window?.sponsorblock?.segments)) {
        const timelyActions = [];
        for (const segment of window.sponsorblock.segments) {
          if (manualSkippedSegments.includes(segment.category)) {
            const timelyActionData = timelyAction(
              t('sponsorblock.toasts.skip', { segment: t(`sponsorblock.segments.${segment.category}`) }),
              'SKIP_NEXT',
              {
                clickTrackingParams: null,
                showEngagementPanelEndpoint: {
                  customAction: {
                    action: 'SKIP',
                    parameters: {
                      time: segment.segment[1]
                    }
                  }
                }
              },
              segment.segment[0] * 1000,
              segment.segment[1] * 1000 - segment.segment[0] * 1000
            );
            timelyActions.push(timelyActionData);
          }
        }
        r.playerOverlays.playerOverlayRenderer.timelyActionRenderers = timelyActions;
      }
    } else if (r.playerOverlays?.playerOverlayRenderer) {
      r.playerOverlays.playerOverlayRenderer.timelyActionRenderers = [];
    }

    if (r.transportControls?.transportControlsRenderer?.promotedActions && configRead('enableSponsorBlockHighlight')) {
      if (Array.isArray(window?.sponsorblock?.segments)) {
        const category = window.sponsorblock.segments.find(seg => seg.category === 'poi_highlight');
        if (category && !r.transportControls.transportControlsRenderer.promotedActions.some(a => a.type === 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT')) {
          r.transportControls.transportControlsRenderer.promotedActions.push({
            type: 'TRANSPORT_CONTROLS_BUTTON_TYPE_SPONSORBLOCK_HIGHLIGHT',
            button: {
              buttonRenderer: ButtonRenderer(
                false,
                t('sponsorblock.toasts.skipToHighlight'),
                'FAST_FORWARD',
                {
                  clickTrackingParams: null,
                  customAction: {
                    action: 'SKIP',
                    parameters: {
                      time: category.segment[0]
                    }
                  }
                })
            }
          });
        }
      }
    }
  } catch (e) {}

  return r;
};

// Fix playback issues without heavy deep stringify/parse
const origStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
  if (value?.playbackContext?.contentPlaybackContext) {
    if (!value.playbackContext.contentPlaybackContext.isInlinePlaybackNoAd) {
      const copiedValue = {
        ...value,
        playbackContext: {
          ...value.playbackContext,
          contentPlaybackContext: {
            ...value.playbackContext.contentPlaybackContext,
            isInlinePlaybackNoAd: true
          }
        }
      };
      return origStringify.call(this, copiedValue, replacer, space);
    }
  }
  return origStringify.call(this, value, replacer, space);
};

window.JSON.stringify = JSON.stringify;
window.JSON.parse = JSON.parse;

if (window._yttv) {
  for (const key in window._yttv) {
    if (window._yttv[key]?.JSON?.parse) {
      window._yttv[key].JSON.parse = JSON.parse;
    }
  }
}

function processShelves(shelves, shouldAddPreviews = true) {
  if (!Array.isArray(shelves)) return;
  const enableShorts = configRead('enableShorts');

  for (let sIdx = shelves.length - 1; sIdx >= 0; sIdx--) {
    const shelve = shelves[sIdx];
    if (!shelve?.shelfRenderer) continue;

    if (!enableShorts && shelve.shelfRenderer.tvhtml5ShelfRendererType === 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS') {
      shelves.splice(sIdx, 1);
      continue;
    }

    const items = shelve.shelfRenderer.content?.horizontalListRenderer?.items;
    if (!Array.isArray(items)) continue;

    deArrowify(items);
    hqify(items);
    addLongPress(items);
    if (shouldAddPreviews) {
      addPreviews(items);
    }
    shelve.shelfRenderer.content.horizontalListRenderer.items = hideVideo(items);

    if (!enableShorts) {
      shelve.shelfRenderer.content.horizontalListRenderer.items = shelve.shelfRenderer.content.horizontalListRenderer.items.filter(item => {
        if (item.tileRenderer?.tvhtml5ShelfRendererType === 'TVHTML5_TILE_RENDERER_TYPE_SHORTS') return false;
        if (item.tileRenderer?.onSelectCommand?.reelWatchEndpoint) return false;
        return true;
      });
    }
  }
}

function addPreviews(items) {
  if (!configRead('enablePreviews') || !Array.isArray(items)) return;
  for (const item of items) {
    if (item?.tileRenderer) {
      const watchEndpoint = item.tileRenderer.onSelectCommand;
      if (!watchEndpoint) continue;
      if (item.tileRenderer.onFocusCommand?.playbackEndpoint) continue;
      if (item.tileRenderer.onFocusCommand?.commandExecutorCommand) continue;

      item.tileRenderer.onFocusCommand = {
        startInlinePlaybackCommand: {
          blockAdoption: true,
          caption: false,
          delayMs: 3000,
          durationMs: 40000,
          muted: false,
          restartPlaybackBeforeSeconds: 10,
          resumeVideo: true,
          playbackEndpoint: { ...watchEndpoint }
        }
      };
    }
  }
}

function deArrowify(items) {
  const isDeArrowEnabled = configRead('enableDeArrow');
  if (!isDeArrowEnabled || !Array.isArray(items)) return;
  const isDeArrowThumbnailsEnabled = configRead('enableDeArrowThumbnails');
  
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item?.tileRenderer) continue;
    
    const videoID = item.tileRenderer.contentId;
    if (!videoID) continue;

    setTimeout(() => {
      fetch(`https://sponsor.ajay.app/api/branding?videoID=${videoID}`)
        .then(res => res.json())
        .then(data => {
          if (data.titles && data.titles.length > 0) {
            const mostVoted = data.titles.reduce((max, title) => max.votes > title.votes ? max : title);
            if (item.tileRenderer?.metadata?.tileMetadataRenderer?.title) {
              item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText = mostVoted.title;
            }
          }

          if (isDeArrowThumbnailsEnabled && data.thumbnails && data.thumbnails.length > 0) {
            const mostVotedThumbnail = data.thumbnails.reduce((max, thumbnail) => max.votes > thumbnail.votes ? max : thumbnail);
            if (mostVotedThumbnail.timestamp && item.tileRenderer?.header?.tileHeaderRenderer?.thumbnail) {
              item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
                {
                  url: `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${videoID}&time=${mostVotedThumbnail.timestamp}`,
                  width: 1280,
                  height: 640
                }
              ];
            }
          }
        })
        .catch(() => {});
    }, 500 + Math.random() * 2000);
  }
}

function hqify(items) {
  if (!configRead('enableHqThumbnails') || !Array.isArray(items)) return;

  for (const item of items) {
    if (item?.tileRenderer?.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;
    const videoID = item.tileRenderer.onSelectCommand?.watchEndpoint?.videoId;
    const thumbUrl = item.tileRenderer.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url;
    if (!videoID || !thumbUrl) continue;

    const queryArgs = thumbUrl.split('?')[1];
    item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = [
      {
        url: `https://i.ytimg.com/vi/${videoID}/sddefault.jpg${queryArgs ? `?${queryArgs}` : ''}`,
        width: 640,
        height: 480
      }
    ];
  }
}

function addLongPress(items) {
  if (!Array.isArray(items)) return;
  const enableLongPress = configRead('enableLongPress');

  for (const item of items) {
    if (!item?.tileRenderer || item.tileRenderer.style !== 'TILE_STYLE_YTLR_DEFAULT') continue;

    if (item.tileRenderer.onLongPressCommand?.showMenuCommand?.menu?.menuRenderer?.items) {
      const copiedItem = { ...item, tileRenderer: { ...item.tileRenderer, onLongPressCommand: undefined } };
      item.tileRenderer.onLongPressCommand.showMenuCommand.menu.menuRenderer.items.push(
        MenuServiceItemRenderer('Add to Queue', {
          clickTrackingParams: null,
          playlistEditEndpoint: {
            customAction: {
              action: 'ADD_TO_QUEUE',
              parameters: copiedItem
            }
          }
        })
      );
      continue;
    }

    if (!enableLongPress) continue;
    if (!item.tileRenderer.metadata?.tileMetadataRenderer) continue;
    if (!item.tileRenderer.header?.tileHeaderRenderer?.thumbnail?.thumbnails) continue;
    if (!item.tileRenderer.onSelectCommand?.watchEndpoint) continue;

    const copiedItem = { ...item, tileRenderer: { ...item.tileRenderer, onLongPressCommand: undefined } };
    const subtitleNode = copiedItem.tileRenderer.metadata.tileMetadataRenderer.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text;
    if (!subtitleNode) continue;

    const subtitle = subtitleNode;
    const data = longPressData({
      videoId: copiedItem.tileRenderer.contentId,
      thumbnails: copiedItem.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails,
      title: copiedItem.tileRenderer.metadata.tileMetadataRenderer.title.simpleText,
      subtitle: subtitle.runs ? subtitle.runs[0].text : subtitle.simpleText,
      watchEndpointData: copiedItem.tileRenderer.onSelectCommand.watchEndpoint,
      item: copiedItem
    });
    item.tileRenderer.onLongPressCommand = data;
  }
}

function hideVideo(items) {
  if (!Array.isArray(items)) return items;
  const pages = configRead('hideWatchedVideosPages');
  if (!pages || !pages.length) return items;

  const hash = location.hash ? location.hash.substring(1) : '';
  let pageName = '';
  if (hash === '/') {
    pageName = 'home';
  } else if (hash.startsWith('/search')) {
    pageName = 'search';
  } else {
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const match = hash.slice(qIndex + 1).match(/(?:^|&)[\w]+=(?:FE|topics_)?([^&]+)/);
      pageName = match ? match[1] : '';
    }
  }

  if (!pages.includes(pageName)) return items;
  const threshold = configRead('hideWatchedVideosThreshold');

  return items.filter(item => {
    if (!item?.tileRenderer?.header?.tileHeaderRenderer?.thumbnailOverlays) return true;
    const overlays = item.tileRenderer.header.tileHeaderRenderer.thumbnailOverlays;
    let progressBar = null;
    for (let i = 0; i < overlays.length; i++) {
      if (overlays[i].thumbnailOverlayResumePlaybackRenderer) {
        progressBar = overlays[i].thumbnailOverlayResumePlaybackRenderer;
        break;
      }
    }
    if (!progressBar) return true;

    const percentWatched = (progressBar.percentDurationWatched || 0);
    return percentWatched <= threshold;
  });
}