import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { convertStyles } from "../utils/convertStyles";
import { searchShopifyProducts } from "../services/shopify";

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
  const rawProps = useMemo(
    () =>
      section?.props ??
      section?.properties?.props?.properties ??
      section?.properties?.props ??
      {},
    [section]
  );
  const flatProps = rawProps?.properties ?? rawProps;

  const get = (key, fallback) => unwrapValue(flatProps?.[key], fallback);
  const getNum = (key, fallback) => toNumber(flatProps?.[key], fallback);
  const getBool = (key, fallback) => unwrapBoolean(flatProps?.[key], fallback);

  const paddingTop = getNum("pt", 12);
  const paddingBottom = getNum("pb", 12);
  const paddingLeft = getNum("pl", 16);
  const paddingRight = getNum("pr", 16);
  const bgColor = get("bgColor", "#FFFFFF");
  const searchBgColor = get("searchBgColor", "#FFFFFF");
  const borderColor = get("borderColor", "#E5E7EB");
  const searchTextColor = get("searchTextColor", "#111827");
  const clearIconColor = get("clearIconColor", "#6B7280");
  const voiceIconColor = get("voiceIconColor", "#6B7280");
  const searchIconColor = get("searchIconColor", "#6B7280");
  const fontSize = getNum("fontSize", 14);
  const fontFamily = get("fontFamily", "Inter");
  const fontWeight = toFontWeight(flatProps?.fontWeight, "400");
  const borderRadius = getNum("borderRadius", 12);
  const borderSide = get("borderSide", "all");
  const clearIconSize = getNum("clearIconSize", 13);
  const voiceIconSize = getNum("voiceIconSize", 16);
  const placeholderBold = getBool("placeholderBold", false);
  const placeholderItalic = getBool("placeholderItalic", false);
  const placeholderUnderline = getBool("placeholderUnderline", false);
  const placeholderStrikethrough = getBool("placeholderStrikethrough", false);
  const searchPlaceholder = get("searchPlaceholder", "Search products...");
  const showClear = getBool("clearButtonVisible", true);
  const showInput = getBool("searchInputVisible", true);
  const showVoice = getBool("voiceSearchVisible", true);
  const searchLimit = getNum("searchLimit", 10);

  const [value, setValue] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const voiceDestroyRef = useRef(false);

  const detailSections = useMemo(() => extractDetailSections(rawProps), [rawProps]);

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
        ...(fontFamily && fontFamily !== "Inter" ? { fontFamily } : {}),
      }),
    [searchTextColor, fontSize, fontWeight, fontFamily]
  );

  const placeholderTextStyle = {
    fontWeight: placeholderBold ? "700" : "400",
    fontStyle: placeholderItalic ? "italic" : "normal",
    textDecorationLine,
  };

  const runSearch = useCallback(
    async (term) => {
      const t = String(term ?? "").trim();
      if (!t) {
        setResults([]);
        setError("");
        setLoading(false);
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

  useEffect(() => {
    const term = value.trim();
    if (!term) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    const t = setTimeout(() => runSearch(term), 350);
    return () => clearTimeout(t);
  }, [value, runSearch]);

  const startVoiceSearch = useCallback(() => {
    if (!VoiceModule) {
      Alert.alert(
        "Voice search",
        "Voice search is not available. Install @react-native-voice/voice and rebuild the app to enable it."
      );
      return;
    }
    voiceDestroyRef.current = false;
    setIsListening(true);
    setError("");

    const onResults = (e) => {
      if (voiceDestroyRef.current) return;
      const results = e?.value ?? [];
      const text = Array.isArray(results) && results.length > 0 ? results[0] : "";
      if (text && text.trim()) {
        setValue(text.trim());
      }
    };

    const onError = (e) => {
      if (voiceDestroyRef.current) return;
      setIsListening(false);
      if (e?.error?.code !== "no-speech" && e?.error?.message) {
        setError("Could not hear you. Try again.");
      }
    };

    const onEnd = () => {
      if (!voiceDestroyRef.current) setIsListening(false);
    };

    VoiceModule.onSpeechResults = onResults;
    VoiceModule.onSpeechError = onError;
    VoiceModule.onSpeechEnd = onEnd;

    VoiceModule.start("en-US")
      .then(() => {})
      .catch((err) => {
        if (!voiceDestroyRef.current) {
          setIsListening(false);
          setError("Could not start microphone. Check permissions.");
        }
      });
  }, []);

  const stopVoiceSearch = useCallback(() => {
    voiceDestroyRef.current = true;
    if (VoiceModule) {
      VoiceModule.destroy().catch(() => {});
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      voiceDestroyRef.current = true;
      if (VoiceModule) {
        VoiceModule.destroy().catch(() => {});
      }
    };
  }, []);

  return (
    <View style={[styles.container, containerStyle, borderStyle]}>
      <View style={[styles.inputWrapper, inputWrapperStyle]}>
        <FontAwesome name="search" size={fontSize + 2} color={searchIconColor} />
        {showInput && (
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={searchPlaceholder}
            placeholderTextColor={searchTextColor || "#6B7280"}
            style={[styles.input, inputTextStyle, placeholderTextStyle]}
            underlineColorAndroid="transparent"
            editable={!isListening}
          />
        )}
        {showClear && value.length > 0 && !isListening && (
          <TouchableOpacity onPress={() => setValue("")} style={styles.iconButton}>
            <FontAwesome name="times" size={clearIconSize} color={clearIconColor} />
          </TouchableOpacity>
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
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      {(value.trim().length > 0 || results.length > 0) && (
        <View style={styles.resultsWrapper}>
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={searchIconColor} />
              <Text style={styles.statusText}>Searching products...</Text>
            </View>
          )}
          {!loading && !error && results.length === 0 && value.trim() && (
            <Text style={styles.statusText}>No products found.</Text>
          )}
          {!loading &&
            !error &&
            results.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.resultRow}
                onPress={() =>
                  navigation.navigate("ProductDetail", {
                    product,
                    detailSections,
                  })
                }
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
                  <Text numberOfLines={2} style={styles.resultTitle}>
                    {product.title}
                  </Text>
                  <Text style={styles.resultPrice}>
                    {product.priceCurrency} {product.priceAmount}
                  </Text>
                </View>
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
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
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
    gap: 10,
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
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 14,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
