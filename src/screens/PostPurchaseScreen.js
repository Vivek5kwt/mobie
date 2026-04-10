import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { SafeArea } from "../utils/SafeAreaHandler";
import DynamicRenderer from "../engine/DynamicRenderer";
import Header from "../components/Topheader";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { clearCart } from "../store/slices/cartSlice";
import FontAwesome from "react-native-vector-icons/FontAwesome";

const PAGE_HANDLE = "post-purchase";
const REFRESH_INTERVAL_MS = 5000;

const fingerprint = (sections) => JSON.stringify(sections);

const injectCapturedItems = (sections = [], capturedItems = []) => {
  if (!capturedItems.length) return sections;
  return sections.map((section) => {
    const comp = String(
      section?.component?.const || section?.component || section?.properties?.component?.const || ""
    ).toLowerCase();
    if (comp !== "order_summary") return section;

    // Deep-clone the section and inject items into raw
    const cloned = JSON.parse(JSON.stringify(section));
    const propsNode =
      cloned?.properties?.props?.properties ||
      cloned?.properties?.props ||
      cloned?.props ||
      {};

    const mapped = capturedItems.map((item, idx) => ({
      id: String(item.id || idx + 1),
      qty: item.quantity || 1,
      image: item.image || "",
      price: item.price || 0,
      title: item.title || "Product",
      variant: item.variant || "",
    }));

    // Try to inject into raw.value.items (DSL schema format)
    if (propsNode?.raw?.value !== undefined) {
      propsNode.raw.value = { ...(propsNode.raw.value || {}), items: mapped };
    } else if (propsNode?.raw !== undefined) {
      propsNode.raw = { ...(propsNode.raw || {}), items: mapped };
    }
    return cloned;
  });
};

export default function PostPurchaseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { session } = useAuth();

  // Cart items captured just before checkout completed
  const capturedItems = useMemo(
    () => route?.params?.capturedItems || [],
    [route?.params?.capturedItems]
  );

  const appId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const fingerprintRef = useRef(null);
  const timerRef = useRef(null);

  // Clear cart on mount (checkout is done)
  useEffect(() => {
    dispatch(clearCart());
  }, [dispatch]);

  const loadPage = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const dsl = await fetchDSL(appId, PAGE_HANDLE);
      const incoming = dsl?.sections || [];
      const fp = fingerprint(incoming);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setSections(incoming);
      }
    } catch (_) {
      // ignore
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(false);
    timerRef.current = setInterval(() => loadPage(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [appId]);

  // Inject captured cart items into the order_summary section
  const resolvedSections = useMemo(
    () => injectCapturedItems(sections, capturedItems),
    [sections, capturedItems]
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

          {/* Continue Shopping button */}
          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={styles.continueBtn}
              activeOpacity={0.85}
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: "LayoutScreen" }],
                })
              }
            >
              <FontAwesome name="shopping-bag" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.continueBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  btnWrap: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D9488",
    paddingVertical: 14,
    borderRadius: 12,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
