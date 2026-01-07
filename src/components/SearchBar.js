import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { convertStyles } from "../utils/convertStyles";
import { searchShopifyProducts } from "../services/shopify";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.properties?.value !== undefined) return value.properties.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const unwrapBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
};

const buildBorderStyles = (borderSide, borderColor) => {
  const side = String(borderSide || "").toLowerCase();
  const styles = {};

  if (!side || side === "all" || side === "full") {
    styles.borderWidth = 1;
  } else if (side === "bottom") {
    styles.borderBottomWidth = 1;
  } else if (side === "top") {
    styles.borderTopWidth = 1;
  } else if (side === "left") {
    styles.borderLeftWidth = 1;
  } else if (side === "right") {
    styles.borderRightWidth = 1;
  }

  if (borderColor) {
    styles.borderColor = borderColor;
  }

  return styles;
};

const extractDetailSections = (rawProps) => {
  const candidates = [
    rawProps?.productDetailSections,
    rawProps?.detailSections,
    rawProps?.productDetails,
    rawProps?.detail,
    rawProps?.details,
  ];

  for (const candidate of candidates) {
    const resolved = unwrapValue(candidate, undefined);
    if (Array.isArray(resolved)) return resolved;
    if (Array.isArray(resolved?.sections)) return resolved.sections;
  }

  return [];
};

export default function SearchBar({ section }) {
  const navigation = useNavigation();
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const paddingTop = unwrapValue(rawProps?.pt, 16);
  const paddingBottom = unwrapValue(rawProps?.pb, 16);
  const paddingLeft = unwrapValue(rawProps?.pl, 16);
  const paddingRight = unwrapValue(rawProps?.pr, 16);

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const searchBgColor = unwrapValue(rawProps?.searchBgColor, "#E5F6F7");
  const fontSize = unwrapValue(rawProps?.fontSize, 16);
  const fontFamily = unwrapValue(rawProps?.fontFamily, undefined);
  const fontWeight = unwrapValue(rawProps?.fontWeight, "500");
  const borderColor = unwrapValue(rawProps?.borderColor, "#E5E7EB");
  const borderRadius = unwrapValue(rawProps?.borderRadius, 12);
  const borderSide = unwrapValue(rawProps?.borderSide, "all");

  const clearIconSize = unwrapValue(rawProps?.clearIconSize, 18);
  const voiceIconSize = unwrapValue(rawProps?.voiceIconSize, 16);
  const clearIconColor = unwrapValue(rawProps?.clearIconColor, "#9CA3AF");
  const voiceIconColor = unwrapValue(rawProps?.voiceIconColor, "#9CA3AF");
  const searchIconColor = unwrapValue(rawProps?.searchIconColor, "#0B6570");
  const searchTextColor = unwrapValue(rawProps?.searchTextColor, "#017176");

  const placeholderBold = unwrapBoolean(rawProps?.placeholderBold, false);
  const placeholderItalic = unwrapBoolean(rawProps?.placeholderItalic, false);
  const placeholderUnderline = unwrapBoolean(rawProps?.placeholderUnderline, false);
  const searchPlaceholder = unwrapValue(rawProps?.searchPlaceholder, "Search products...");

  const showClear = unwrapBoolean(rawProps?.clearButtonVisible, true);
  const showInput = unwrapBoolean(rawProps?.searchInputVisible, true);
  const showVoice = unwrapBoolean(rawProps?.voiceSearchVisible, true);
  const searchLimit = unwrapValue(rawProps?.searchLimit, 10);

  const [value, setValue] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const detailSections = useMemo(() => extractDetailSections(rawProps), [rawProps]);

  const containerStyle = convertStyles({
    backgroundColor: bgColor,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  });

  const borderStyle = useMemo(() => buildBorderStyles(borderSide, borderColor), [
    borderSide,
    borderColor,
  ]);

  const inputWrapperStyle = convertStyles({
    backgroundColor: searchBgColor,
    borderRadius,
  });

  const inputTextStyle = convertStyles({
    color: searchTextColor,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle: placeholderItalic ? "italic" : "normal",
    textDecorationLine: placeholderUnderline ? "underline" : "none",
  });

  const placeholderTextStyle = {
    fontWeight: placeholderBold ? "700" : inputTextStyle?.fontWeight,
    fontStyle: placeholderItalic ? "italic" : inputTextStyle?.fontStyle,
    textDecorationLine: placeholderUnderline ? "underline" : inputTextStyle?.textDecorationLine,
  };

  useEffect(() => {
    const term = value.trim();
    if (!term) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    const timeout = setTimeout(async () => {
      try {
        const matches = await searchShopifyProducts(term, searchLimit);
        if (isMounted) {
          setResults(matches);
        }
      } catch (err) {
        if (isMounted) {
          setError("Unable to search products right now.");
          setResults([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchLimit, value]);

  return (
    <View style={[styles.container, containerStyle, borderStyle]}>
      <View style={[styles.inputWrapper, inputWrapperStyle]}>
        <FontAwesome name="search" size={20} color={searchIconColor} />
        {showInput && (
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={searchPlaceholder}
            placeholderTextColor={inputTextStyle?.color || "#6B7280"}
            style={[styles.input, inputTextStyle, placeholderTextStyle]}
            underlineColorAndroid="transparent"
          />
        )}
        {showClear && value.length > 0 && (
          <TouchableOpacity onPress={() => setValue("")} style={styles.iconButton}>
            <FontAwesome name="times" size={clearIconSize} color={clearIconColor} />
          </TouchableOpacity>
        )}
        {showVoice && (
          <TouchableOpacity style={styles.iconButton}>
            <FontAwesome name="microphone" size={voiceIconSize} color={voiceIconColor} />
          </TouchableOpacity>
        )}
      </View>
      {value.trim().length > 0 && (
        <View style={styles.resultsWrapper}>
          {loading && <Text style={styles.statusText}>Searching products...</Text>}
          {!loading && error.length > 0 && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && results.length === 0 && (
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
    paddingVertical: 0,
  },
  iconButton: {
    paddingLeft: 4,
    paddingVertical: 2,
  },
  resultsWrapper: {
    marginTop: 12,
    gap: 10,
  },
  statusText: {
    textAlign: "center",
    color: "#6B7280",
  },
  errorText: {
    textAlign: "center",
    color: "#B91C1C",
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
