import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { SafeArea } from "../utils/SafeAreaHandler";
import DynamicRenderer from "../engine/DynamicRenderer";
import Header from "../components/Topheader";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { clearCart } from "../store/slices/cartSlice";

const PAGE_HANDLE = "post-purchase";
const REFRESH_INTERVAL_MS = 5000;

const fingerprint = (sections) => JSON.stringify(sections);

// Replace {order_number} / {orderNumber} placeholders in any string
const fillPlaceholders = (text, orderNumber) => {
  if (!text || !orderNumber) return text;
  return String(text)
    .replace(/\{order_number\}/gi, orderNumber)
    .replace(/\{orderNumber\}/gi, orderNumber)
    .replace(/\{order\}/gi, orderNumber);
};

// Inject real cart items into order_summary and real order number into confirmation_header
const injectOrderData = (sections = [], capturedItems = [], orderNumber = "", orderTotal = 0) => {
  return sections.map((section) => {
    const comp = String(
      section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      ""
    ).toLowerCase();

    // ── order_summary — inject purchased line items ──────────────────────────
    if (comp === "order_summary" || comp === "price_line" || comp === "cart_summary" || comp === "cart_total") {
      if (!capturedItems.length) return section;
      const cloned = JSON.parse(JSON.stringify(section));
      const propsNode =
        cloned?.properties?.props?.properties ||
        cloned?.properties?.props ||
        cloned?.props ||
        {};

      const mapped = capturedItems.map((item, idx) => ({
        id:      String(item.id || idx + 1),
        qty:     item.quantity || 1,
        image:   item.image || "",
        price:   item.price || 0,
        title:   item.title || "Product",
        variant: item.variant || "",
      }));

      if (propsNode?.raw?.value !== undefined) {
        propsNode.raw.value = { ...(propsNode.raw.value || {}), items: mapped };
      } else if (propsNode?.raw !== undefined) {
        propsNode.raw = { ...(propsNode.raw || {}), items: mapped };
      }
      return cloned;
    }

    // ── confirmation_header — fill real order number ─────────────────────────
    if (
      comp === "confirmation_header" ||
      comp === "order_confirmation" ||
      comp === "confirmation-header"
    ) {
      if (!orderNumber) return section;
      const cloned = JSON.parse(JSON.stringify(section));
      const propsNode =
        cloned?.properties?.props?.properties ||
        cloned?.properties?.props ||
        cloned?.props ||
        {};

      // Resolve where raw lives (DSL envelope may be raw.value or raw directly)
      let rawValue = {};
      if (propsNode?.raw?.value !== undefined) {
        rawValue = propsNode.raw.value || {};
      } else if (propsNode?.raw !== undefined) {
        rawValue = propsNode.raw || {};
      }

      // Fill placeholder in existing subtext, or inject a default one
      const subtextKey = rawValue.subtext !== undefined
        ? "subtext"
        : rawValue.subtextText !== undefined
        ? "subtextText"
        : null;

      if (subtextKey) {
        rawValue[subtextKey] = fillPlaceholders(rawValue[subtextKey], orderNumber);
      } else {
        rawValue.subtext     = `Your Order ${orderNumber} Is Confirmed`;
        rawValue.showSubtext = true;
      }

      // Write back
      if (propsNode?.raw?.value !== undefined) {
        propsNode.raw.value = rawValue;
      } else {
        propsNode.raw = rawValue;
      }
      return cloned;
    }

    return section;
  });
};

export default function PostPurchaseScreen() {
  const route    = useRoute();
  const dispatch = useDispatch();
  const { session } = useAuth();

  const capturedItems = useMemo(
    () => route?.params?.capturedItems || [],
    [route?.params?.capturedItems]
  );

  const orderNumber = route?.params?.orderNumber || "";
  const orderTotal  = route?.params?.orderTotal  || 0;

  const appId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  const [sections, setSections] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const fingerprintRef = useRef(null);
  const timerRef       = useRef(null);

  // Clear cart the moment the purchase confirmation screen mounts
  useEffect(() => {
    dispatch(clearCart());
  }, [dispatch]);

  const loadPage = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const dsl      = await fetchDSL(appId, PAGE_HANDLE);
      const incoming = dsl?.sections || [];
      const fp       = fingerprint(incoming);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setSections(incoming);
      }
    } catch (_) {
      // ignore network errors — keep showing last good DSL
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(false);
    timerRef.current = setInterval(() => loadPage(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [appId]);

  // Merge DSL layout with real order data before rendering
  const resolvedSections = useMemo(
    () => injectOrderData(sections, capturedItems, orderNumber, orderTotal),
    [sections, capturedItems, orderNumber, orderTotal]
  );

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {resolvedSections.map((section, idx) => (
            <DynamicRenderer key={idx} section={section} />
          ))}
        </ScrollView>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flexGrow:      1,
    paddingBottom: 32,
  },
});
