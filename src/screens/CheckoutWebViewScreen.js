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
import { resolveAppId } from "../utils/appId";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";
import { saveCompletedOrder } from "../services/orderHistoryService";
import { getStoreConfigSync } from "../services/storeService";
import { fetchShopifyOrderDetails } from "../services/shopify";
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
} from "../utils/money";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHECKOUT_WEBVIEW_LOG = "[CheckoutWebView]";

const normalizeCheckoutUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  return raw;
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

const normalizeOrderNumber = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const orderPhrase =
    raw.match(/order\s*(?:number|no\.?)?\s*#\s*([A-Za-z0-9-]+)/i) ||
    raw.match(/order\s*(?:number|no\.?)\s+([A-Za-z0-9-]+)/i);
  const hash = raw.match(/#\s*([A-Za-z0-9-]+)/);
  const plain = raw.match(/^#?\s*([A-Za-z0-9-]+)\s*$/);
  const valuePart = orderPhrase?.[1] || hash?.[1] || plain?.[1] || "";
  return valuePart ? `#${valuePart}` : "";
};

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
      priceAmount: parseFloat(item.price || 0),
      priceCurrency: currencyCode,
      price:    item.price
        ? formatSharedMoney(item.price, currencyCode || symbol)
        : "",
      quantity: item.quantity || 1,
    };
  });

  const subtotal = (capturedItems || []).reduce(
    (sum, item) => sum + parseFloat(item.price || 0) * (item.quantity || 1),
    0
  );
  const total = parseFloat(subtotal.toFixed(2));
  const orderNumber = normalizeOrderNumber(explicitOrderNumber) || extractOrderNumber(url);
  const currencySymbol = sharedCurrencySymbolForCode(firstCurrencyCode);

  return {
    id:             orderNumber || String(url || ""),
    orderNumber,
    name:           orderNumber,
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
          orderNumber: syncedOrderNumber || order.orderNumber || latest?.orderNumber || "",
          name: latest?.name || syncedOrderNumber || order.name || "",
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
    name: latest?.name || order?.name || "",
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
  function normalizeOrderName(value) {
    var raw = String(value || '').replace(/\\s+/g, ' ').trim();
    if (!raw) return '';
    var match =
      raw.match(/order\\s*(?:number|no\\.?)?\\s*#\\s*([A-Za-z0-9-]+)/i) ||
      raw.match(/order\\s*(?:number|no\\.?)\\s+([A-Za-z0-9-]+)/i) ||
      raw.match(/#\\s*([A-Za-z0-9-]+)/);
    if (!match) return '';
    return '#' + match[1];
  }

  function extractOrderName() {
    try {
      var attrNode = document.querySelector('[data-order-number], [data-order-name], [data-testid*="order-number"], [class*="order-number"], .os-order-number');
      var attrValue = attrNode && (
        attrNode.getAttribute('data-order-number') ||
        attrNode.getAttribute('data-order-name') ||
        attrNode.getAttribute('aria-label') ||
        attrNode.textContent
      );
      var fromAttr = normalizeOrderName(attrValue);
      if (fromAttr) return fromAttr;

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
        if (found) return found;
      }
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
  const { session }       = useAuth();
  const cartItems         = useSelector((state) => state.cart?.items || []);

  const rawCheckoutUrl = route?.params?.url;
  const checkoutUrl = useMemo(
    () => normalizeCheckoutUrl(rawCheckoutUrl),
    [rawCheckoutUrl]
  );
  const headerTitle = route?.params?.title || "Checkout";
  const checkoutCustomerEmail = route?.params?.customerEmail || session?.user?.email || "";
  const checkoutCustomerName = route?.params?.customerName || session?.user?.name || checkoutCustomerEmail;
  const checkoutIsLoggedIn = Boolean(route?.params?.isLoggedIn || session?.user?.email);

  const [isLoading,  setIsLoading]  = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [canGoBack,  setCanGoBack]  = useState(false);

  const webViewRef           = useRef(null);
  const hasCompletedOrderRef = useRef(false);
  const capturedItemsRef     = useRef(cartItems);
  const lastWebViewUrlRef    = useRef("");
  const lastWebViewErrorRef  = useRef(null);

  const resolvedAppId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const userId = session?.user?.id ?? null;
  const checkoutSessionJs = useMemo(
    () => buildCheckoutSessionJs({
      isLoggedIn: checkoutIsLoggedIn,
      customerName: checkoutCustomerName,
      customerEmail: checkoutCustomerEmail,
    }),
    [checkoutCustomerEmail, checkoutCustomerName, checkoutIsLoggedIn]
  );
  const checkoutBeforeContentJs = useMemo(
    () => `${checkoutSessionJs}\n${HIDE_CHECKOUT_CART_JS}\ntrue;`,
    [checkoutSessionJs]
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
    rawCheckoutUrl,
    resolvedAppId,
    route?.params,
  ]);

  // ── Shared order-complete handler (used by URL detection AND JS injection) ──
  const handleOrderComplete = useCallback(
    async (completedUrl, detectedOrderNumber = "") => {
      if (hasCompletedOrderRef.current) return;
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
        appId:       resolvedAppId,
        userId,
      }).catch(() => {});

      saveCompletedOrder({
        appId: resolvedAppId,
        userId,
        email: session?.user?.email || "",
        order,
      }).catch(() => {});

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
            },
          }],
        });
      }, 600);
    },
    [navigation, resolvedAppId, session, userId]
  );

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
      return true;
    },
    [checkoutIsLoggedIn, checkoutUrl]
  );

  // ── Render ────────────────────────────────────────────────────────────────
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
