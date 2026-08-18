import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

// Same local-helpers convention used by AddToCart.js / HeroBanner.js / etc. —
// this codebase keeps prop-unwrapping helpers per-component rather than
// shared, so this mirrors that instead of introducing a new shared util.
const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

const asObject = (value) => {
  const resolved = deepUnwrap(value);
  return resolved && typeof resolved === "object" && !Array.isArray(resolved) ? resolved : {};
};

const toNumber = (value, fallback = 0) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  const n = Number(resolved);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.trim().toLowerCase() === "true";
  return Boolean(resolved);
};

// Builder's own local dev fallback is "/MobidragVideo.mp4" (Preview.tsx);
// that relative path only resolves against the builder's own host, so the
// app uses the same file served from the production domain instead —
// verified reachable at https://app.mobidrag.com/MobidragVideo.mp4.
const DEFAULT_VIDEO_URL = "https://app.mobidrag.com/MobidragVideo.mp4";
const BORDER_DEFAULT_COLOR = "#DDD3D3";

const buildBorderStyle = (borderLine, borderColor) => {
  const color = borderColor || BORDER_DEFAULT_COLOR;
  const width = 1;
  switch (String(borderLine || "none").toLowerCase()) {
    case "all":
      return { borderWidth: width, borderColor: color };
    case "top":
      return { borderTopWidth: width, borderColor: color };
    case "bottom":
      return { borderBottomWidth: width, borderColor: color };
    case "left":
      return { borderLeftWidth: width, borderColor: color };
    case "right":
      return { borderRightWidth: width, borderColor: color };
    default:
      return {};
  }
};

const getYoutubeVideoId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
};

// Inline SVG glyphs — kept self-contained inside the WebView's HTML instead
// of depending on a webfont (FontAwesome) that isn't bundled for WebView
// content, so the custom control bar doesn't flash unstyled/missing icons.
const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  back10: '<path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>',
  fwd10: '<path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/>',
  volume: '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.8-1-3.3-2.5-4.1v8.2c1.5-.8 2.5-2.3 2.5-4.1z"/>',
  fullscreen: '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>',
};

