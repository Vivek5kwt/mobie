import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { resolveFont } from "../services/typographyService";
import { useAuth } from "../services/AuthContext";
import { useStore } from "../services/StoreContext";
import {
  fetchShopifyCurrencies,
  loadSelectedCurrency,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  saveSelectedCurrency,
} from "../services/currencyService";

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
  const resolved = deepUnwrap(item);
  if (typeof resolved === "string") return resolved;
  const country = str(item?.country ?? item?.countryName ?? item?.name, "");
  const currency = str(item?.currency ?? item?.label ?? item?.code ?? item?.symbol, "");
  if (country && currency) return `${country} - ${currency}`;
  return country || currency || "Currency";
};

const currencyValue = (item = {}) => normalizeCurrencyCode(
  typeof deepUnwrap(item) === "string"
    ? deepUnwrap(item)
    : item?.currency ?? item?.code ?? item?.currencyCode ?? item?.symbol ?? item?.label
);

export default function CurrencySwitcher({ section }) {
  const { session } = useAuth();
  const { store, loading: storeLoading } = useStore();
  const { normalized, raw } = useMemo(() => getProps(section), [section]);
  const css = normalized?.presentation?.css || {};
  const dslCurrencies = useMemo(() => normalizeCurrencyList(raw?.currencies), [raw?.currencies]);
  const initialSelected = str(raw?.selectedCurrency ?? raw?.currency ?? raw?.value, "");
  const [apiCurrencies, setApiCurrencies] = useState([]);
  const [persistedSelected, setPersistedSelected] = useState("");
  const [localSelected, setLocalSelected] = useState("");
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selectedValue =
    localSelected ||
    persistedSelected ||
    initialSelected ||
    str(session?.user?.currency, "") ||
    str(store?.currency, "");
  const currencies = apiCurrencies.length ? apiCurrencies : dslCurrencies;
  const selectedCode = normalizeCurrencyCode(selectedValue);

  const selected =
    currencies.find((item) => currencyValue(item) === selectedCode) ||
    currencies.find((item) => currencyLabel(item).toLowerCase().includes(String(selectedValue).toLowerCase())) ||
    currencies[0] ||
    (selectedValue ? { currency: selectedCode || selectedValue, code: selectedCode || selectedValue } : null);

  const canLoadFromSession =
    !!(session?.user?.shopifyDomain && session?.user?.storeAccessToken) ||
    !!(session?.user?.shopify_domain && session?.user?.access_token);

  useEffect(() => {
    let active = true;

    if (storeLoading && !canLoadFromSession) {
      setLoadingCurrencies(true);
      return () => { active = false; };
    }

    const loadCurrencies = async () => {
      setLoadingCurrencies(true);
      setErrorMessage("");

      try {
        const [savedCurrency, fetchedCurrencies] = await Promise.all([
          loadSelectedCurrency({ session, store }),
          fetchShopifyCurrencies({ session, store }),
        ]);

        if (!active) return;
        setPersistedSelected(savedCurrency);
        setApiCurrencies(fetchedCurrencies);
      } catch (error) {
        if (!active) return;
        setApiCurrencies([]);
        setErrorMessage(error?.message || "Unable to load currencies.");
        try {
          const savedCurrency = await loadSelectedCurrency({ session, store });
          if (active) setPersistedSelected(savedCurrency);
        } catch (_) {}
      } finally {
        if (active) setLoadingCurrencies(false);
      }
    };

    loadCurrencies();
    return () => { active = false; };
  }, [
    canLoadFromSession,
    session?.user?.id,
    session?.user?.email,
    session?.user?.appId,
    session?.user?.storeId,
    session?.user?.shopifyDomain,
    session?.user?.shopify_domain,
    session?.user?.storeAccessToken,
    session?.user?.access_token,
    store?.id,
    store?.shopify_domain,
    store?.access_token,
    storeLoading,
  ]);

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

  const openCurrencyPicker = useCallback(() => {
    if (loadingCurrencies || saving || currencies.length < 1) return;
    setExpanded((value) => !value);
  }, [currencies.length, loadingCurrencies, saving]);

  const selectCurrency = async (item) => {
    const nextCurrency = currencyValue(item) || currencyLabel(item);
    if (!nextCurrency) return;
    setLocalSelected(nextCurrency);
    setExpanded(false);
    setSaving(true);
    setErrorMessage("");

    try {
      const saved = await saveSelectedCurrency({ session, store, currency: nextCurrency });
      setPersistedSelected(saved);
    } catch (error) {
      setErrorMessage(error?.message || "Unable to save selected currency.");
    } finally {
      setSaving(false);
    }
  };

  const loadingLabel = str(raw?.loadingText, "Loading currencies...");
  const emptyLabel = str(raw?.emptyText, "No currencies available.");
  const errorLabel = str(raw?.errorText, "Unable to load currencies.");
  const singleCurrencyLabel = str(
    raw?.singleCurrencyText ?? raw?.singleOptionText ?? raw?.onlyCurrencyText,
    "Only one currency option is available."
  );
  const stateText = loadingCurrencies && !selected
    ? loadingLabel
    : errorMessage && !selected
      ? errorLabel
      : !selected
        ? emptyLabel
        : "";

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
        {stateText ? (
          <View style={[styles.leftWrap, leftWrapCss, { gap: rowGap }]}>
            {loadingCurrencies && <ActivityIndicator size="small" color={iconColor} />}
            <Text
              numberOfLines={1}
              style={[
                styles.countryName,
                countryCss,
                { color: textColor, fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}) },
              ]}
            >
              {stateText}
            </Text>
          </View>
        ) : (
          <>
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
            {saving ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <FontAwesome
                name={expanded ? "angle-up" : "angle-down"}
                size={num(raw?.iconSize, iconCss.fontSize || 18)}
                color={iconColor}
                style={iconCss}
              />
            )}
          </>
        )}
      </TouchableOpacity>

      {!!errorMessage && !!selected && (
        <Text
          numberOfLines={2}
          style={[
            styles.message,
            { color: str(raw?.errorColor, "#B91C1C"), fontSize: num(raw?.messageFontSize, 12) },
          ]}
        >
          {errorMessage}
        </Text>
      )}

      {expanded && currencies.length > 0 && (
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
              {currencyValue(item) === currencyValue(selected) && (
                <FontAwesome name="check" size={num(raw?.selectedIconSize, 14)} color={iconColor} />
              )}
            </TouchableOpacity>
          ))}
          {currencies.length === 1 && (
            <Text
              numberOfLines={2}
              style={[
                styles.singleOptionHint,
                {
                  color: str(raw?.messageColor ?? raw?.helperTextColor, "#6B7280"),
                  fontSize: num(raw?.messageFontSize ?? raw?.helperTextFontSize, 12),
                  paddingRight,
                  paddingLeft,
                },
              ]}
            >
              {singleCurrencyLabel}
            </Text>
          )}
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
  singleOptionHint: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  message: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});
