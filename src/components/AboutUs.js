import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const unwrap = (v, fb) => {
  if (v === undefined || v === null) return fb;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
  }
  return v !== undefined ? v : fb;
};

// Injected JS: posts the document body's scroll height back to RN
const AUTO_HEIGHT_JS = `
  (function() {
    function postHeight() {
      var h = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.ReactNativeWebView.postMessage(String(h));
    }
    postHeight();
    // Re-post after images / fonts load
    window.addEventListener('load', postHeight);
    setTimeout(postHeight, 500);
    setTimeout(postHeight, 1200);
  })();
  true;
`;

const wrapHtml = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #111827;
      background: #ffffff;
      padding: 16px;
      -webkit-text-size-adjust: 100%;
    }
    h1, h2, h3 { font-weight: 700; margin-bottom: 12px; margin-top: 20px; color: #0F172A; }
    h1 { font-size: 22px; }
    h2 { font-size: 18px; }
    h3 { font-size: 16px; }
    p  { margin-bottom: 12px; color: #374151; }
    a  { color: #0D9488; }
    ul, ol { padding-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 6px; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    hr { border: none; border-top: 1px solid #E5E7EB; margin: 16px 0; }
  </style>
</head>
<body>${content}</body>
</html>`;

export default function AboutUs({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const htmlProp = unwrap(propsNode?.html, "");
  const htmlCode = unwrap(propsNode?.htmlCode, "");

  // Prefer html (full doc), fall back to htmlCode (snippet)
  const rawContent = htmlProp || htmlCode || "";

  const isFullDoc =
    rawContent.trim().toLowerCase().startsWith("<!doctype") ||
    rawContent.trim().toLowerCase().startsWith("<html");

  const finalHtml = isFullDoc ? rawContent : wrapHtml(rawContent);

  const [webviewHeight, setWebviewHeight] = useState(300);
  const [loading, setLoading] = useState(true);

  if (!rawContent) return null;

  return (
    <View style={[styles.container, { height: webviewHeight }]}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color="#0D9488" />
        </View>
      )}
      <WebView
        style={styles.webview}
        source={{ html: finalHtml }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        injectedJavaScript={AUTO_HEIGHT_JS}
        onMessage={(e) => {
          const h = parseInt(e.nativeEvent.data, 10);
          if (!Number.isNaN(h) && h > 0) {
            setWebviewHeight(h + 32); // small buffer
          }
        }}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled={false}
        originWhitelist={["*"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
