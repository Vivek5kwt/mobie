import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { resolveFont } from "../services/typographyService";

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => deepUnwrap(item));
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = deepUnwrap(next);
    return acc;
  }, {});
};

const str = (value, fallback = "") => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null) return fallback;
  const text = String(resolved).trim();
  return text ? text : fallback;
};

const num = (value, fallback = 0) => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const parsed = Number.parseFloat(String(resolved).replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const weight = (value, fallback = "400") => {
  const raw = str(value, fallback).toLowerCase();
  if (/^\d+$/.test(raw)) return raw;
  if (raw === "bold") return "700";
  if (raw === "semibold" || raw === "semi bold") return "600";
  if (raw === "medium") return "500";
  if (raw === "regular" || raw === "normal") return "400";
  return fallback;
};

const omitStyleKeys = (style = {}, keys = []) => {
  const next = { ...style };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
};

const getProps = (section) => {
  const propsRoot =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const normalized = deepUnwrap(propsRoot) || {};
  const raw = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : {};
  return { propsRoot, normalized, raw: { ...normalized, ...raw } };
};

const currencyLabel = (item = {}) => {
  const country = str(item?.country ?? item?.countryName ?? item?.name, "");
  const currency = str(item?.currency ?? item?.label ?? item?.code ?? item?.symbol, "");
  if (country && currency) return `${country} - ${currency}`;
  return country || currency || "Currency";
};

export default function CurrencySwitcher({ section }) {
  const { normalized, raw } = useMemo(() => getProps(section), [section]);
  const css = normalized?.presentation?.css || {};
  const currencies = Array.isArray(raw?.currencies) ? raw.currencies : [];
  const initialSelected = str(raw?.selectedCurrency ?? raw?.currency ?? raw?.value, "");
  const [localSelected, setLocalSelected] = useState("");
  const [expanded, setExpanded] = useState(false);
  const selectedValue = localSelected || initialSelected;

  const selected =
    currencies.find((item) => str(item?.currency) === selectedValue) ||
    currencies.find((item) => currencyLabel(item).includes(selectedValue)) ||
    currencies[0] ||
    (selectedValue ? { currency: selectedValue } : null);

  if (!selected) return null;

  const containerCss = omitStyleKeys(convertStyles(css?.container || {}), [
    "cursor",
    "boxSizing",
    "maxWidth",
  ]);
  const leftWrapCss = omitStyleKeys(convertStyles(css?.leftWrap || {}), ["gap"]);
  const flagCss = omitStyleKeys(convertStyles(css?.flag || {}), ["display", "objectFit"]);
  const iconCss = convertStyles(css?.icon || {});
  const countryCss = omitStyleKeys(convertStyles(css?.countryName || {}), ["display"]);
  const currencyCss = omitStyleKeys(convertStyles(css?.currencySymbol || {}), ["display"]);

  const paddingTop = num(raw?.pt, containerCss.paddingTop ?? 12);
  const paddingRight = num(raw?.pr, containerCss.paddingRight ?? 16);
  const paddingBottom = num(raw?.pb, containerCss.paddingBottom ?? 12);
  const paddingLeft = num(raw?.pl, containerCss.paddingLeft ?? 16);
  const bgColor = str(raw?.backgroundColor ?? raw?.bgColor, containerCss.backgroundColor || "#FFFFFF");
  const textColor = str(raw?.textColor, countryCss.color || "#111827");
  const iconColor = str(raw?.iconColor, iconCss.color || "#111827");
  const fontSize = num(raw?.fontSize ?? raw?.textFontSize, countryCss.fontSize || 16);
  const fontFamily = resolveFont(str(raw?.fontFamily ?? raw?.textFontFamily, "")) || countryCss.fontFamily;
  const fontWeight = weight(raw?.fontWeight ?? raw?.textFontWeight, countryCss.fontWeight || "500");
  const rowGap = num(raw?.gap ?? raw?.rowGap, 12);

  const flag = str(selected?.flag, "");
  const country = str(selected?.country ?? selected?.countryName ?? selected?.name, "");
  const currency = str(selected?.currency ?? selected?.label ?? selected?.code ?? selected?.symbol, "");

  const openCurrencyPicker = () => {
    if (currencies.length <= 1) return;
    setExpanded((value) => !value);
  };

  const selectCurrency = (item) => {
    setLocalSelected(str(item?.currency, currencyLabel(item)));
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={openCurrencyPicker}
        style={[
          styles.container,
          containerCss,
          {
            paddingTop,
            paddingRight,
            paddingBottom,
            paddingLeft,
            backgroundColor: bgColor,
            minHeight: num(raw?.height, containerCss.minHeight || 52),
          },
        ]}
      >
        <View style={[styles.leftWrap, leftWrapCss, { gap: rowGap }]}>
          {!!flag && <Text style={[styles.flag, flagCss]}>{flag}</Text>}
          <View style={styles.textWrap}>
            {!!country && (
              <Text
                numberOfLines={1}
                style={[
                  styles.countryName,
                  countryCss,
                  { color: textColor, fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}) },
                ]}
              >
                {country}
              </Text>
            )}
            {!!currency && (
              <Text
                numberOfLines={1}
                style={[
                  styles.currency,
                  currencyCss,
                  {
                    color: str(raw?.currencyColor, currencyCss.color || textColor),
                    fontSize: num(raw?.currencyFontSize, currencyCss.fontSize || fontSize),
                    fontWeight: weight(raw?.currencyFontWeight, currencyCss.fontWeight || fontWeight),
                    ...(fontFamily ? { fontFamily } : {}),
                  },
                ]}
              >
                {currency}
              </Text>
            )}
          </View>
        </View>
        <FontAwesome
          name={expanded ? "angle-up" : "angle-down"}
          size={num(raw?.iconSize, iconCss.fontSize || 18)}
          color={iconColor}
          style={iconCss}
        />
      </TouchableOpacity>

      {expanded && currencies.length > 1 && (
        <View style={[styles.options, { backgroundColor: bgColor }]}>
          {currencies.map((item, index) => (
            <TouchableOpacity
              key={`${currencyLabel(item)}-${index}`}
              activeOpacity={0.7}
              onPress={() => selectCurrency(item)}
              style={[
                styles.optionRow,
                {
                  paddingTop,
                  paddingRight,
                  paddingBottom,
                  paddingLeft,
                  borderTopColor: str(raw?.borderColor, "#E5E7EB"),
                },
              ]}
            >
              {!!str(item?.flag, "") && <Text style={[styles.flag, flagCss]}>{str(item?.flag, "")}</Text>}
              <Text
                numberOfLines={1}
                style={[
                  styles.optionText,
                  countryCss,
                  { color: textColor, fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}) },
                ]}
              >
                {currencyLabel(item)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  flag: {
    fontSize: 16,
    lineHeight: 20,
  },
  textWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
    minWidth: 0,
  },
  countryName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "500",
  },
  currency: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
  },
  options: {
    width: "100%",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    gap: 12,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
});
