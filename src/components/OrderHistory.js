import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useAuth } from "../services/AuthContext";
import { fetchCustomerOrders } from "../services/shopify";
import { getStoredOrders, mergeOrdersByIdentity } from "../services/orderHistoryService";
import { isAuthenticatedSession } from "../utils/authGate";
import { getStoreConfigSync } from "../services/storeService";
import { addItem } from "../store/slices/cartSlice";
import { resolveFont } from "../services/typographyService";
import { formatMoney as formatSharedMoney, parseMoneyAmount } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { usePageEmptyStateReporter } from "../services/PageEmptyStateContext";
import { navigateToDslTarget } from "../utils/navigationTarget";

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  return value;
};

const toStr = (value, fallback = "") => {
  const unwrapped = deepUnwrap(value);
  if (unwrapped === undefined || unwrapped === null) return fallback;
  const text = String(unwrapped).trim();
  return text && text !== "undefined" && text !== "null" ? text : fallback;
};

const toNum = (value, fallback = 0) => {
  const unwrapped = deepUnwrap(value);
  if (unwrapped === undefined || unwrapped === null || unwrapped === "") return fallback;
  if (typeof unwrapped === "number") return Number.isFinite(unwrapped) ? unwrapped : fallback;
  const parsed = parseMoneyAmount(unwrapped);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  const unwrapped = deepUnwrap(value);
  if (unwrapped === undefined || unwrapped === null || unwrapped === "") return fallback;
  if (typeof unwrapped === "boolean") return unwrapped;
  if (typeof unwrapped === "number") return unwrapped !== 0;
  const normalized = String(unwrapped).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const toFontWeight = (value, fallback = "600") => {
  const raw = toStr(value, fallback).toLowerCase();
  if (/^\d+$/.test(raw)) return raw;
  if (raw === "bold") return "700";
  if (raw === "semibold" || raw === "semi bold") return "600";
  if (raw === "medium") return "500";
  if (raw === "regular" || raw === "normal") return "400";
  return fallback;
};

const getPropsNode = (section) =>
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  section?.props ||
  {};

const getRawProps = (section) => {
  const propsNode = getPropsNode(section);
  const raw = deepUnwrap(propsNode?.raw);
  return raw && typeof raw === "object" ? { ...propsNode, ...raw } : propsNode;
};

const pickCustomerAccessToken = (session) => {
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
  for (const candidate of candidates) {
    const value = toStr(candidate, "");
    if (value) return value;
  }
  return "";
};

// The real Shopify customer GID (captured at login/registration, see
// authService.ts) — fetchCustomerOrders needs this for the Admin API's
// customer(id:) lookup. customerAccessToken is kept only for the
// "is this shopper logged in at all" checks below; it was never a usable
// Shopify Storefront token (this app has no reliable Storefront Access
// Token — see the PROXY_ENDPOINT comment in services/shopify.js), so it
// can't stand in as the query argument itself.
const pickShopifyCustomerId = (session) => {
  const candidates = [
    session?.user?.shopifyCustomerId,
    session?.shopifyCustomerId,
  ];
  for (const candidate of candidates) {
    const value = toStr(candidate, "");
    if (value) return value;
  }
  return "";
};

const formatOrderMoney = (amount, order = {}, fallbackSymbol = "") => {
  const storeCurrencyCode = getStoreConfigSync()?.currency || "";
  const resolvedCode = order.currencyCode || order.priceCurrency || storeCurrencyCode;
  const orderSymbol = order.currencySymbol === "$" && resolvedCode
    ? ""
    : order.currencySymbol;
  const currency =
    orderSymbol ||
    resolvedCode ||
    fallbackSymbol;
  const value = amount === undefined || amount === null || amount === "" ? 0 : amount;
  return formatSharedMoney(value, currency);
};

const orderNumberText = (order = {}) => {
  const raw = toStr(order.orderNumber || order.name || order.id, "");
  if (!raw) return "";
  return raw.startsWith("#") ? raw : `#${raw}`;
};

const orderDateText = (order = {}) =>
  toStr(order.placedOn || order.orderDate || order.processedAt || order.placedAt, "");

const getOrderItems = (order = {}) => {
  const items = order.lineItems || order.items || order.products || [];
  return Array.isArray(items) ? items : [];
};

export default function OrderHistory({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { session } = useAuth();
  const isLoggedIn = isAuthenticatedSession(session);
  const raw = useMemo(() => getRawProps(section), [section]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const appId = session?.user?.appId || session?.user?.app_id || raw?.appId || raw?.app_id || "";
  const userId = session?.user?.id || session?.user?.userId || "";
  const email = session?.user?.email || "";
  const customerAccessToken = pickCustomerAccessToken(session);
  const shopifyCustomerId = pickShopifyCustomerId(session);
  const allowPreviewOrders = toBool(
    raw?.usePreviewOrders ?? raw?.previewOrders ?? raw?.demoOrders,
    false
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadOrders = async () => {
        setLoading(true);
        if (!isLoggedIn) {
          if (active) {
            setOrders([]);
            setLoading(false);
          }
          return;
        }
        const storedOrders = await getStoredOrders({ appId, userId, email });
        let liveOrders = [];

        if (shopifyCustomerId || email) {
          const result = await fetchCustomerOrders({
            customerId: shopifyCustomerId,
            email,
            first: Math.max(1, toNum(raw?.limit ?? raw?.itemsShown, 20)),
          });
          liveOrders = result?.orders || [];
        }

        const previewOrders = allowPreviewOrders
          ? deepUnwrap(raw?.orders ?? raw?.items) || []
          : [];
        const merged = mergeOrdersByIdentity(
          liveOrders,
          storedOrders,
          Array.isArray(previewOrders) ? previewOrders : []
        );

        if (active) {
          setOrders(merged);
          setLoading(false);
        }
      };

      loadOrders().catch(() => {
        if (active) {
          setOrders([]);
          setLoading(false);
        }
      });

      return () => {
        active = false;
      };
    }, [allowPreviewOrders, appId, customerAccessToken, shopifyCustomerId, email, isLoggedIn, raw, userId])
  );

  // Mirrors Builder's actual OrderHistory Inspector/PreviewLive field names
  // exactly (titleStyle/orderDateStyle/orderStatusStyle/orderStatusPrice/
  // orderStatusButton, plus the cont*/button*/outer-badge prop groups) —
  // this used to read a completely different, invented flat schema
  // (orderNumberColor, dateSize, buttonBgColor, ...) that Builder never
  // wrote, so none of these settings ever reached the app at all.
  const borderStyleFor = (line, color) => {
    const c = toStr(color, "#E5E7EB");
    switch (toStr(line, "none")) {
      case "all": return { borderWidth: 1, borderColor: c };
      case "top": return { borderTopWidth: 1, borderTopColor: c };
      case "bottom": return { borderBottomWidth: 1, borderBottomColor: c };
      case "left": return { borderLeftWidth: 1, borderLeftColor: c };
      case "right": return { borderRightWidth: 1, borderRightColor: c };
      default: return {};
    }
  };
  const textTransformFor = (isUppercase) => (isUppercase ? "uppercase" : "none");
  const fontFamilyStyle = (value) => {
    const family = cleanFontFamily(value);
    return family ? { fontFamily: family } : {};
  };

  const stylesFromDsl = useMemo(() => {
    const titleStyle = raw?.titleStyle ?? {};
    const orderDateStyle = raw?.orderDateStyle ?? {};
    const orderStatusStyle = raw?.orderStatusStyle ?? {};
    const orderStatusPrice = raw?.orderStatusPrice ?? {};
    const orderStatusButton = raw?.orderStatusButton ?? {};
    const buttonFormat = raw?.buttonFormat ?? {};

    const titleFontSize = toNum(titleStyle?.fontSizeOH, 16);
    const dateFontSize = toNum(orderDateStyle?.fontSizeOD, 13);
    const statusFontSize = toNum(orderStatusStyle?.fontSizeOS, 12);

    return {
      // Card container — Builder's "cont*" prop group (per-card, not the
      // whole list — Builder has no configurable outer-list-wrapper prop)
      card: {
        backgroundColor: toStr(raw?.contBackgroundColor, "#FFFFFF"),
        paddingTop: toNum(raw?.contPT, 10),
        paddingBottom: toNum(raw?.contPB, 10),
        paddingLeft: toNum(raw?.contPL, 22),
        paddingRight: toNum(raw?.contPR, 22),
        borderRadius: toNum(raw?.contCorners, 0),
        ...borderStyleFor(raw?.contBorderLine, raw?.contBorderColor),
      },
      // Order ID — titleStyle (OH suffix)
      orderNumber: {
        color: toStr(titleStyle?.colorOH, "#3F2A2A"),
        fontSize: titleFontSize,
        fontWeight: toFontWeight(titleStyle?.fontWeightOH, "600"),
        letterSpacing: toNum(titleStyle?.letterSpacingOH, 0),
        lineHeight: titleFontSize * toNum(titleStyle?.lineHeightOH, 1.2),
        textTransform: textTransformFor(toBool(raw?.isUppercaseOH, false)),
        ...fontFamilyStyle(titleStyle?.fontFamilyOH),
      },
      // Order Date — orderDateStyle (OD suffix)
      date: {
        color: toStr(orderDateStyle?.colorOD, "#8B5E5E"),
        fontSize: dateFontSize,
        fontWeight: toFontWeight(orderDateStyle?.fontWeightOD, "400"),
        letterSpacing: toNum(orderDateStyle?.letterSpacingOD, 0),
        lineHeight: dateFontSize * toNum(orderDateStyle?.lineHeightOD, 1.2),
        textTransform: textTransformFor(toBool(raw?.isUppercaseOD, false)),
        ...fontFamilyStyle(orderDateStyle?.fontFamilyOD),
      },
      // Order Status badge TEXT — orderStatusStyle (OS suffix)
      status: {
        color: toStr(orderStatusStyle?.colorOS, "#065F46"),
        fontSize: statusFontSize,
        fontWeight: toFontWeight(orderStatusStyle?.fontWeightOS, "600"),
        letterSpacing: toNum(orderStatusStyle?.letterSpacingOS, 0),
        lineHeight: statusFontSize * toNum(orderStatusStyle?.lineHeightOS, 1.2),
        textTransform: textTransformFor(toBool(raw?.isUppercaseOS, false)),
        ...fontFamilyStyle(orderStatusStyle?.fontFamilyOS),
      },
      // Order Status badge BACKGROUND — Builder confusingly reuses the
      // top-level "outer" background/padding/border/corner props for this
      // badge (not the card container) — PreviewLive.tsx does the same.
      statusBadge: {
        backgroundColor: toStr(raw?.backgroundColor, "#FFFFFF"),
        paddingTop: toNum(raw?.paddingTop, 4),
        paddingBottom: toNum(raw?.paddingBottom, 4),
        paddingLeft: toNum(raw?.paddingLeft, 8),
        paddingRight: toNum(raw?.paddingRight, 8),
        borderRadius: toNum(raw?.outerCorners, 0),
        ...borderStyleFor(raw?.borderLine, raw?.borderColor),
      },
      image: {
        backgroundColor: toStr(raw?.contBackgroundColor, "#FFFFFF"),
        borderRadius: toNum(raw?.imageCornersOH, 0),
      },
      // Order Price — orderStatusPrice (Pr suffix)
      price: {
        color: toStr(orderStatusPrice?.colorPr, "#B42318"),
        fontSize: toNum(orderStatusPrice?.fontSizePr, 22),
        fontWeight: toFontWeight(orderStatusPrice?.fontWeightPr, "600"),
        letterSpacing: toNum(orderStatusPrice?.letterSpacingPr, 0),
        textTransform: textTransformFor(toBool(raw?.isUppercasePr, false)),
        ...fontFamilyStyle(orderStatusPrice?.fontFamilyPr),
      },
      // Button — background/corners/border/padding are top-level "button*",
      // text style is orderStatusButton (Bt suffix)
      button: {
        backgroundColor: toStr(raw?.buttonBackgroundColor, "#B42318"),
        borderRadius: toNum(raw?.buttonCorners, 10),
        paddingTop: toNum(raw?.buttonPT, 10),
        paddingBottom: toNum(raw?.buttonPB, 10),
        paddingLeft: toNum(raw?.buttonPL, 22),
        paddingRight: toNum(raw?.buttonPR, 22),
        ...borderStyleFor(raw?.buttonBorderLine, raw?.buttonBorderColor),
      },
      buttonText: {
        color: toStr(orderStatusButton?.colorBt, "#FFFFFF"),
        fontSize: toNum(orderStatusButton?.fontSizeBt, 14),
        fontWeight: toBool(buttonFormat?.bold, false)
          ? "700"
          : toFontWeight(orderStatusButton?.fontWeightBt, "600"),
        letterSpacing: toNum(orderStatusButton?.letterSpacingBt, 0),
        fontStyle: toBool(buttonFormat?.italic, false) ? "italic" : "normal",
        textDecorationLine:
          toBool(buttonFormat?.underline, false) && toBool(buttonFormat?.strikethrough, false)
            ? "underline line-through"
            : toBool(buttonFormat?.underline, false)
            ? "underline"
            : toBool(buttonFormat?.strikethrough, false)
            ? "line-through"
            : "none",
        textTransform: textTransformFor(toBool(raw?.isUppercaseBt, false)),
        ...fontFamilyStyle(orderStatusButton?.fontFamilyBt),
      },
    };
  }, [raw]);

  const showTitle = toBool(raw?.showTitle, true);
  const showOrderDate = toBool(raw?.showOrderDate, true);
  const showOrderStatus = toBool(raw?.showOrderStatus, true);
  const showOrderPriceSetting = toBool(raw?.showOrderPrice, true);
  const showProductImageSetting = toBool(raw?.showProductImage, true);
  const showRedirect = toBool(raw?.showRedirect, true);

  const imageSize = Math.max(34, toNum(raw?.imageSize ?? raw?.thumbnailSize, 44));
  // Inspector/Preview use imageRatioOH ("Auto"→square/"1:1"/"2:3"/"4:5"),
  // matching Builder's default "1:1" — this was never read here at all, so
  // the thumbnail was always forced square regardless of the merchant's
  // Ratio selection.
  const imageAspectOH = (() => {
    const r = toStr(raw?.imageRatioOH, "1:1");
    if (r === "Auto") return 1;
    const m = r.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const w = parseFloat(m[1]);
      const h = parseFloat(m[2]);
      if (w > 0 && h > 0) return w / h;
    }
    return 1;
  })();
  const imageHeightOH = Math.round(imageSize / imageAspectOH);
  const reorderText = toStr(raw?.reorderText ?? raw?.buttonText ?? raw?.buttonLabel, "Reorder");
  const emptyTitle = toStr(
    raw?.emptyTitle ?? raw?.noOrderTitle,
    customerAccessToken ? "You haven't placed any orders yet" : "No orders yet"
  );
  const emptySubtitle = toStr(
    raw?.emptySubtitle ?? raw?.noOrderSubtitle,
    customerAccessToken
      ? "Start exploring our collection and place your first order!"
      : "Please sign in again to sync your store orders."
  );
  const emptyBgColor = toStr(raw?.emptyBgColor ?? raw?.emptyBackgroundColor, "#FFFFFF");
  usePageEmptyStateReporter("order_history", !loading && orders.length === 0);

  // Inspector's "Redirection Destination" (NavigateToField) writes
  // navigateType/navigateRef/linkTo, but this was never read here — tapping
  // an order always opened OrderDetail regardless of what was configured.
  const redirectNavigateType = toStr(raw?.navigateType, "");
  const redirectNavigateRef = toStr(raw?.navigateRef, "");
  const redirectLinkTo = toStr(raw?.linkTo, "");
  const hasRedirectOverride =
    redirectNavigateType && redirectNavigateType.toLowerCase() !== "none";

  const openOrder = (order) => {
    if (hasRedirectOverride) {
      void navigateToDslTarget(navigation, {
        target: redirectNavigateRef || redirectLinkTo,
        navigateRef: redirectNavigateRef,
        navigateType: redirectNavigateType,
        linkTo: redirectLinkTo,
        fallbackTitle: "Order Details",
        extraParams: { order },
      });
      return;
    }
    navigation.navigate("OrderDetail", { order, title: "Order Details" });
  };

  const handleReorder = (order) => {
    const items = getOrderItems(order);
    if (!items.length) {
      openOrder(order);
      return;
    }

    items.forEach((item) => {
      dispatch(
        addItem({
          item: {
            id: item.variantId || item.id || item.handle || item.title,
            variantId: item.variantId || item.id || "",
            handle: item.handle || "",
            title: item.title || "Product",
            image: item.image || item.imageUrl || "",
            price: parseMoneyAmount(item.priceAmount ?? item.price) || 0,
            vendor: item.vendor || "",
            variant: item.variant || "",
            currency: item.priceCurrency || order.currencyCode || order.currencySymbol || "",
            quantity: Math.max(1, Number(item.quantity) || 1),
          },
        })
      );
    });

    navigation.navigate("BottomNavScreen", {
      title: "Cart",
      pageName: "cart",
      link: "cart",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="small" color={toStr(raw?.loaderColor, "#0D9488")} />
      </View>
    );
  }

  if (!orders.length) {
    return (
      <View style={[styles.container, styles.emptyWrap, { backgroundColor: emptyBgColor }]}>
        <FontAwesome
          name={toStr(raw?.emptyIcon, "shopping-bag")}
          size={toNum(raw?.emptyIconSize, 42)}
          color={toStr(raw?.emptyIconColor, "#9CA3AF")}
        />
        <Text style={[styles.emptyTitle, { color: toStr(raw?.emptyTitleColor, "#111827") }]}>
          {emptyTitle}
        </Text>
        <Text style={[styles.emptySubtitle, { color: toStr(raw?.emptySubtitleColor, "#6B7280") }]}>
          {emptySubtitle}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {orders.map((order, index) => {
        const items = getOrderItems(order);
        const firstItem = items[0] || {};
        const imageUrl =
          toStr(order.image || order.imageUrl || firstItem.image || firstItem.imageUrl, "");
        const date = orderDateText(order);
        const total = formatOrderMoney(order.total ?? order.price ?? order.amount, order);
        const status = toStr(order.status || order.fulfillmentStatus || order.financialStatus, "");

        return (
          <TouchableOpacity
            key={order.id || order.orderNumber || index}
            style={[styles.card, stylesFromDsl.card]}
            activeOpacity={0.82}
            onPress={() => openOrder(order)}
          >
            <View style={styles.topRow}>
              <View style={styles.titleBlock}>
                {showTitle && (
                  <Text style={stylesFromDsl.orderNumber} numberOfLines={1}>
                    {orderNumberText(order)}
                  </Text>
                )}
                {showOrderDate && !!date && (
                  <Text style={stylesFromDsl.date} numberOfLines={1}>
                    {toStr(raw?.datePrefix, "Placed on")} {date}
                  </Text>
                )}
              </View>
              {showOrderStatus && !!status && (
                <Text style={[stylesFromDsl.status, stylesFromDsl.statusBadge]} numberOfLines={1}>
                  {status}
                </Text>
              )}
            </View>

            {showProductImageSetting && (
              <View style={styles.middleRow}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={[styles.image, stylesFromDsl.image, { width: imageSize, height: imageHeightOH }]}
                    resizeMode={resolveProductImageResizeMode(
                      raw?.imageScaleOH,
                      raw?.imageScale,
                      raw?.scale,
                      raw?.imageResizeMode
                    )}
                  />
                ) : (
                  <View style={[styles.image, stylesFromDsl.image, styles.imageFallback, { width: imageSize, height: imageHeightOH }]}>
                    <FontAwesome name="image" size={Math.max(14, imageSize * 0.38)} color="#D1D5DB" />
                  </View>
                )}
              </View>
            )}

            <View style={styles.bottomRow}>
              {showOrderPriceSetting && (
                <Text style={stylesFromDsl.price} numberOfLines={1}>
                  {total}
                </Text>
              )}
              {showRedirect && (
                <TouchableOpacity
                  style={[styles.reorderButton, stylesFromDsl.button]}
                  activeOpacity={0.86}
                  onPress={() => handleReorder(order)}
                >
                  <Text style={stylesFromDsl.buttonText}>{reorderText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 360,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  middleRow: {
    marginTop: 10,
    minHeight: 44,
  },
  image: {
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  imageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  reorderButton: {
    alignItems: "center",
    justifyContent: "center",
  },
});
