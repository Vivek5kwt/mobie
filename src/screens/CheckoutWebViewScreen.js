import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import HeaderIcon from "react-native-vector-icons/FontAwesome6";
import { WebView } from "react-native-webview";
import { SafeArea } from "../utils/SafeAreaHandler";
import { useAuth } from "../services/AuthContext";
import { isAuthenticatedSession } from "../utils/authGate";
import { resolveAppId } from "../utils/appId";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";
import { saveCompletedOrder } from "../services/orderHistoryService";
import { getStoreConfigSync } from "../services/storeService";
import { fetchShopifyOrderDetails } from "../services/shopify";
import { trackPurchase } from "../services/analyticsService";
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
  parseMoneyAmount,
} from "../utils/money";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHECKOUT_WEBVIEW_LOG = "[CheckoutWebView]";
const PENDING_ORDER_NUMBER_DELAY_MS = 3600;

const normalizeCheckoutUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return raw;
};

const normalizeHost = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/^www\./, "");

const isStorefrontRootUrl = (requestedUrl = "", checkoutUrl = "", currentUrl = "") => {
  const targetRaw = normalizeCheckoutUrl(requestedUrl);
  if (!targetRaw || /^(about:blank|data:|javascript:|mailto:|tel:)/i.test(targetRaw)) return false;
  try {
    const target = new URL(targetRaw);
    const checkout = checkoutUrl ? new URL(normalizeCheckoutUrl(checkoutUrl)) : null;
    const current = currentUrl ? new URL(normalizeCheckoutUrl(currentUrl)) : null;
    const targetPath = target.pathname.replace(/\/+$/, "") || "/";
    if (targetPath !== "/") return false;
    const targetHost = normalizeHost(target.hostname);
    const checkoutHost = normalizeHost(checkout?.hostname || "");
    const currentHost = normalizeHost(current?.hostname || "");
    return Boolean(targetHost && (targetHost === checkoutHost || targetHost === currentHost));
  } catch (_) {
    return false;
  }
};

const pickSessionCustomerEmail = (session) => {
  const candidates = [
    session?.user?.email,
    session?.user?.customer?.email,
    session?.user?.shopifyCustomer?.email,
    session?.customer?.email,
    session?.email,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
};

const summarizeWebViewEvent = (event) => {
  const nativeEvent = event?.nativeEvent || event || {};
  return {
    url: nativeEvent.url || "",
    code: nativeEvent.code,
    statusCode: nativeEvent.statusCode,
    description: nativeEvent.description || "",
    domain: nativeEvent.domain || "",
    canGoBack: nativeEvent.canGoBack,
    loading: nativeEvent.loading,
  };
};

const extractOrderNumber = (url) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    const n =
      u.searchParams.get("order_number") ||
      u.searchParams.get("order_name") ||
      u.searchParams.get("name");
    if (n) return normalizeOrderNumber(n);
  } catch (_) {}
  return "";
};

