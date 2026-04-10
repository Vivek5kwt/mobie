import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";

const SETTINGS_ITEMS = [
  {
    id: "faq-testimonials",
    label: "FAQ & Testimonials",
    icon: "question-circle",
    description: "Frequently asked questions & customer reviews",
    pageName: "faq-testimonials",
  },
  {
    id: "about-us",
    label: "About Us",
    icon: "info-circle",
    description: "Learn more about our brand and story",
    pageName: "about-us",
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation();

  const handleItemPress = (item) => {
    navigation.navigate("BottomNavScreen", {
      pageName: item.pageName,
      title: item.label,
      hideBottomNav: true,
    });
  };

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} />

        {/* Page header row */}
        <View style={styles.pageHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome name="angle-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        {/* Options list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MORE</Text>
          {SETTINGS_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.row,
                index < SETTINGS_ITEMS.length - 1 && styles.rowBorder,
              ]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              {/* Left icon */}
              <View style={styles.iconWrap}>
                <FontAwesome name={item.icon} size={20} color="#0D9488" />
              </View>

              {/* Label + description */}
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {!!item.description && (
                  <Text style={styles.rowDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
              </View>

              {/* Chevron */}
              <FontAwesome name="angle-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  // ── Page header ────────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  backBtn: {
    paddingRight: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  // ── Section ────────────────────────────────────────────────────────────────
  section: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },

  // ── Row ────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  rowDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
