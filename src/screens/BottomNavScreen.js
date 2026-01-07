import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { SafeArea } from "../utils/SafeAreaHandler";
import BottomNavigation from "../components/BottomNavigation";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";

export default function BottomNavScreen() {
  const route = useRoute();
  const title = route?.params?.title || "Page";
  const link = route?.params?.link || "";
  const pageName = route?.params?.pageName || link || title;
  const bottomNavSectionProp = route?.params?.bottomNavSection || bottomNavigationStyle1Section;
  const activeIndex = route?.params?.activeIndex;
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const getComponentName = (section) =>
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    "";

  const mobileSections = useMemo(
    () => (dsl?.sections || []).filter(shouldRenderSectionOnMobile),
    [dsl]
  );

  const sortedSections = useMemo(() => {
    const sectionsCopy = [...mobileSections];

    return sectionsCopy.sort((a, b) => {
      const A = getComponentName(a);
      const B = getComponentName(b);

      if (A === "header") return -1;
      if (B === "header") return 1;

      if (A === "header_2") return -1;
      if (B === "header_2") return 1;

      return 0;
    });
  }, [mobileSections]);

  const bottomNavSection = useMemo(
    () =>
      sortedSections.find((section) => {
        const component = getComponentName(section).toLowerCase();
        return [
          "bottom_navigation",
          "bottom_navigation_style_1",
          "bottom_navigation_style_2",
        ].includes(component);
      }) || bottomNavSectionProp,
    [bottomNavSectionProp, sortedSections]
  );

  const visibleSections = useMemo(
    () =>
      sortedSections.filter((section) => {
        const component = getComponentName(section).toLowerCase();
        return ![
          "bottom_navigation",
          "bottom_navigation_style_1",
          "bottom_navigation_style_2",
        ].includes(component);
      }),
    [sortedSections]
  );

  useEffect(() => {
    let isMounted = true;

    const loadDSL = async () => {
      try {
        setLoading(true);
        setErr(null);
        const dslData = await fetchDSL(undefined, pageName);
        if (!dslData?.dsl) {
          setErr("No live DSL returned from server");
          return;
        }
        if (isMounted) setDsl(dslData.dsl);
      } catch (error) {
        if (isMounted) setErr(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDSL();

    return () => {
      isMounted = false;
    };
  }, [pageName]);

  return (
    <SafeArea>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loaderText}>Loading {title}...</Text>
          </View>
        ) : err ? (
          <View style={styles.content}>
            <Text style={styles.error}>Error loading: {err}</Text>
            <Text style={styles.linkText}>Please try again.</Text>
          </View>
        ) : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.scrollContent,
              { flexGrow: 1, paddingBottom: bottomNavSection ? 88 : 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {visibleSections.length ? (
              visibleSections.map((section, index) => (
                <View key={index} style={styles.sectionWrapper}>
                  <DynamicRenderer section={section} />
                </View>
              ))
            ) : (
              <View style={styles.content}>
                <Text style={styles.subtitleText}>No content available yet.</Text>
              </View>
            )}
          </ScrollView>
        )}

        {bottomNavSection && (
          <View style={styles.bottomNav}>
            <BottomNavigation section={bottomNavSection} activeIndexOverride={activeIndex} />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  subtitleText: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#64748B",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
  },
  error: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionWrapper: {
    marginBottom: 10,
  },
});
