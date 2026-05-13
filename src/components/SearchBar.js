import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Keyboard,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation, useRoute } from "@react-navigation/native";
import { resolveFont } from "../services/typographyService";
import { convertStyles } from "../utils/convertStyles";
import { searchShopifyProducts } from "../services/shopify";
import { formatMoney } from "../utils/money";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.properties !== undefined) return value.properties;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const unwrapBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = String(resolved).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
};

const buildBorderStyles = (borderSide, borderColor) => {
  const side = String(borderSide || "").toLowerCase();
  const out = {};
  if (!side || side === "all" || side === "full") {
    out.borderWidth = 1;
  } else if (side === "bottom") {
    out.borderBottomWidth = 1;
  } else if (side === "top") {
    out.borderTopWidth = 1;
  } else if (side === "left") {
    out.borderLeftWidth = 1;
  } else if (side === "right") {
    out.borderRightWidth = 1;
  }
  if (borderColor) out.borderColor = borderColor;
  return out;
};

const extractDetailSections = (rawProps) => {
  const candidates = [
    rawProps?.productDetailSections,
    rawProps?.detailSections,
    rawProps?.productDetails,
    rawProps?.detail,
    rawProps?.details,
  ];
  for (const c of candidates) {
    const resolved = unwrapValue(c, undefined);
    if (Array.isArray(resolved)) return resolved;
    if (Array.isArray(resolved?.sections)) return resolved.sections;
  }
  return [];
};

const formatProductPrice = (product = {}) => {
  const amount = product?.priceAmount ?? product?.price;
  const currency = product?.priceCurrency || product?.currency || product?.currencySymbol || "";
  return formatMoney(amount, currency);
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFontWeight = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "number") return String(resolved);
  const n = String(resolved).trim().toLowerCase();
  if (n === "bold") return "700";
  if (["semibold", "semi bold"].includes(n)) return "600";
  if (n === "medium") return "500";
  if (["regular", "normal"].includes(n)) return "400";
  if (/^\d+$/.test(n)) return n;
  return fallback;
};

let VoiceModule = null;
try {
  VoiceModule = require("@react-native-voice/voice").default;
} catch (_) {
  VoiceModule = null;
}