// Builds the HTML page rendered inside the WebView for a direct (mp4) video.
// The custom center play button + bottom control bar deliberately mirror
// VideoPlayer/Preview.tsx's hand-rolled controls (same colors/positions)
// instead of using the WebView's native <video controls>, since the builder
// preview never shows native browser chrome either.
function buildMp4Html(videoUrl, autoPlay, loopVideo) {
  const autoAttrs = autoPlay ? "autoplay muted" : "";
  const loopAttr = loopVideo ? "loop" : "";
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}
  .wrap{position:relative;width:100%;height:100%;}
  video{width:100%;height:100%;object-fit:contain;display:block;background:#000;}
  .playBtn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:70px;height:70px;border-radius:50%;border:2px solid #c79c9c;
    background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;
    padding:0;cursor:pointer;}
  .playBtn svg{width:26px;height:26px;fill:#c79c9c;}
  .controls{position:absolute;left:0;right:0;bottom:0;padding:12px;
    background:linear-gradient(to top, rgba(0,0,0,.8), rgba(0,0,0,0));}
  .seek{width:100%;margin-bottom:10px;accent-color:#ff1744;height:4px;}
  .row{display:flex;align-items:center;color:#fff;gap:12px;font-family:sans-serif;font-size:13px;}
  .row button{background:transparent;border:none;color:#fff;cursor:pointer;padding:4px;
    display:flex;align-items:center;}
  .row svg{width:16px;height:16px;fill:#fff;}
  .vol{width:80px;height:4px;}
</style>
</head>
<body>
<div class="wrap">
  <video id="v" src="${videoUrl}" playsinline webkit-playsinline ${autoAttrs} ${loopAttr}></video>
  <button class="playBtn" id="playBtn"><svg viewBox="0 0 24 24">${ICONS.play}</svg></button>
  <div class="controls">
    <input class="seek" id="seek" type="range" min="0" max="0" value="0" step="0.1"/>
    <div class="row">
      <span id="time">0:00</span>
      <button id="back"><svg viewBox="0 0 24 24">${ICONS.back10}</svg></button>
      <button id="fwd"><svg viewBox="0 0 24 24">${ICONS.fwd10}</svg></button>
      <button id="mute"><svg viewBox="0 0 24 24">${ICONS.volume}</svg></button>
      <input class="vol" id="vol" type="range" min="0" max="1" step="0.1" value="1"/>
      <button id="full"><svg viewBox="0 0 24 24">${ICONS.fullscreen}</svg></button>
    </div>
  </div>
</div>
<script>
(function () {
  var v = document.getElementById('v');
  var playBtn = document.getElementById('playBtn');
  var seek = document.getElementById('seek');
  var timeEl = document.getElementById('time');

  function fmt(t) {
    t = isFinite(t) ? t : 0;
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function syncPlayBtn() { playBtn.style.display = v.paused ? 'flex' : 'none'; }

  playBtn.addEventListener('click', function () { v.play(); });
  v.addEventListener('click', function () { v.paused ? v.play() : v.pause(); });
  v.addEventListener('play', syncPlayBtn);
  v.addEventListener('pause', syncPlayBtn);
  v.addEventListener('loadedmetadata', function () { seek.max = v.duration || 0; });
  v.addEventListener('timeupdate', function () {
    seek.value = v.currentTime;
    timeEl.textContent = fmt(v.currentTime);
  });
  seek.addEventListener('input', function () { v.currentTime = Number(seek.value); });
  document.getElementById('back').addEventListener('click', function () {
    v.currentTime = Math.max(0, v.currentTime - 10);
  });
  document.getElementById('fwd').addEventListener('click', function () {
    v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
  });
  document.getElementById('vol').addEventListener('input', function (e) {
    v.volume = Number(e.target.value);
  });
  document.getElementById('full').addEventListener('click', function () {
    if (v.requestFullscreen) v.requestFullscreen();
  });
  syncPlayBtn();
})();
</script>
</body>
</html>`;
}

function buildYoutubeHtml(videoId) {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}
  iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0;}
</style>
</head>
<body>
<iframe
  src="https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1"
  allow="autoplay; encrypted-media; fullscreen"
  allowfullscreen
></iframe>
</body>
</html>`;
}

export default function VideoPlayer({ section }) {
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const rawWrapped = deepUnwrap(propsNode?.raw);
  const raw =
    rawWrapped && typeof rawWrapped === "object" ? { ...propsNode, ...rawWrapped } : propsNode || {};

  const visibility = asObject(raw?.visibility);
  const videoAttributes = asObject(raw?.videoAttributes);
  const buyNow = asObject(raw?.buyNow);
  // Inspector.tsx has a leftover bug: the Corners field writes to
  // `addToCart.contBorderRadius` (copy-pasted from AddToCart) instead of
  // `buyNow.contBorderRadius`, but Preview.tsx reads addToCart first with a
  // buyNow fallback — so already-saved apps rely on that exact precedence.
  const addToCart = asObject(raw?.addToCart);

  const showVideoSource = toBoolean(visibility?.videoSource, true);
  const showBgPadding = toBoolean(visibility?.buyNowBgPadding, true);

  const configuredUrl = showVideoSource ? toStr(raw?.videoUrl, "").trim() : "";
  const videoUrl = configuredUrl || DEFAULT_VIDEO_URL;

  const autoPlay = toBoolean(videoAttributes?.autoPlay, false);
  const loopVideo = toBoolean(videoAttributes?.loopVideo, false);

  const bgColor = toStr(buyNow?.bgColor, "#FFFFFF");
  const borderColor = toStr(buyNow?.borderColor, BORDER_DEFAULT_COLOR);
  const borderLine = toStr(buyNow?.borderLine, "none");
  const cornerRadius = toNumber(addToCart?.contBorderRadius ?? buyNow?.contBorderRadius, 0);
  const pt = toNumber(buyNow?.pt, 0);
  const pb = toNumber(buyNow?.pb, 0);
  const pl = toNumber(buyNow?.pl, 0);
  const pr = toNumber(buyNow?.pr, 0);

  const isYoutube = /youtube\.com|youtu\.be/i.test(videoUrl);
  const isMp4 = /\.mp4($|\?)/i.test(videoUrl);
  const youtubeId = isYoutube ? getYoutubeVideoId(videoUrl) : "";

  const html = useMemo(() => {
    if (isYoutube) return youtubeId ? buildYoutubeHtml(youtubeId) : "";
    if (isMp4) return buildMp4Html(videoUrl, autoPlay, loopVideo);
    return "";
  }, [isYoutube, isMp4, youtubeId, videoUrl, autoPlay, loopVideo]);

  const wrapperStyle = [
    styles.wrapper,
    {
      borderRadius: showBgPadding ? cornerRadius : 0,
      backgroundColor: showBgPadding ? bgColor : "transparent",
      paddingTop: showBgPadding ? pt : 0,
      paddingBottom: showBgPadding ? pb : 0,
      paddingLeft: showBgPadding ? pl : 0,
      paddingRight: showBgPadding ? pr : 0,
      ...(showBgPadding ? buildBorderStyle(borderLine, borderColor) : null),
    },
  ];

  return (
    <View style={wrapperStyle}>
      <View style={styles.mediaBox}>
        {html ? (
          <WebView
            key={`${videoUrl}|${autoPlay}|${loopVideo}`}
            source={{ html }}
            style={styles.webview}
            containerStyle={{ backgroundColor: "transparent" }}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            bounces={false}
            originWhitelist={["*"]}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Unsupported video URL</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    overflow: "hidden",
  },
  mediaBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  placeholderText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
});
