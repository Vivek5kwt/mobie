import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFont } from "../services/typographyService";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toString = (value, fallback = "") => {
  const r = unwrapValue(value, fallback);
  return r === undefined || r === null ? fallback : String(r);
};

const toNumber = (value, fallback) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === null || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(String(r));
  return Number.isNaN(p) ? fallback : p;
};

const getPropsNode = (section) =>
  section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

export default function WriteReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const section = route?.params?.section || {};
  const propsNode = getPropsNode(section);
  const rawValue = unwrapValue(propsNode?.raw, {});
  const raw = { ...(propsNode || {}), ...(rawValue || {}) };

  const writeForm = unwrapValue(raw?.writeReviewForm, {});
  const css = unwrapValue(unwrapValue(propsNode?.presentation, {})?.css, {});

  const formTitle = toString(writeForm?.title ?? raw?.writeReviewTitle, "Write a Review");
  const selectRatingLabel = toString(writeForm?.selectRatingLabel, "Select Rating");
  const addReviewLabel = toString(writeForm?.addReviewLabel, "Add Review");
  const nameLabel = toString(writeForm?.nameLabel, "Your Name");
  const emailLabel = toString(writeForm?.emailLabel, "Your Email");
  const reviewLabel = toString(writeForm?.reviewLabel, "Write your review...");
  const mediaLabel = toString(writeForm?.mediaLabel, "Share a video or photo");
  const mediaButtonText = toString(writeForm?.mediaButtonText, "Add photo or video");
  const submitText = toString(writeForm?.submitText, "Submit Review");
  const namePlaceholder = toString(writeForm?.namePlaceholder, "Enter your name");
  const emailPlaceholder = toString(writeForm?.emailPlaceholder, "Enter your email");
  const reviewPlaceholder = toString(writeForm?.reviewPlaceholder, "Write your review...");
  const borderRadius = toNumber(writeForm?.borderRadius ?? raw?.borderRadius, 6);
  const starSize = toNumber(writeForm?.starSize ?? raw?.iconSize, 22);
  const bgColor = toString(writeForm?.backgroundColor ?? raw?.backgroundColor, "#FFFFFF");
  const borderColor = toString(writeForm?.borderColor ?? raw?.borderColor ?? css?.borderColor, "#D1D5DB");
  const textColor = toString(writeForm?.textColor ?? css?.textColor, "#111827");
  const mutedColor = toString(writeForm?.mutedColor, "#6B7280");
  const starColor = toString(writeForm?.starColor ?? raw?.iconColor, "#D1D5DB");
  const starActiveColor = toString(writeForm?.starActiveColor ?? raw?.borderColor, "#008B8B");
  const fontFamily = resolveFont(toString(writeForm?.fontFamily ?? raw?.fontFamily, "")) || undefined;

  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [review, setReview] = useState("");

  const formStyles = useMemo(
    () => ({
      container: {
        backgroundColor: bgColor,
      },
      label: {
        color: textColor,
        ...(fontFamily ? { fontFamily } : {}),
      },
      input: {
        borderColor,
        borderRadius,
        color: textColor,
        ...(fontFamily ? { fontFamily } : {}),
      },
      muted: {
        color: mutedColor,
        ...(fontFamily ? { fontFamily } : {}),
      },
    }),
    [bgColor, borderColor, borderRadius, textColor, mutedColor, fontFamily]
  );

  return (
    <ScrollView style={[styles.screen, formStyles.container]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Text style={[styles.backText, formStyles.label]}>{"\u2190 Back"}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, formStyles.label]}>{formTitle}</Text>

      <Text style={[styles.sectionLabel, formStyles.label]}>{selectRatingLabel}</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity key={value} onPress={() => setRating(value)} activeOpacity={0.8}>
            <FontAwesome
              name="star"
              size={starSize}
              color={value <= rating ? starActiveColor : starColor}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, styles.blockTop, formStyles.label]}>{addReviewLabel}</Text>

      <Text style={[styles.fieldLabel, formStyles.label]}>{nameLabel}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={namePlaceholder}
        placeholderTextColor={mutedColor}
        style={[styles.input, formStyles.input]}
      />

      <Text style={[styles.fieldLabel, formStyles.label]}>{emailLabel}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={emailPlaceholder}
        placeholderTextColor={mutedColor}
        style={[styles.input, formStyles.input]}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        value={review}
        onChangeText={setReview}
        placeholder={reviewPlaceholder}
        placeholderTextColor={mutedColor}
        style={[styles.textarea, formStyles.input]}
        multiline
      />

      <Text style={[styles.fieldLabel, styles.blockTop, formStyles.label]}>{mediaLabel}</Text>
      <View style={[styles.mediaBox, { borderColor, borderRadius }]}>
        <Text style={[styles.mediaText, formStyles.muted]}>{mediaButtonText}</Text>
      </View>

      <TouchableOpacity style={[styles.submitBtn, { borderColor, borderRadius }]} activeOpacity={0.85}>
        <Text style={[styles.submitText, formStyles.muted]}>{submitText}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backText: {
    fontSize: 18,
    marginBottom: 18,
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: "600",
  },
  blockTop: {
    marginTop: 18,
  },
  starRow: {
    marginTop: 8,
    flexDirection: "row",
  },
  star: {
    marginRight: 12,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  textarea: {
    borderWidth: 0,
    minHeight: 140,
    marginTop: 12,
    paddingHorizontal: 0,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 20,
  },
  mediaBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  mediaText: {
    fontSize: 16,
  },
  submitBtn: {
    borderWidth: 1,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  submitText: {
    fontSize: 16,
  },
});
