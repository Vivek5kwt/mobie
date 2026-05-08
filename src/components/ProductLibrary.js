import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ProductImage from "./ProductImage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { getWishlistKeys, isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import Snackbar from "./Snackbar";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { resolveFirstFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "./FavoriteToggleButton";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

const normalizePosition = (position, fallback = {}) => {
  if (!position || typeof position !== "string") return fallback;
  const normalized = position.toLowerCase();
  const s = {};
  if (normalized.includes("top")) s.top = 16;
  if (normalized.includes("bottom")) s.bottom = 16;
  if (normalized.includes("left")) s.left = 16;
  if (normalized.includes("right")) s.right = 16;
  return Object.keys(s).length ? s : fallback;
};

export default function ProductLibrary({ section }) {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { session } = useAuth();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [currentIdx,          setCurrentIdx]          = useState(0);
  const [snackVisible,        setSnackVisible]        = useState(false);
  const [snackMessage,        setSnackMessage]        = useState("");
  const [galleryWidth,        setGalleryWidth]        = useState(Dimensions.get("window").width);
  const galleryRef = useRef(null);

  // Pinch-to-zoom state for fullscreen
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const scale = Animated.multiply(baseScale, pinchScale);

  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const layout = unwrapValue(propsNode?.layout, {});
  const raw = unwrapValue(propsNode?.raw, {});

  const css = layout?.css || {};
  const outer = css?.outer || {};
  const imageStyles = css?.image || {};
  const shareStyles = css?.share || {};
  const reviewStyles = css?.reviews || {};
  const favouriteStyles = css?.favourite || css?.favorite || raw?.favourite || raw?.favorite || {};
  const visibility = css?.visibility || {};

  // ── Images ────────────────────────────────────────────────────────────────
  // Prefer raw.images array; fall back to single raw.imageUrl
  const routeProduct = route?.params?.product || {};
  const productForWishlist = useMemo(
    () => ({
      ...routeProduct,
      ...raw,
      images: Array.isArray(raw?.images) && raw.images.length > 0
        ? raw.images
        : Array.isArray(routeProduct?.images)
          ? routeProduct.images
          : [],
      imageUrl: raw?.imageUrl || routeProduct?.imageUrl || routeProduct?.image || "",
    }),
    [raw, routeProduct]
  );

  const images = useMemo(() => {
    const arr = raw?.images;
    if (Array.isArray(arr) && arr.length > 0) {
      return Array.from(
        new Set(
          arr
            .map((image) => toString(image?.url ?? image?.src ?? image?.imageUrl ?? image, ""))
            .filter(Boolean)
        )
      );
    }
    const single = toString(raw?.imageUrl || routeProduct?.imageUrl || routeProduct?.image, "");
    return single ? [single] : [];
  }, [raw?.images, raw?.imageUrl, routeProduct?.image, routeProduct?.imageUrl]);

  const activeImageUrl = images[currentIdx] || images[0] || "";
  const hasMultiple = images.length > 1;

  // ── Visibility toggles ────────────────────────────────────────────────────
  const showRating = toBoolean(raw?.showRating, true);
  const ratingText = toString(raw?.ratingText, "0");
  const ratingCountText = toString(raw?.ratingCountText, "(0)");
  const showBackButton = toBoolean(raw?.showBackButton, false);
  const ratingVisible = toBoolean(visibility?.reviews, showRating);
  const shareVisible = toBoolean(visibility?.share, false); // off by default in screenshot
  const favouriteVisible = toBoolean(
    visibility?.favourite ??
      visibility?.favorite ??
      raw?.showFavourite ??
      raw?.showFavorite ??
      raw?.favouriteVisible ??
      raw?.favoriteVisible,
    true
  );
  const ratingIconVisible = toBoolean(visibility?.reviewsIcon, true);
  const ratingTextVisible = toBoolean(visibility?.reviewsRating, true);
  const ratingCountVisible = toBoolean(visibility?.reviewsRatingCounter, true);

  // ── Wishlist state from Redux (derived from route product) ─────────────────
  const productKeys = useMemo(() => getWishlistKeys(productForWishlist), [productForWishlist]);
  const productId = productKeys[0] || "";
  const isFavourite = isWishlistProduct(wishlistItems, productForWishlist);

  const handleToggleFavourite = async () => {
    const blocked = await requireLoginForAction({ session, navigation });
    if (blocked) return;
    const adding = !isFavourite;
    if (!productKeys.length) return;
    dispatch(
      toggleWishlist({
        product: {
          id: productId,
          title: productForWishlist?.title || productForWishlist?.titleText || "",
          image: productForWishlist?.imageUrl || productForWishlist?.image || images[0] || "",
          price: productForWishlist?.priceAmount ?? productForWishlist?.price ?? productForWishlist?.salePrice ?? 0,
          compareAtPrice: productForWishlist?.compareAtPrice ?? productForWishlist?.originalPrice ?? productForWishlist?.standardPrice ?? 0,
          currency: productForWishlist?.priceCurrency || productForWishlist?.currency || "",
          handle: productForWishlist?.handle || "",
          vendor: productForWishlist?.vendor || productForWishlist?.vendorText || productForWishlist?.shop || "",
        },
      })
    );
    setSnackMessage(adding ? "Product added to wishlist successfully." : "Product removed from wishlist successfully.");
    setSnackVisible(true);
  };

  useEffect(() => {
    if (!isFullscreenVisible) {
      baseScale.setValue(1);
      pinchScale.setValue(1);
      lastScale.current = 1;
    }
  }, [baseScale, pinchScale, isFullscreenVisible]);

  // Reset gallery to first image when section changes
  useEffect(() => {
    setCurrentIdx(0);
    galleryRef.current?.scrollTo({ x: 0, animated: false });
  }, [galleryWidth, images.length]);

  if (!images.length) return null;

  // ── Dimensions ────────────────────────────────────────────────────────────
  const metrics = layout?.metrics?.elements || {};
  const imageMetrics = metrics?.image || {};
  const imageWidth = imageMetrics?.width
    ? Math.min(Number(imageMetrics.width), Math.max(galleryWidth - 32, 1))
    : Math.max(galleryWidth - 32, 1);
  const imageHeight = imageMetrics?.height
    ? Number(imageMetrics.height)
    : Math.round(imageWidth * 1.0);
  const imageCorner = toNumber(imageStyles?.corner, 16);
  const imageScale = toString(imageStyles?.scale, "Fit").toLowerCase();
  const resizeMode = imageScale === "fill" || imageScale === "cover" ? "cover" : "contain";

  // ── Icon sizes ────────────────────────────────────────────────────────────
  const shareIconSize = toNumber(shareStyles?.icon?.size, 14);
  const favouriteToggleConfig = buildFavoriteToggleConfig(
    {
      ...raw,
      favIconSize: favouriteStyles?.icon?.size ?? raw?.favIconSize,
      favPosition: favouriteStyles?.position ?? raw?.favouritePosition ?? raw?.favoritePosition,
      favBubbleBgColor: favouriteStyles?.bg ?? raw?.favouriteBg ?? raw?.favoriteBg,
    },
    favouriteStyles
  );
  const ratingIconSize = toNumber(reviewStyles?.icon?.size, 12);

  // ── Font families ─────────────────────────────────────────────────────────
  const ratingFontFamily = resolveFirstFont(raw?.ratingFontFamily, reviewStyles?.rating?.fontFamily, reviewStyles?.fontFamily, raw?.fontFamily);
  const ratingCountFontFamily = resolveFirstFont(raw?.ratingCountFontFamily, reviewStyles?.count?.fontFamily, reviewStyles?.fontFamily, raw?.fontFamily);

  // ── Container ─────────────────────────────────────────────────────────────
  const containerStyle = [
    styles.container,
    {
      backgroundColor: toString(outer?.background, "#ffffff"),
      borderColor: toString(outer?.borderColor, "#e5e7eb"),
      borderRadius: toNumber(outer?.borderRadius, 0),
      borderWidth: outer?.borderLine ? 1 : 0,
      paddingTop: toNumber(outer?.paddingTop, 0),
      paddingBottom: toNumber(outer?.paddingBottom, 0),
      paddingLeft: toNumber(outer?.paddingLeft, 0),
      paddingRight: toNumber(outer?.paddingRight, 0),
    },
  ];

  // ── Gallery scroll ─────────────────────────────────────────────────────────
  const handleGalleryScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(galleryWidth, 1));
    if (idx >= 0 && idx < images.length && idx !== currentIdx) {
      setCurrentIdx(idx);
    }
  };

  const scrollToImage = (idx) => {
    galleryRef.current?.scrollTo({ x: idx * galleryWidth, animated: true });
    setCurrentIdx(idx);
  };

  // ── Pinch zoom ────────────────────────────────────────────────────────────
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const next = Math.max(1, Math.min(lastScale.current * event.nativeEvent.scale, 4));
      lastScale.current = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
    }
  };

  return (
    <View style={containerStyle}>

      {/* ── Gallery + overlays ─────────────────────────────────────────────── */}
      <View
        style={[styles.galleryWrap, { height: imageHeight + 16 }]}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width || 0);
          if (nextWidth > 0 && nextWidth !== galleryWidth) {
            setGalleryWidth(nextWidth);
          }
        }}
      >
        <ScrollView
          ref={galleryRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={hasMultiple}
          onScroll={handleGalleryScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          directionalLockEnabled
          alwaysBounceVertical={false}
          decelerationRate="fast"
          snapToInterval={galleryWidth}
          snapToAlignment="start"
          disableIntervalMomentum
          style={{ width: galleryWidth }}
        >
          {images.map((uri, idx) => (
            <Pressable
              key={`img-${idx}`}
              style={{ width: galleryWidth, alignItems: "center", paddingVertical: 8 }}
              onPress={() => setIsFullscreenVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Open product image fullscreen"
            >
              <ProductImage
                uri={uri}
                style={{ width: imageWidth, height: imageHeight, borderRadius: imageCorner }}
                resizeMode={resizeMode}
              />
            </Pressable>
          ))}
        </ScrollView>

        {/* Back button */}
        {showBackButton && navigation?.canGoBack?.() && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.iconBubble, styles.backBubble]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <FontAwesome name="arrow-left" size={14} color="#111827" />
          </Pressable>
        )}

        {/* Favourite button */}
        {favouriteVisible && (
          <FavoriteToggleButton
            isFavorite={isFavourite}
            config={favouriteToggleConfig}
            onPress={handleToggleFavourite}
            accessibilityLabel={isFavourite ? "Remove from favourites" : "Add to favourites"}
          />
        )}

        {/* Share button */}
        {shareVisible && (
          <View
            style={[
              styles.iconBubble,
              normalizePosition(shareStyles?.position, styles.shareBubble),
              {
                backgroundColor: toString(shareStyles?.bg, "#e5f3f4"),
                borderRadius: toNumber(shareStyles?.corner, 17),
              },
            ]}
          >
            <FontAwesome
              name="share-alt"
              size={shareIconSize}
              color={toString(shareStyles?.icon?.color, "#111827")}
            />
          </View>
        )}

        {/* Rating bubble */}
        {ratingVisible && (
          <View
            style={[
              styles.ratingBubble,
              {
                backgroundColor: toString(reviewStyles?.bg, "#ffffff"),
                borderRadius: toNumber(reviewStyles?.corner, 12),
                borderWidth: reviewStyles?.borderLine ? 1 : 0,
                borderColor: toString(reviewStyles?.borderColor, "#e5e7eb"),
                paddingTop: toNumber(reviewStyles?.padding?.top, 4),
                paddingRight: toNumber(reviewStyles?.padding?.right, 6),
                paddingBottom: toNumber(reviewStyles?.padding?.bottom, 4),
                paddingLeft: toNumber(reviewStyles?.padding?.left, 6),
              },
              normalizePosition(reviewStyles?.position, styles.ratingBubblePos),
            ]}
          >
            {ratingIconVisible && (
              <FontAwesome
                name="star"
                size={ratingIconSize}
                color={toString(reviewStyles?.icon?.color, "#F59E0B")}
                style={{ marginRight: ratingTextVisible ? 4 : 0 }}
              />
            )}
            {ratingTextVisible && (
              <Text
                style={{
                  fontSize: toNumber(reviewStyles?.rating?.fontSize, 12),
                  color: toString(reviewStyles?.rating?.color, "#111827"),
                  fontWeight: toString(reviewStyles?.rating?.fontWeight, "600"),
                  ...(ratingFontFamily ? { fontFamily: ratingFontFamily } : {}),
                }}
              >
                {ratingText}
              </Text>
            )}
            {ratingCountVisible && (
              <Text
                style={{
                  fontSize: toNumber(reviewStyles?.count?.fontSize, 12),
                  color: toString(reviewStyles?.count?.color, "#6b7280"),
                  marginLeft: ratingTextVisible ? 4 : 0,
                  ...(ratingCountFontFamily ? { fontFamily: ratingCountFontFamily } : {}),
                }}
              >
                {ratingCountText}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── Thumbnail strip ─────────────────────────────────────────────────── */}
      {hasMultiple && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbRow}
        >
          {images.map((uri, idx) => (
            <TouchableOpacity
              key={`thumb-${idx}`}
              onPress={() => scrollToImage(idx)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri }}
                style={[
                  styles.thumb,
                  idx === currentIdx && styles.thumbActive,
                ]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Pagination dots ─────────────────────────────────────────────────── */}
      {hasMultiple && (
        <View style={styles.dotsRow}>
          {images.map((_, idx) => (
            <View
              key={`dot-${idx}`}
              style={[styles.dot, idx === currentIdx && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* ── Fullscreen modal with pinch-to-zoom ───────────────────────────── */}
      <Modal
        visible={isFullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFullscreenVisible(false)}
      >
        <Pressable
          style={styles.fullscreenBackdrop}
          onPress={() => setIsFullscreenVisible(false)}
        >
          <View style={styles.fullscreenImageWrap}>
            <PinchGestureHandler
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchHandlerStateChange}
            >
              <Animated.View style={[styles.fullscreenImage, { transform: [{ scale }] }]}>
                <Image
                  source={{ uri: activeImageUrl }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                  accessibilityLabel="Product image fullscreen"
                />
              </Animated.View>
            </PinchGestureHandler>
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={() => setIsFullscreenVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen image"
          >
            <FontAwesome name="times" size={16} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      <Snackbar
        visible={snackVisible}
        message={snackMessage}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#ffffff",
  },
  // Gallery wrapper: clips absolute overlays to the image area
  galleryWrap: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  // ── Overlay bubbles ──────────────────────────────────────────────────────
  iconBubble: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5f3f4",
  },
  backBubble: {
    top: 24,
    left: 24,
  },
  favBubble: {
    top: 24,
    right: 24,
  },
  shareBubble: {
    top: 72,
    right: 24,
  },
  ratingBubble: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingBubblePos: {
    left: 24,
    bottom: 24,
  },
  // ── Thumbnails ────────────────────────────────────────────────────────────
  thumbRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: {
    borderColor: "#0D9488",
  },
  // ── Pagination dots ───────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#0D9488",
    width: 16,
    borderRadius: 4,
  },
  // ── Fullscreen modal ──────────────────────────────────────────────────────
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImageWrap: {
    width: "90%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 48,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