export default function SearchBar({ section }) {
  const navigation = useNavigation();
  const route = useRoute();

  // Read DSL: most-specific first (properties.props.properties → properties.props → props)
  const rawProps = useMemo(
    () =>
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      section?.props ||
      {},
    [section]
  );

  const get    = (key, fallback) => unwrapValue(rawProps?.[key], fallback);
  const getNum = (key, fallback) => toNumber(rawProps?.[key], fallback);
  const getBool = (key, fallback) => unwrapBoolean(rawProps?.[key], fallback);
  const isDedicatedSearchPage = useMemo(() => {
    const routeHint = String(
      route?.params?.pageName ||
      route?.params?.link ||
      route?.params?.title ||
      ""
    )
      .trim()
      .toLowerCase();
    return routeHint === "search" || routeHint.includes("search");
  }, [route?.params?.link, route?.params?.pageName, route?.params?.title]);

  const paddingTop    = getNum("pt", 12);
  const paddingBottom = getNum("pb", 12);
  const paddingLeft   = getNum("pl", 16);
  const paddingRight  = getNum("pr", 16);
  const bgColor         = get("bgColor", "transparent");
  const searchBgColor   = get("searchBgColor", "#F3F4F6");
  const borderColor     = get("borderColor", "#E5E7EB");
  const searchTextColor = get("searchTextColor", "#111827");
  const placeholderColor = get("placeholderColor", searchTextColor);
  const clearIconColor  = get("clearIconColor", "#6B7280");
  const voiceIconColor  = get("voiceIconColor", "#6B7280");
  const searchIconColor = get("searchIconColor", "#9CA3AF");
  const fontSize        = getNum("fontSize", 14);
  const fontFamily      = resolveFont(get("fontFamily", undefined));
  const fontWeight      = toFontWeight(rawProps?.fontWeight, "400");
  const borderRadius    = getNum("borderRadius", 24);
  const borderSide      = get("borderSide", "none");
  const searchIconSize  = getNum("searchIconSize", getNum("fontSize", 14));
  const clearIconSize   = getNum("clearIconSize", 13);
  const voiceIconSize   = getNum("voiceIconSize", 16);
  const placeholderBold        = getBool("placeholderBold", false);
  const placeholderItalic      = getBool("placeholderItalic", false);
  const placeholderUnderline   = getBool("placeholderUnderline", false);
  const placeholderStrikethrough = getBool("placeholderStrikethrough", false);
  const searchPlaceholder = get("searchPlaceholder", "Search products...");
  const showClear  = getBool("clearButtonVisible", true);
  const showInput  = getBool("searchInputVisible", true);
  const showVoice  = getBool("voiceSearchVisible", true);
  const searchLimit = getNum("searchLimit", 10);
  const autocompleteLimit = Math.max(3, getNum("autocompleteLimit", Math.min(searchLimit, 6)));
  const suggestionsTitle = get("suggestionsTitle", "Suggestions");
  const resultsTitle = get("resultsTitle", "Products");
  const panelBgColor = get("suggestionsBgColor", get("panelBgColor", searchBgColor || "#FFFFFF"));
  const panelBorderColor = get("suggestionsBorderColor", borderColor);
  const panelRadius = getNum("suggestionsBorderRadius", Math.max(12, borderRadius || 12));
  const panelTextColor = get("suggestionsTextColor", searchTextColor);
  const panelMutedColor = get("suggestionsMutedColor", placeholderColor || "#6B7280");
  const panelAccentColor = get("suggestionsAccentColor", searchIconColor);
  const resultRowBgColor = get("suggestionRowBgColor", "#FFFFFF");

  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedTerm, setSubmittedTerm] = useState("");
  const [isListening, setIsListening] = useState(false);
  const voiceDestroyRef = useRef(false);

  const requestMicrophonePermission = useCallback(async () => {
    if (Platform.OS !== "android") {
      return { granted: true, blocked: false };
    }
    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (alreadyGranted) {
        return { granted: true, blocked: false };
      }

      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone permission",
          message: "Allow microphone access to search products using your voice.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
          buttonNeutral: "Ask me later",
        }
      );
      return {
        granted: status === PermissionsAndroid.RESULTS.GRANTED,
        blocked: status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      };
    } catch (_) {
      return { granted: false, blocked: false };
    }
  }, []);

  // detailSections may live one level up (on the section itself) when rawProps is already flat
  const detailSections = useMemo(
    () => extractDetailSections(rawProps) || extractDetailSections(section?.properties?.props ?? {}),
    [rawProps, section]
  );

  const containerStyle = useMemo(
    () =>
      convertStyles({
        backgroundColor: bgColor,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
      }),
    [bgColor, paddingTop, paddingBottom, paddingLeft, paddingRight]
  );

  const borderStyle = useMemo(
    () => buildBorderStyles(borderSide, borderColor),
    [borderSide, borderColor]
  );

  const inputWrapperStyle = useMemo(
    () => convertStyles({ backgroundColor: searchBgColor, borderRadius }),
    [searchBgColor, borderRadius]
  );

  let textDecorationLine = "none";
  if (placeholderUnderline && placeholderStrikethrough) textDecorationLine = "underline line-through";
  else if (placeholderUnderline) textDecorationLine = "underline";
  else if (placeholderStrikethrough) textDecorationLine = "line-through";

  const inputTextStyle = useMemo(
    () =>
      convertStyles({
        color: searchTextColor,
        fontSize,
        fontWeight,
        ...(fontFamily ? { fontFamily } : {}),
      }),
    [searchTextColor, fontSize, fontWeight, fontFamily]
  );

  const placeholderTextStyle = useMemo(
    () =>
      convertStyles({
        color: placeholderColor,
        fontSize,
        fontWeight: placeholderBold ? "700" : fontWeight || "400",
        fontStyle: placeholderItalic ? "italic" : "normal",
        textDecorationLine,
        ...(fontFamily ? { fontFamily } : {}),
      }),
    [
      placeholderColor,
      fontSize,
      placeholderBold,
      placeholderItalic,
      textDecorationLine,
      fontFamily,
      fontWeight,
    ]
  );

  const runSearch = useCallback(
    async (term) => {
      const t = String(term ?? "").trim();
      if (!t) {
        setResults([]);
        setError("");
        setLoading(false);
        setSubmittedTerm("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const matches = await searchShopifyProducts(t, searchLimit);
        setResults(matches);
      } catch (err) {
        setError("Unable to search products right now.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchLimit]
  );

  const handleChangeText = useCallback((text) => {
    setValue(text);
    setSubmittedTerm("");
  }, []);

  const openSearchResults = useCallback((overrideTerm) => {
    const term = String(overrideTerm ?? value).trim();
    if (!term) {
      setResults([]);
      setError("");
      setSubmittedTerm("");
      return;
    }
    Keyboard.dismiss();
    setValue(term);
    setSubmittedTerm(term);
    setIsFocused(false);
    navigation.navigate("AllProducts", {
      title: `Search results for "${term}"`,
      query: term,
      detailSections,
    });
  }, [detailSections, navigation, value]);

  const handleProductPress = useCallback(
    (product) => {
      Keyboard.dismiss();
      setSubmittedTerm(value.trim());
      setIsFocused(false);
      navigation.navigate("ProductDetail", {
        product,
        detailSections,
      });
    },
    [detailSections, navigation, value]
  );

  useEffect(() => {
    if (isDedicatedSearchPage) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    const term = value.trim();
    if (!term) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    const t = setTimeout(() => runSearch(term), 350);
    return () => clearTimeout(t);
  }, [isDedicatedSearchPage, value, runSearch]);

  useEffect(() => {
    if (!isDedicatedSearchPage) return;
    DeviceEventEmitter.emit("mobidrag:search:queryChanged", { query: value.trim() });
  }, [isDedicatedSearchPage, value]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("mobidrag:search:setQuery", (payload) => {
      const next = String(payload?.query || "").trim();
      if (!next) return;
      setValue(next);
      setSubmittedTerm(next);
      setIsFocused(true);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const routeQuery = String(route?.params?.query || "").trim();
    if (!routeQuery) return;
    setValue(routeQuery);
    setSubmittedTerm(routeQuery);
  }, [route?.params?.query]);

  const startVoiceSearch = useCallback(async () => {
    if (!VoiceModule) {
      Alert.alert(
        "Voice search",
        "Voice search is not available. Install @react-native-voice/voice and rebuild the app to enable it."
      );
      return;
    }

    // Verify the speech recognition service is available on this device
    try {
      const available = await VoiceModule.isAvailable();
      if (!available) {
        Alert.alert("Voice search", "Voice recognition is not available on this device.");
        return;
      }
    } catch (_) {
      // isAvailable may not exist in older versions; continue
    }

    const { granted, blocked } = await requestMicrophonePermission();
    if (!granted) {
      setIsListening(false);
      setError("Microphone access is needed for voice search.");
      Alert.alert(
        "Microphone permission needed",
        blocked
          ? "Microphone permission is blocked. Please enable it from app settings."
          : "Please allow microphone permission to use voice search.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings?.() },
        ]
      );
      return;
    }

    voiceDestroyRef.current = false;
    setIsListening(true);
    setError("");

    const onResults = (e) => {
      if (voiceDestroyRef.current) return;
      const speechResults = e?.value ?? [];
      const text = Array.isArray(speechResults) && speechResults.length > 0 ? speechResults[0] : "";
      if (text && text.trim()) {
        setValue(text.trim());
      }
    };

    const onError = (e) => {
      if (voiceDestroyRef.current) return;
      setIsListening(false);
      const code = String(e?.error?.code || "");
      const message = String(e?.error?.message || "").toLowerCase();
      // Error code 6 = no speech detected — silently ignore
      if (code === "6" || message.includes("no speech")) return;
      if (message.includes("permission") || code === "9") {
        setError("Microphone permission denied. Please allow it in settings.");
      } else if (message.includes("connect") || code === "7" || code === "8") {
        // Android error 7 = recognizer busy / no match, 8 = recognizer busy
        setError("Could not connect to speech service. Please try again.");
      } else if (e?.error?.message) {
        setError("Could not hear you. Try again.");
      }
    };

    const onEnd = () => {
      if (!voiceDestroyRef.current) setIsListening(false);
    };

    VoiceModule.onSpeechResults = onResults;
    VoiceModule.onSpeechError = onError;
    VoiceModule.onSpeechEnd = onEnd;

    try {
      // Stop any active session first, then destroy, before starting fresh.
      // Skipping stop() leaves the recognizer in a busy state and causes
      // "Could not connect" errors on subsequent invocations.
      await VoiceModule.stop().catch(() => {});
      await VoiceModule.destroy().catch(() => {});
      // Brief pause so the recognition service has time to disconnect cleanly.
      await new Promise((resolve) => setTimeout(resolve, 150));
      await VoiceModule.start("en-US");
    } catch (err) {
      if (!voiceDestroyRef.current) {
        setIsListening(false);
        const message = String(err?.message || "").toLowerCase();
        if (message.includes("permission")) {
          setError("Microphone permission denied. Please allow it in settings.");
        } else if (message.includes("connect") || message.includes("busy") || message.includes("recognizer")) {
          setError("Could not connect to speech service. Please try again.");
        } else {
          setError("Could not start microphone. Please try again.");
        }
      }
    }
  }, [requestMicrophonePermission]);

  const stopVoiceSearch = useCallback(() => {
    voiceDestroyRef.current = true;
    if (VoiceModule) {
      VoiceModule.stop().catch(() => {});
      VoiceModule.destroy().catch(() => {});
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      voiceDestroyRef.current = true;
      if (VoiceModule) {
        VoiceModule.stop().catch(() => {});
        VoiceModule.destroy().catch(() => {});
      }
    };
  }, []);

  const searchTerm = value.trim();
  const showSearchPanel = !isDedicatedSearchPage && searchTerm.length > 0 && (isFocused || submittedTerm || loading || results.length > 0 || error);
  const visibleResults = submittedTerm ? results : results.slice(0, autocompleteLimit);
  const searchPanelTitle = submittedTerm ? `${resultsTitle} for "${submittedTerm}"` : suggestionsTitle;
  const showSearchAllRow = !submittedTerm && !!searchTerm;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.inputWrapper, inputWrapperStyle, borderStyle]}>
        <TouchableOpacity
          onPress={() => openSearchResults()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Search products"
          accessibilityRole="button"
        >
          <FontAwesome name="search" size={searchIconSize} color={searchIconColor} />
        </TouchableOpacity>
        {showInput && (
          <View style={styles.inputShell}>
            <TextInput
              value={value}
              onChangeText={handleChangeText}
              placeholder=""
              style={[styles.input, inputTextStyle, value.length > 0 && !isListening && styles.inputWithClear]}
              underlineColorAndroid="transparent"
              editable={!isListening}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onSubmitEditing={() => openSearchResults()}
              returnKeyType="search"
              blurOnSubmit={false}
            />
            {!value && (
              <Text pointerEvents="none" numberOfLines={1} style={[styles.placeholderOverlay, placeholderTextStyle]}>
                {searchPlaceholder}
              </Text>
            )}
            {value.length > 0 && !isListening && (
              <TouchableOpacity
                onPress={() => {
                  setValue("");
                  setSubmittedTerm("");
                  setResults([]);
                  setError("");
                }}
                style={styles.clearButton}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <FontAwesome name="times-circle" size={clearIconSize + 1} color={clearIconColor} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {showVoice && (
          <TouchableOpacity
            style={[styles.iconButton, isListening && styles.voiceActive]}
            onPress={isListening ? stopVoiceSearch : startVoiceSearch}
            activeOpacity={0.7}
          >
            {isListening ? (
              <ActivityIndicator size="small" color={voiceIconColor} />
            ) : (
              <FontAwesome name="microphone" size={voiceIconSize} color={voiceIconColor} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {isListening && (
        <Text style={[styles.listeningText, { color: voiceIconColor }]}>
          Listening... Speak now
        </Text>
      )}
      {error && !showSearchPanel ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      {showSearchPanel && (
        <View
          style={[
            styles.resultsWrapper,
            {
              backgroundColor: panelBgColor,
              borderColor: panelBorderColor,
              borderRadius: panelRadius,
            },
          ]}
        >
          <View style={styles.resultsHeader}>
            <View style={styles.resultsTitleWrap}>
              <Text numberOfLines={1} style={styles.resultsTitle}>
                {searchPanelTitle}
              </Text>
              {!loading && !error && results.length > 0 ? (
                <Text style={[styles.resultsMeta, { color: panelMutedColor }]}>
                  {submittedTerm ? `${results.length} matching products` : "Tap a product or search all"}
                </Text>
              ) : null}
            </View>
            {showSearchAllRow ? (
              <TouchableOpacity
                onPress={() => openSearchResults()}
                activeOpacity={0.75}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.searchAllChip}
              >
                <Text style={[styles.searchAllText, { color: panelAccentColor }]}>View all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {loading && (
            <>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={searchIconColor} />
                <Text style={[styles.statusText, { color: panelMutedColor }]}>Searching products...</Text>
              </View>
              {[0, 1, 2].map((item) => (
                <View key={`search-skeleton-${item}`} style={styles.skeletonRow}>
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonInfo}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                </View>
              ))}
            </>
          )}
          {!loading && error ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome name="exclamation-circle" size={18} color="#B91C1C" />
              </View>
              <Text style={[styles.emptyTitle, { color: panelTextColor }]}>Search is unavailable</Text>
              <Text style={[styles.emptySubtitle, { color: panelMutedColor }]}>{error}</Text>
            </View>
          ) : null}
          {!loading && !error && results.length === 0 && searchTerm && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome name="search" size={18} color="#9CA3AF" />
              </View>
              <Text style={[styles.emptyTitle, { color: panelTextColor }]}>No products found</Text>
              <Text style={[styles.emptySubtitle, { color: panelMutedColor }]}>Try a different keyword or browse all products.</Text>
              <TouchableOpacity
                onPress={() => openSearchResults(searchTerm)}
                activeOpacity={0.8}
                style={[styles.emptyAction, { backgroundColor: panelTextColor }]}
              >
                <Text style={styles.emptyActionText}>Search anyway</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading && !error && showSearchAllRow && results.length > 0 && (
            <TouchableOpacity
              style={[styles.queryRow, { backgroundColor: resultRowBgColor }]}
              activeOpacity={0.75}
              onPress={() => openSearchResults(searchTerm)}
            >
              <View style={[styles.queryIcon, { backgroundColor: panelBgColor }]}>
                <FontAwesome name="search" size={14} color={panelAccentColor} />
              </View>
              <View style={styles.resultInfo}>
                <Text numberOfLines={1} style={styles.queryTitle}>
                  Search all results for "{searchTerm}"
                </Text>
                <Text style={[styles.resultPrice, { color: panelMutedColor }]}>Open product listing page</Text>
              </View>
              <FontAwesome name="angle-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          {!loading &&
            !error &&
            visibleResults.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.resultRow, { backgroundColor: resultRowBgColor }]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.7}
              >
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.resultImage} />
                ) : (
                  <View style={styles.resultImagePlaceholder}>
                    <Text style={styles.resultPlaceholderText}>Image</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text numberOfLines={2} style={[styles.resultTitle, { color: panelTextColor }]}>
                    {product.title}
                  </Text>
                  {!!formatProductPrice(product) && (
                    <Text style={[styles.resultPrice, { color: panelMutedColor }]}>
                      {formatProductPrice(product)}
                    </Text>
                  )}
                </View>
                <FontAwesome name="angle-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    width: "100%",
    paddingVertical: 8,
  },
  inputShell: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    justifyContent: "center",
  },
  inputWithClear: {
    paddingRight: 28,
  },
  placeholderOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    includeFontPadding: false,
  },
  clearButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  iconButton: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceActive: {
    opacity: 0.9,
  },
  listeningText: {
    fontSize: 12,
    marginTop: 6,
    marginHorizontal: 14,
  },
  resultsWrapper: {
    marginTop: 12,
    gap: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  resultsTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  resultsMeta: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 2,
  },
  searchAllChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  searchAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  statusText: {
    color: "#6B7280",
    fontSize: 14,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skeletonImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#EEF0F3",
  },
  skeletonInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonLineWide: {
    width: "78%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "#EEF0F3",
  },
  skeletonLineShort: {
    width: "42%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 14,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  emptyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#111827",
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  queryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
  },
  queryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  queryTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  resultImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  resultPlaceholderText: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  resultInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  resultPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
});