const isSyntheticOrderReference = (value = "") => {
  const raw = String(value || "").trim().replace(/^#\s*/, "");
  return /^(?:ORD|ORDER)[-_]?\d+/i.test(raw);
};

const normalizeOrderReference = (value = "", { allowSynthetic = false } = {}) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const orderPhrase =
    raw.match(/order\s*(?:number|no\.?)?\s*#\s*([A-Za-z0-9-]+)/i) ||
    raw.match(/order\s*(?:number|no\.?)\s+([A-Za-z0-9-]+)/i);
  const hash = raw.match(/#\s*([A-Za-z0-9-]+)/);
  const plain = raw.match(/^#?\s*([A-Za-z0-9-]+)\s*$/);
  const valuePart = orderPhrase?.[1] || hash?.[1] || plain?.[1] || "";
  const normalized = valuePart ? `#${valuePart}` : "";
  if (!allowSynthetic && isSyntheticOrderReference(normalized)) return "";
  return normalized;
};

const normalizeOrderNumber = (value = "") => normalizeOrderReference(value);

const normalizeAnyOrderReference = (value = "") =>
  normalizeOrderReference(value, { allowSynthetic: true });

const pickSessionCustomerAccessToken = (session) => {
  const candidates = [
    session?.user?.customerAccessToken,
    session?.user?.shopifyCustomerAccessToken,
    session?.user?.customer_access_token,
    session?.customerAccessToken,
    session?.shopifyCustomerAccessToken,
    session?.user?.userToken,
    session?.accessToken,
    session?.token,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
};

const looksLikeCurrencyCode = (value = "") =>
  /^[A-Z]{3}$/.test(String(value || "").trim().toUpperCase());

const resolveItemCurrencyCode = (item = {}, fallbackCode = "") => {
  const explicit =
    item.priceCurrency ||
    item.currencyCode ||
    item.presentmentCurrencyCode ||
    "";
  if (explicit) return String(explicit).trim().toUpperCase();
  if (looksLikeCurrencyCode(item.currency)) {
    return String(item.currency).trim().toUpperCase();
  }
  return String(fallbackCode || "").trim().toUpperCase();
};

const buildOrderFromCart = (capturedItems, url, storeCurrencyCode = "", explicitOrderNumber = "") => {
  const today   = new Date();
  const fmt     = (d) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const firstCurrencyCode = (capturedItems || [])
    .map((item) => resolveItemCurrencyCode(item, storeCurrencyCode))
    .find(Boolean);

  const lineItems = (capturedItems || []).map((item) => {
    const currencyCode = resolveItemCurrencyCode(item, storeCurrencyCode);
    const rawItemSymbol = item.currencySymbol || (!looksLikeCurrencyCode(item.currency) ? item.currency : "");
    const itemSymbol = rawItemSymbol === "$" && currencyCode
      ? ""
      : rawItemSymbol;
    const symbol = itemSymbol || sharedCurrencySymbolForCode(currencyCode);
    return {
      id:       String(item.id || item.variantId || ""),
      variantId: item.variantId || item.id || "",
      handle:   item.handle || "",
      title:    item.title || "Product",
      variant:  item.variant || "",
      imageUrl: item.image || item.imageUrl || "",
      image:    item.image || item.imageUrl || "",
      priceAmount: parseMoneyAmount(item.price ?? item.priceAmount),
      priceCurrency: currencyCode,
      price:    item.price
        ? formatSharedMoney(item.price, currencyCode || symbol)
        : "",
      quantity: item.quantity || 1,
    };
  });

  const subtotal = (capturedItems || []).reduce(
    (sum, item) => sum + parseMoneyAmount(item.price ?? item.priceAmount) * (item.quantity || 1),
    0
  );
  const total = parseFloat(subtotal.toFixed(2));
  const detectedOrderReference =
    normalizeAnyOrderReference(explicitOrderNumber) ||
    normalizeAnyOrderReference(extractOrderNumber(url));
  const orderNumber = isSyntheticOrderReference(detectedOrderReference)
    ? ""
    : normalizeOrderNumber(detectedOrderReference);
  const currencySymbol = sharedCurrencySymbolForCode(firstCurrencyCode);

  return {
    id:             orderNumber || String(url || ""),
    orderNumber,
    name:           orderNumber,
    checkoutOrderReference: detectedOrderReference && detectedOrderReference !== orderNumber
      ? detectedOrderReference
      : "",
    statusUrl:      String(url || ""),
    orderDate:      fmt(today),
    placedAt:       today.toISOString(),
    placedOn:       fmt(today),
    status:         "",
    deliveryMethod: "",
    arrival:        "",
    subtotal,
    total,
    currencyCode:   firstCurrencyCode || "",
    currencySymbol,
    needsStoreRefresh: true,
    lineItems,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncShopifyOrderWithRetry = async ({ order, customerAccessToken, attempts = 4 } = {}) => {
  let latest = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      latest = await fetchShopifyOrderDetails({ order, customerAccessToken });
      const syncedOrderNumber = normalizeOrderNumber(latest?.orderNumber || latest?.name);
      if (syncedOrderNumber || latest?.adminOrderId || latest?.adminGraphqlApiId) {
        return {
          ...order,
          ...latest,
          orderNumber: syncedOrderNumber || normalizeOrderNumber(order.orderNumber || order.name),
          name: syncedOrderNumber || normalizeOrderNumber(order.name || order.orderNumber),
          needsStoreRefresh: false,
        };
      }
    } catch (error) {
      console.warn(`${CHECKOUT_WEBVIEW_LOG} Shopify order sync failed`, {
        attempt: attempt + 1,
        message: error?.message || String(error),
      });
    }
    await sleep(900 * (attempt + 1));
  }
  return {
    ...order,
    ...(latest || {}),
    orderNumber: normalizeOrderNumber(latest?.orderNumber || latest?.name || order?.orderNumber),
    name: normalizeOrderNumber(latest?.name || latest?.orderNumber || order?.name || order?.orderNumber),
  };
};

// ── URL-based order detection ─────────────────────────────────────────────────
// Covers all known Shopify thank-you URL patterns across checkout versions.
const isOrderCompleteUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("thank_you")         ||
    lower.includes("thankyou")          ||
    lower.includes("thank-you")         ||
    lower.includes("order_status")      ||
    lower.includes("order-status")      ||
    lower.includes("order_confirmed")   ||
    lower.includes("order-confirmed")   ||
    lower.includes("order_confirmation")||
    lower.includes("order-confirmation")||
    lower.includes("payment_success")   ||
    lower.includes("payment_successful")||
    lower.includes("checkout/success")  ||
    lower.includes("order_placed")      ||
    // Shopify classic: /checkouts/{token}/thank_you
    /\/checkouts\/[^/]+\/thank_you/.test(lower) ||
    // Shopify new checkout: /co/thankyou or /co/thank-you
    /\/co\/thank/.test(lower)           ||
    // Shopify order page after auth
    /\/orders\/[a-z0-9]+(\?|$|\/)/.test(lower)
  );
};

// ── DOM-based order detection (JavaScript injected into every page) ───────────
// Detects the Shopify confirmation screen by page content, not just URL.
// This fires on pages that reach "Your order is confirmed" via SPA navigation
// without a URL change — which is exactly what newer Shopify checkout does.
const DETECT_ORDER_JS = `
(function() {
  function isSyntheticOrderName(value) {
    var raw = String(value || '').replace(/^#\\s*/, '').trim();
    return /^(?:ORD|ORDER)[-_]?\\d+/i.test(raw);
  }

  function normalizeOrderName(value) {
    var raw = String(value || '').replace(/\\s+/g, ' ').trim();
    if (!raw) return '';
    var matches = [];
    var patterns = [
      /order\\s*(?:number|no\\.?)?\\s*#\\s*([A-Za-z0-9-]+)/ig,
      /order\\s*(?:number|no\\.?)\\s+([A-Za-z0-9-]+)/ig,
      /#\\s*([A-Za-z0-9-]+)/g
    ];
    for (var p = 0; p < patterns.length; p += 1) {
      var pattern = patterns[p];
      var match;
      while ((match = pattern.exec(raw)) !== null) {
        if (match[1]) matches.push('#' + match[1]);
      }
    }
    if (!matches.length) return '';
    for (var i = 0; i < matches.length; i += 1) {
      if (!isSyntheticOrderName(matches[i])) return matches[i];
    }
    return matches[0];
  }

  function extractOrderName() {
    try {
      var syntheticFallback = '';
      var attrNode = document.querySelector('[data-order-number], [data-order-name], [data-testid*="order-number"], [class*="order-number"], .os-order-number');
      var attrValue = attrNode && (
        attrNode.getAttribute('data-order-number') ||
        attrNode.getAttribute('data-order-name') ||
        attrNode.getAttribute('aria-label') ||
        attrNode.textContent
      );
      var fromAttr = normalizeOrderName(attrValue);
      if (fromAttr && !isSyntheticOrderName(fromAttr)) return fromAttr;
      if (fromAttr) syntheticFallback = fromAttr;

      var candidates = [];
      var selectors = ['h1', 'h2', '.os-header__title', '.os-header__heading', '.os-order-number', '[role="heading"]', 'main'];
      for (var i = 0; i < selectors.length; i += 1) {
        var nodes = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < nodes.length; j += 1) {
          candidates.push(nodes[j].innerText || nodes[j].textContent || '');
        }
      }
      var bodyText = document.body ? (document.body.innerText || '') : '';
      candidates.push(bodyText.slice(0, 2000));
      for (var k = 0; k < candidates.length; k += 1) {
        var found = normalizeOrderName(candidates[k]);
        if (found && !isSyntheticOrderName(found)) return found;
        if (found && !syntheticFallback) syntheticFallback = found;
      }
      if (syntheticFallback) return syntheticFallback;
    } catch(e) {}
    return '';
  }

  function postComplete(url) {
    try {
      var orderNumber = extractOrderName();
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'SHOPIFY_ORDER_COMPLETE',
          url: url || window.location.href,
          orderNumber: orderNumber
        })
      );
    } catch(e) {}
  }

  function check() {
    try {
      var url  = window.location.href.toLowerCase();
      var title = (document.title || '').toLowerCase();

      // URL-based signals
      var urlMatch =
        url.includes('thank_you') || url.includes('thankyou') ||
        url.includes('thank-you') || url.includes('order_status') ||
        url.includes('order_confirmed') || url.includes('order_confirmation') ||
        url.includes('payment_success') || /\\/co\\/thank/.test(url) ||
        /\\/checkouts\\/[^\\/]+\\/thank_you/.test(url) ||
        /\\/orders\\/[a-z0-9]+(\\?|$|\\/)/.test(url);

      if (urlMatch) { postComplete(window.location.href); return; }

      // Content-based signals (works when URL doesn't change)
      var txt = document.body ? (document.body.innerText || '').toLowerCase() : '';
      var contentMatch =
        txt.includes('your order is confirmed') ||
        txt.includes('thank you for your order') ||
        txt.includes('order is confirmed')       ||
        txt.includes('order confirmed')          ||
        txt.includes('order has been placed')    ||
        txt.includes('order has been received')  ||
        txt.includes('your order has been placed') ||
        !!document.querySelector('[data-order-number]') ||
        !!document.querySelector('.os-header__heading') ||
        !!document.querySelector('.os-header') ||
        !!document.querySelector('[class*="thankYou"], [class*="thank-you"], [class*="order-confirmed"]') ||
        (title.includes('thank you') || title.includes('order confirmed'));

      if (contentMatch) { postComplete(window.location.href); }
    } catch(e) {}
  }

  // Run immediately after page loads
  check();
  // Also run after short delays to catch SPA re-renders
  setTimeout(check, 1000);
  setTimeout(check, 2500);
  setTimeout(check, 5000);

  // Watch for DOM mutations (SPA navigation changes content without URL change)
  try {
    var observer = new MutationObserver(function() { check(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}

  true; // Required return value for RN injectedJavaScript
})();
`;

const isCheckoutAccountLoginUrl = (url = "") => {
  const lower = String(url || "").toLowerCase();
  return (
    lower.includes("/account/login") ||
    lower.includes("/account/register") ||
    lower.includes("/customer/login") ||
    lower.includes("/customers/sign_in")
  );
};

const isCheckoutCartPageUrl = (url = "") => {
  const raw = String(url || "").trim();
  if (!raw || /^(about:blank|data:|javascript:)/i.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    return /^\/cart\/?$/i.test(parsed.pathname);
  } catch (_) {
    return /(^|https?:\/\/[^/]+)\/cart\/?([?#]|$)/i.test(raw);
  }
};

const HIDE_CHECKOUT_CART_JS = `
(function() {
  if (window.__MOBIDRAG_CHECKOUT_CART_GUARD__) {
    try { window.__MOBIDRAG_CHECKOUT_CART_GUARD__.apply(); } catch(e) {}
    return true;
  }

  function normalise(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function postBlocked(reason, href) {
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'MOBIDRAG_CHECKOUT_CART_SUPPRESSED',
          reason: reason || '',
          href: href || window.location.href
        })
      );
    } catch(e) {}
  }

  function isCartPageHref(href) {
    var raw = normalise(href);
    if (!raw || /^(#|javascript:|mailto:|tel:)/i.test(raw)) return false;
    try {
      var url = new URL(raw, window.location.href);
      return /^\\/cart\\/?$/i.test(url.pathname);
    } catch(e) {
      return /(^|https?:\\/\\/[^/]+)\\/cart\\/?([?#]|$)/i.test(raw);
    }
  }

  function isCheckoutHeaderControl(node) {
    if (!node || !node.closest) return false;
    if (node.closest('header, [role="banner"], [class*="header"], [class*="Header"], [data-testid*="header"], [data-testid*="Header"], .banner, [class*="banner"], [class*="Banner"]')) {
      return true;
    }
    try {
      var rect = node.getBoundingClientRect && node.getBoundingClientRect();
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var headerLimit = Math.max(96, Math.min(220, (window.innerHeight || 0) * 0.22 || 160));
      return !!rect &&
        rect.top >= -4 &&
        rect.top <= headerLimit &&
        rect.left >= viewportWidth * 0.55 &&
        rect.width <= 120 &&
        rect.height <= 120;
    } catch(e) {
      return false;
    }
  }

  function looksLikeCartControl(node) {
    if (!node) return false;
    var href = normalise(node.getAttribute && node.getAttribute('href'));
    var action = normalise(node.getAttribute && node.getAttribute('action'));
    var aria = normalise(node.getAttribute && node.getAttribute('aria-label')).toLowerCase();
    var title = normalise(node.getAttribute && node.getAttribute('title')).toLowerCase();
    var data = normalise(node.getAttribute && node.getAttribute('data-testid')).toLowerCase();
    var classes = normalise(node.className && node.className.baseVal ? node.className.baseVal : node.className).toLowerCase();
    var id = normalise(node.id).toLowerCase();
    var label = [aria, title, data, classes, id].join(' ');
    var cartTarget = isCartPageHref(href) || isCartPageHref(action);
    var cartLabel = /\\b(cart|bag|basket)\\b/.test(label);
    return (cartTarget || cartLabel) && isCheckoutHeaderControl(node);
  }

  function hideNode(node) {
    if (!node || node.getAttribute('data-mobidrag-checkout-cart-hidden') === 'true') return;
    try {
      node.setAttribute('data-mobidrag-checkout-cart-hidden', 'true');
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
    } catch(e) {}
  }

  function ensureStyle() {
    try {
      if (document.getElementById('mobidrag-checkout-cart-hide-style')) return;
      var style = document.createElement('style');
      style.id = 'mobidrag-checkout-cart-hide-style';
      style.textContent = [
        'header a[href="/cart"], header a[href^="/cart?"], header a[href$="/cart"] { display: none !important; visibility: hidden !important; pointer-events: none !important; }',
        '[role="banner"] a[href="/cart"], [role="banner"] a[href^="/cart?"], [role="banner"] a[href$="/cart"] { display: none !important; visibility: hidden !important; pointer-events: none !important; }'
      ].join('\\n');
      (document.head || document.documentElement).appendChild(style);
    } catch(e) {}
  }

  function applyCheckoutCartGuard() {
    ensureStyle();
    try {
      var nodes = document.querySelectorAll('a[href], button, [role="button"], form[action]');
      for (var i = 0; i < nodes.length; i += 1) {
        if (looksLikeCartControl(nodes[i])) hideNode(nodes[i]);
      }
    } catch(e) {}
  }

  function interceptClick(event) {
    try {
      var target = event.target && event.target.closest && event.target.closest('a[href], button, [role="button"], form[action]');
      if (!looksLikeCartControl(target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation && event.stopImmediatePropagation();
      postBlocked('checkout-header-cart-click', target.getAttribute('href') || target.getAttribute('action') || '');
    } catch(e) {}
  }

  window.__MOBIDRAG_CHECKOUT_CART_GUARD__ = { apply: applyCheckoutCartGuard };
  document.addEventListener('click', interceptClick, true);
  applyCheckoutCartGuard();
  setTimeout(applyCheckoutCartGuard, 250);
  setTimeout(applyCheckoutCartGuard, 1000);
  setTimeout(applyCheckoutCartGuard, 2500);

  try {
    var observer = new MutationObserver(applyCheckoutCartGuard);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'action', 'aria-label', 'class', 'data-testid']
    });
  } catch(e) {}

  true;
})();
`;

const buildCheckoutBrandAndEmailJs = ({ hideCheckoutLogo, prefillCheckoutEmail, customerEmail }) => {
  const safeEmail = String(customerEmail || "").trim();
  const shouldPrefillEmail = Boolean(prefillCheckoutEmail && safeEmail);
  const shouldHideLogo = hideCheckoutLogo !== false;

  return `
(function() {
  var hideCheckoutLogo = ${JSON.stringify(shouldHideLogo)};
  var shouldPrefillEmail = ${JSON.stringify(shouldPrefillEmail)};
  var customerEmail = ${JSON.stringify(safeEmail)};

  if (window.__MOBIDRAG_CHECKOUT_BRAND_EMAIL__) {
    try { window.__MOBIDRAG_CHECKOUT_BRAND_EMAIL__.apply(); } catch(e) {}
    return true;
  }

  function normalise(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function post(type, payload) {
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify(Object.assign({ type: type }, payload || {}))
      );
    } catch(e) {}
  }

  function isRootHref(href) {
    var raw = normalise(href);
    if (!raw || /^(#|javascript:|mailto:|tel:)/i.test(raw)) return false;
    try {
      var url = new URL(raw, window.location.href);
      return /^\\/?$/i.test(url.pathname || '/') && url.hostname === window.location.hostname;
    } catch(e) {
      return raw === '/' || raw === window.location.origin || raw === window.location.origin + '/';
    }
  }

  function isHeaderArea(node) {
    if (!node) return false;
    if (node.closest && node.closest('header, [role="banner"], [class*="header"], [class*="Header"], [data-testid*="header"], [data-testid*="Header"], .banner, [class*="banner"], [class*="Banner"]')) {
      return true;
    }
    try {
      var rect = node.getBoundingClientRect && node.getBoundingClientRect();
      var headerLimit = Math.max(110, Math.min(240, (window.innerHeight || 0) * 0.25 || 160));
      return !!rect && rect.top >= -8 && rect.top <= headerLimit;
    } catch(e) {
      return false;
    }
  }

  function looksLikeLogo(node) {
    if (!node || !isHeaderArea(node)) return false;
    var hrefNode = node.closest && node.closest('a[href]');
    if (hrefNode && isRootHref(hrefNode.getAttribute('href'))) return true;
    var text = [
      normalise(node.getAttribute && node.getAttribute('alt')),
      normalise(node.getAttribute && node.getAttribute('aria-label')),
      normalise(node.getAttribute && node.getAttribute('title')),
      normalise(node.getAttribute && node.getAttribute('data-testid')),
      normalise(node.className && node.className.baseVal ? node.className.baseVal : node.className),
      normalise(node.id)
    ].join(' ').toLowerCase();
    return /\\b(logo|brand|store-logo|site-logo)\\b/.test(text);
  }

  function hideNode(node) {
    if (!node || node.getAttribute('data-mobidrag-checkout-logo-hidden') === 'true') return;
    try {
      node.setAttribute('data-mobidrag-checkout-logo-hidden', 'true');
      node.setAttribute('aria-hidden', 'true');
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
    } catch(e) {}
  }

  function applyLogoGuard() {
    if (!hideCheckoutLogo) return;
    try {
      if (!document.getElementById('mobidrag-checkout-logo-hide-style')) {
        var style = document.createElement('style');
        style.id = 'mobidrag-checkout-logo-hide-style';
        style.textContent = [
          'header a[href="/"], header a[href="' + window.location.origin + '/"] { display: none !important; visibility: hidden !important; pointer-events: none !important; }',
          '[role="banner"] a[href="/"], [role="banner"] a[href="' + window.location.origin + '/"] { display: none !important; visibility: hidden !important; pointer-events: none !important; }'
        ].join('\\n');
        (document.head || document.documentElement).appendChild(style);
      }

      var nodes = document.querySelectorAll('header a[href], [role="banner"] a[href], a[href] img, a[href] svg, img, svg, [class*="logo"], [class*="Logo"], [data-testid*="logo"], [data-testid*="Logo"]');
      for (var i = 0; i < nodes.length; i += 1) {
        var candidate = nodes[i];
        var anchor = candidate.closest && candidate.closest('a[href]');
        if (anchor && isRootHref(anchor.getAttribute('href')) && isHeaderArea(anchor)) {
          hideNode(anchor);
          continue;
        }
        if (looksLikeLogo(candidate)) {
          hideNode(anchor || candidate);
        }
      }
    } catch(e) {}
  }

  function setNativeValue(input, value) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      var setter = descriptor && descriptor.set;
      if (setter) setter.call(input, value);
      else input.value = value;
    } catch(e) {
      input.value = value;
    }
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch(e) {}
  }

  function looksLikeEmailInput(input) {
    if (!input || String(input.tagName || '').toLowerCase() !== 'input') return false;
    var attrs = [
      normalise(input.type),
      normalise(input.name),
      normalise(input.id),
      normalise(input.autocomplete),
      normalise(input.placeholder),
      normalise(input.getAttribute && input.getAttribute('aria-label'))
    ].join(' ').toLowerCase();
    return /email|e-mail|checkout\\[email\\]|customer_email/.test(attrs);
  }

  function applyEmailPrefill() {
    if (!shouldPrefillEmail || !customerEmail) return;
    try {
      var inputs = document.querySelectorAll('input[type="email"], input[name="email"], input[name="checkout[email]"], input[id*="email"], input[id*="Email"], input[autocomplete="email"], input[placeholder*="mail"], input[placeholder*="Mail"], input[aria-label*="mail"], input[aria-label*="Mail"]');
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        if (!looksLikeEmailInput(input)) continue;
        var current = normalise(input.value);
        if (current && current.toLowerCase() !== customerEmail.toLowerCase()) continue;
        if (current === customerEmail) continue;
        setNativeValue(input, customerEmail);
        input.setAttribute('data-mobidrag-email-prefilled', 'true');
        post('MOBIDRAG_CHECKOUT_EMAIL_PREFILLED', {});
      }
    } catch(e) {}
  }

  function interceptLogoClick(event) {
    if (!hideCheckoutLogo) return;
    try {
      var target = event.target && event.target.closest && event.target.closest('a[href]');
      if (!target || !isRootHref(target.getAttribute('href')) || !isHeaderArea(target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation && event.stopImmediatePropagation();
      hideNode(target);
      post('MOBIDRAG_CHECKOUT_LOGO_SUPPRESSED', { href: target.getAttribute('href') || '' });
    } catch(e) {}
  }

  function apply() {
    applyLogoGuard();
    applyEmailPrefill();
  }

  window.__MOBIDRAG_CHECKOUT_BRAND_EMAIL__ = { apply: apply };
  document.addEventListener('click', interceptLogoClick, true);
  apply();
  setTimeout(apply, 250);
  setTimeout(apply, 1000);
  setTimeout(apply, 2500);
  setTimeout(apply, 5000);

  try {
    var observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'class', 'id', 'alt', 'aria-label', 'placeholder', 'type', 'name', 'autocomplete', 'data-testid']
    });
  } catch(e) {}

  true;
})();
`;
};

const buildCheckoutSessionJs = ({ isLoggedIn, customerName, customerEmail }) => {
  if (!isLoggedIn) return "";
  const displayValue = customerName || customerEmail || "";
  const displayLabel = displayValue ? `Signed in as ${displayValue}` : "Signed in";

  return `
(function() {
  var displayLabel = ${JSON.stringify(displayLabel)};

  function normalise(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function looksLikeCheckoutSignIn(node) {
    if (!node || node.getAttribute('data-mobidrag-session-state') === 'true') return false;
    var text = normalise(node.innerText || node.textContent).toLowerCase();
    var href = normalise(node.getAttribute && node.getAttribute('href')).toLowerCase();
    var aria = normalise(node.getAttribute && node.getAttribute('aria-label')).toLowerCase();
    var title = normalise(node.getAttribute && node.getAttribute('title')).toLowerCase();
    var label = text || aria || title;
    var loginText = /^(sign in|log in|login)$/.test(label) || /\\b(sign in|log in)\\b/.test(label);
    var accountTarget = /account|customer|login|sign[_-]?in/.test(href + ' ' + aria + ' ' + title);
    return loginText && (accountTarget || label.length <= 32);
  }

  function replaceSignIn(node) {
    if (!looksLikeCheckoutSignIn(node)) return;
    var badge = document.createElement('div');
    badge.setAttribute('data-mobidrag-session-state', 'true');
    badge.setAttribute('role', 'status');
    badge.textContent = displayLabel;
    badge.style.cssText = 'font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;line-height:20px;margin:6px 0;';
    try {
      node.replaceWith(badge);
    } catch(e) {
      try {
        node.style.display = 'none';
        node.parentNode && node.parentNode.appendChild(badge);
      } catch(_) {}
    }
  }

  function applySessionState() {
    try {
      var nodes = document.querySelectorAll('a, button');
      for (var i = 0; i < nodes.length; i += 1) {
        replaceSignIn(nodes[i]);
      }
    } catch(e) {}
  }

  applySessionState();
  setTimeout(applySessionState, 500);
  setTimeout(applySessionState, 1500);

  try {
    var observer = new MutationObserver(applySessionState);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}

  true;
})();
`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutWebViewScreen() {
  const navigation        = useNavigation();
  const route             = useRoute();
  const { session, initializing } = useAuth();
  const cartItems         = useSelector((state) => state.cart?.items || []);

  const rawCheckoutUrl = route?.params?.url;
  const checkoutUrl = useMemo(
    () => normalizeCheckoutUrl(rawCheckoutUrl),
    [rawCheckoutUrl]
  );
  const headerTitle = route?.params?.title || "Checkout";
  const prefillCheckoutEmail = route?.params?.prefillCheckoutEmail !== false;
  const hideCheckoutLogo = route?.params?.hideCheckoutLogo !== false;
  const sessionCustomerEmail = pickSessionCustomerEmail(session);
  const hasAuthenticatedSession = isAuthenticatedSession(session);
  const checkoutCustomerEmail = prefillCheckoutEmail
    ? (route?.params?.customerEmail || sessionCustomerEmail || "")
    : "";
  const checkoutCustomerName = route?.params?.customerName || session?.user?.name || checkoutCustomerEmail;
  const checkoutIsLoggedIn = hasAuthenticatedSession;

  const [isLoading,  setIsLoading]  = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [canGoBack,  setCanGoBack]  = useState(false);

  const webViewRef           = useRef(null);
  const hasCompletedOrderRef = useRef(false);
  const completionTimerRef   = useRef(null);
  const pendingCompletionRef = useRef(null);
  const capturedItemsRef     = useRef(cartItems);
  const lastWebViewUrlRef    = useRef("");
  const lastWebViewErrorRef  = useRef(null);

  const resolvedAppId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const userId = session?.user?.id ?? session?.user?.userId ?? null;
  const checkoutSessionJs = useMemo(
    () => buildCheckoutSessionJs({
      isLoggedIn: checkoutIsLoggedIn,
      customerName: checkoutCustomerName,
      customerEmail: checkoutCustomerEmail,
    }),
    [checkoutCustomerEmail, checkoutCustomerName, checkoutIsLoggedIn]
  );
  const checkoutBrandAndEmailJs = useMemo(
    () => buildCheckoutBrandAndEmailJs({
      hideCheckoutLogo,
      prefillCheckoutEmail,
      customerEmail: checkoutCustomerEmail,
    }),
    [checkoutCustomerEmail, hideCheckoutLogo, prefillCheckoutEmail]
  );
  const checkoutBeforeContentJs = useMemo(
    () => `${checkoutSessionJs}\n${checkoutBrandAndEmailJs}\n${HIDE_CHECKOUT_CART_JS}\ntrue;`,
    [checkoutBrandAndEmailJs, checkoutSessionJs]
  );
  const injectedCheckoutJs = useMemo(
    () => `${checkoutBeforeContentJs}\n${DETECT_ORDER_JS}\ntrue;`,
    [checkoutBeforeContentJs]
  );

  useEffect(() => {
    console.log(`${CHECKOUT_WEBVIEW_LOG} open`, {
      rawUrl: rawCheckoutUrl || "",
      url: checkoutUrl || "",
      title: headerTitle,
      itemCount: cartItems.length,
      appId: resolvedAppId || "",
      isLoggedIn: checkoutIsLoggedIn,
      hasCustomerEmail: !!checkoutCustomerEmail,
      hideCheckoutLogo,
      prefillCheckoutEmail,
    });
    if (rawCheckoutUrl && rawCheckoutUrl !== checkoutUrl) {
      console.log(`${CHECKOUT_WEBVIEW_LOG} normalized checkout URL`, {
        rawUrl: rawCheckoutUrl,
        url: checkoutUrl,
      });
    }
    if (!checkoutUrl) {
      console.warn(`${CHECKOUT_WEBVIEW_LOG} missing checkout URL`, {
        routeParams: Object.keys(route?.params || {}),
      });
    }
  }, [
    cartItems.length,
    checkoutCustomerEmail,
    checkoutIsLoggedIn,
    checkoutUrl,
    headerTitle,
    hideCheckoutLogo,
    prefillCheckoutEmail,
    rawCheckoutUrl,
    resolvedAppId,
    route?.params,
  ]);

  useEffect(() => {
    if (initializing || hasAuthenticatedSession) return;
    console.warn(`${CHECKOUT_WEBVIEW_LOG} blocked unauthenticated checkout webview`);
    navigation.reset({
      index: 0,
      routes: [{
        name: "Auth",
        params: {
          initialMode: "login",
          requireAuth: true,
          postLoginTarget: {
            name: "BottomNavScreen",
            params: { pageName: "cart", title: "Cart" },
          },
        },
      }],
    });
  }, [hasAuthenticatedSession, initializing, navigation]);

  const completeOrderNow = useCallback(
    async (completedUrl, detectedOrderNumber = "") => {
      if (hasCompletedOrderRef.current) return;
      if (!hasAuthenticatedSession) {
        console.warn(`${CHECKOUT_WEBVIEW_LOG} ignored unauthenticated order completion`);
        return;
      }
      hasCompletedOrderRef.current = true;

      const capturedItems = capturedItemsRef.current || [];
      const storeCurrency = getStoreConfigSync()?.currency || "";
      const fallbackOrder = buildOrderFromCart(
        capturedItems,
        completedUrl || "",
        storeCurrency,
        detectedOrderNumber
      );
      const customerAccessToken = pickSessionCustomerAccessToken(session);
      const order = await syncShopifyOrderWithRetry({
        order: fallbackOrder,
        customerAccessToken,
      });
      const orderNumber = normalizeOrderNumber(order.orderNumber || order.name);

      triggerOrderNotification({
        type:        ORDER_EVENTS.ORDER_PLACED,
        orderNumber,
        orderId:     order.adminOrderId || order.adminGraphqlApiId || order.id || order.checkoutOrderReference || null,
        appId:       resolvedAppId,
        userId,
      }).catch(() => {});

      saveCompletedOrder({
        appId: resolvedAppId,
        userId,
        email: session?.user?.email || "",
        order,
      }).catch(() => {});
      trackPurchase(order, capturedItems, { session }).catch(() => {});

      // Small delay so the WebView finishes its last render before we leave
      setTimeout(() => {
        navigation.reset({
          index:  0,
          routes: [{
            name:   "PostPurchase",
            params: {
              capturedItems: capturedItemsRef.current || [],
              appId:         resolvedAppId,
              order,
              orderNumber,
              orderTotal:    order.total,
              authenticatedCheckout: true,
            },
          }],
        });
      }, 600);
    },
    [hasAuthenticatedSession, navigation, resolvedAppId, session, userId]
  );

  // ── Shared order-complete handler (used by URL detection AND JS injection) ──
  const handleOrderComplete = useCallback(
    (completedUrl, detectedOrderNumber = "") => {
      if (hasCompletedOrderRef.current) return;

      const normalizedDetectedOrderNumber = normalizeOrderNumber(detectedOrderNumber);
      if (completionTimerRef.current && !normalizedDetectedOrderNumber) {
        return;
      }

      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }

      if (!normalizedDetectedOrderNumber) {
        pendingCompletionRef.current = {
          url: completedUrl || "",
          orderNumber: "",
        };
        completionTimerRef.current = setTimeout(() => {
          const pending = pendingCompletionRef.current || {};
          completionTimerRef.current = null;
          pendingCompletionRef.current = null;
          completeOrderNow(pending.url || completedUrl || "", pending.orderNumber || "");
        }, PENDING_ORDER_NUMBER_DELAY_MS);
        return;
      }

      pendingCompletionRef.current = null;
      completeOrderNow(completedUrl || "", normalizedDetectedOrderNumber);
    },
    [completeOrderNow]
  );

  useEffect(() => () => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
  }, []);

  // ── Back handling ─────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    console.log(`${CHECKOUT_WEBVIEW_LOG} close checkout`, {
      canGoBack,
      lastUrl: lastWebViewUrlRef.current || checkoutUrl || "",
    });
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate("LayoutScreen", { pageName: "home", activeIndex: 0 });
    }
    return true;
  }, [canGoBack, checkoutUrl, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // ── URL-based order detection ─────────────────────────────────────────────
  const handleNavigationStateChange = useCallback(
    (navState) => {
      setCanGoBack(!!navState?.canGoBack);
      if (navState?.url && navState.url !== lastWebViewUrlRef.current) {
        lastWebViewUrlRef.current = navState.url;
        console.log(`${CHECKOUT_WEBVIEW_LOG} navigation`, {
          url: navState.url,
          canGoBack: !!navState?.canGoBack,
          loading: !!navState?.loading,
          title: navState?.title || "",
        });
      }
      if (!navState?.url || hasCompletedOrderRef.current) return;
      if (isOrderCompleteUrl(navState.url)) {
        handleOrderComplete(navState.url);
      }
    },
    [handleOrderComplete]
  );

  // ── DOM-based order detection (message from injected JS) ─────────────────
  const handleWebViewMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "MOBIDRAG_CHECKOUT_CART_SUPPRESSED") {
          console.log(`${CHECKOUT_WEBVIEW_LOG} blocked checkout cart control`, {
            reason: data.reason || "",
            href: data.href || "",
          });
          return;
        }
        if (data?.type === "MOBIDRAG_CHECKOUT_LOGO_SUPPRESSED") {
          console.log(`${CHECKOUT_WEBVIEW_LOG} blocked checkout logo`, {
            href: data.href || "",
          });
          return;
        }
        if (data?.type === "MOBIDRAG_CHECKOUT_EMAIL_PREFILLED") {
          console.log(`${CHECKOUT_WEBVIEW_LOG} checkout email prefilled`);
          return;
        }
        if (data?.type === "SHOPIFY_ORDER_COMPLETE") {
          handleOrderComplete(data.url || checkoutUrl || "", data.orderNumber || "");
        }
      } catch (_) {}
    },
    [handleOrderComplete, checkoutUrl]
  );

  // ── WebView loading states ────────────────────────────────────────────────
  const handleLoadStart = useCallback((event) => {
    const summary = summarizeWebViewEvent(event);
    if (summary.url) lastWebViewUrlRef.current = summary.url;
    console.log(`${CHECKOUT_WEBVIEW_LOG} load start`, summary);
    setIsLoading(true);
    setLoadError(false);
  }, []);

  const handleLoadEnd = useCallback((event) => {
    console.log(`${CHECKOUT_WEBVIEW_LOG} load end`, summarizeWebViewEvent(event));
    setIsLoading(false);
  }, []);

  const handleError = useCallback((event) => {
    const summary = summarizeWebViewEvent(event);
    lastWebViewErrorRef.current = summary;
    console.warn(`${CHECKOUT_WEBVIEW_LOG} load error`, summary);
    setIsLoading(false);
    setLoadError(true);
  }, []);

  const handleHttpError = useCallback((event) => {
    const summary = summarizeWebViewEvent(event);
    lastWebViewErrorRef.current = summary;
    console.warn(`${CHECKOUT_WEBVIEW_LOG} HTTP error`, summary);
    setIsLoading(false);
    setLoadError(true);
  }, []);

  const handleRetry = useCallback(() => {
    console.log(`${CHECKOUT_WEBVIEW_LOG} retry`, {
      url: lastWebViewUrlRef.current || checkoutUrl || "",
      lastError: lastWebViewErrorRef.current,
    });
    setLoadError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, [checkoutUrl]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request) => {
      const requestedUrl = normalizeCheckoutUrl(request?.url);
      if (isCheckoutCartPageUrl(requestedUrl) && requestedUrl !== checkoutUrl) {
        console.log(`${CHECKOUT_WEBVIEW_LOG} blocked checkout cart navigation`, {
          url: requestedUrl || "",
        });
        return false;
      }
      if (checkoutIsLoggedIn && isCheckoutAccountLoginUrl(request?.url)) {
        console.log(`${CHECKOUT_WEBVIEW_LOG} blocked checkout login redirect`, {
          url: request?.url || "",
        });
        return false;
      }
      if (hideCheckoutLogo && isStorefrontRootUrl(requestedUrl, checkoutUrl, lastWebViewUrlRef.current)) {
        console.log(`${CHECKOUT_WEBVIEW_LOG} blocked checkout logo navigation`, {
          url: requestedUrl || "",
        });
        return false;
      }
      return true;
    },
    [checkoutIsLoggedIn, checkoutUrl, hideCheckoutLogo]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (initializing || !hasAuthenticatedSession) {
    return (
      <SafeArea>
        <View style={styles.centreWrap}>
          <ActivityIndicator color="#0EA5E9" size="large" />
          <Text style={styles.loadingText}>Checking account...</Text>
        </View>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HeaderIcon name="arrow-left-long" size={18} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={styles.backButton} />
        </View>

        {!checkoutUrl ? (
          <View style={styles.centreWrap}>
            <FontAwesome name="exclamation-circle" size={40} color="#EF4444" />
            <Text style={styles.errorText}>Checkout link unavailable.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleBack}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : loadError ? (
          <View style={styles.centreWrap}>
            <FontAwesome name="wifi" size={40} color="#9CA3AF" />
            <Text style={styles.errorText}>Failed to load checkout page.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            <WebView
              ref={webViewRef}
              source={{ uri: checkoutUrl }}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleHttpError}
              onNavigationStateChange={handleNavigationStateChange}
              onMessage={handleWebViewMessage}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              injectedJavaScriptBeforeContentLoaded={checkoutBeforeContentJs}
              injectedJavaScript={injectedCheckoutJs}
              startInLoadingState={false}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsBackForwardNavigationGestures
              style={styles.webView}
            />

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#0EA5E9" size="large" />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    minHeight:         56,
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor:   "#ffffff",
  },
  backButton: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  title: {
    flex:       1,
    textAlign:  "center",
    fontSize:   20,
    fontWeight: "700",
    color:      "#111827",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  webViewContainer: {
    flex:            1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          10,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             12,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  loadingText: {
    textAlign: "center",
    color:     "#374151",
    fontSize:  15,
  },
  centreWrap: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               16,
  },
  errorText: {
    color:     "#374151",
    fontSize:  15,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical:   10,
    paddingHorizontal: 28,
    borderRadius:      8,
    backgroundColor:   "#111827",
  },
  retryBtnText: {
    color:      "#FFFFFF",
    fontWeight: "600",
    fontSize:   14,
  },
});
