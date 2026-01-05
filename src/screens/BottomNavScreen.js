import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { SafeArea } from "../utils/SafeAreaHandler";
import BottomNavigation from "../components/BottomNavigation";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";

export default function BottomNavScreen() {
  const route = useRoute();
  const title = route?.params?.title || "Page";
  const link = route?.params?.link || "";
  const bottomNavSection = route?.params?.bottomNavSection || bottomNavigationStyle1Section;
  const activeIndex = route?.params?.activeIndex;
  const hasBottomNav = !!bottomNavSection;

  return (
    <SafeArea>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.subtitleText}>You are viewing the {title} page.</Text>
          {link ? (
            <Text style={styles.linkText}>Link: {link}</Text>
          ) : (
            <Text style={styles.linkText}>Link: /{title.toLowerCase()}</Text>
          )}
        </View>

        {hasBottomNav && (
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  titleText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
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
});
