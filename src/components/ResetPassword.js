import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";
import { resolveFont } from "../services/typographyService";
import { buildResetPasswordTokens } from "../screens/AuthScreen";

// Same generic-passthrough DSL shape Logout.js/CustomButton.js already use
// (Builder's composeLayout-2.ts saves reset_password the same generic way).
const getProps = (section = {}) => {
  const root =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const unwrap = (value) => {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value.map(unwrap);
    if (typeof value !== "object") return value;
    if (value.value !== undefined) return unwrap(value.value);
    if (value.const !== undefined) return unwrap(value.const);
    if (value.properties !== undefined) return unwrap(value.properties);
    return Object.entries(value).reduce((acc, [key, next]) => {
      acc[key] = unwrap(next);
      return acc;
    }, {});
  };
  const flat = unwrap(root) || {};
  const raw = unwrap(flat.raw) || {};
  return typeof raw === "object" && raw !== null ? { ...flat, ...raw } : flat;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const isValidOtp = (value) => /^\d{4}$/.test(String(value || "").trim());

export default function ResetPassword({ section }) {
  const { requestPasswordOtp, resetPasswordWithOtp } = useAuth();
  const navigation = useNavigation();
  const t = buildResetPasswordTokens(getProps(section));

  // "email" -> enter email, request the OTP. "otp" -> enter the code + new
  // password (Create Password step) — same Input/Button style tokens as the
  // email step throughout, only the fields and copy change.
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t.requiredMessage);
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError(t.invalidEmailMessage);
      return;
    }
    try {
      setLoading(true);
      const result = await requestPasswordOtp(trimmed);
      setSuccessMessage(result?.message || t.successMessageText);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorMessageText);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    setError("");
    setSuccessMessage("");
    if (!isValidOtp(otp)) {
      setError("Enter the 4-digit code from your email.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      const result = await resetPasswordWithOtp(email.trim(), otp.trim(), newPassword);
      setSuccessMessage(result?.message || t.successMessageText);
      navigation.navigate("Auth", { initialMode: "login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorMessageText);
    } finally {
      setLoading(false);
    }
  };

  const descriptionFontFamily = resolveFont(t.descriptionFontFamily);
  const inputFontFamily = resolveFont(t.inputFontFamily);
  const buttonFontFamily = resolveFont(t.buttonFontFamily);
  const messageFontFamily = resolveFont(t.messageFontFamily);

  // Reused as-is for every field on the "Create Password" step (otp/new
  // password/confirm password) — same Input styling settings the email
  // field already uses, per the "settings stay the same, only the fields
  // change" requirement.
  const inputStyle = {
    color: t.inputTextColor,
    fontSize: t.inputFontSize,
    fontWeight: t.inputFontWeight,
    height: t.inputHeight,
    paddingHorizontal: t.inputPaddingHorizontal,
    paddingVertical: t.inputPaddingVertical,
    backgroundColor: t.inputBgVisible ? t.inputBgColor : "transparent",
    borderRadius: t.inputBgVisible ? t.inputBorderRadius : 0,
    borderWidth: t.inputBgVisible ? 1 : 0,
    borderColor: t.inputBorderColor,
    ...(inputFontFamily ? { fontFamily: inputFontFamily } : {}),
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.cardBgColor,
          borderRadius: t.cardBorderRadius,
          borderWidth: t.cardBorderWidth,
          borderColor: t.cardBorderColor,
          paddingTop: t.cardPaddingTop,
          paddingBottom: t.cardPaddingBottom,
          paddingLeft: t.cardPaddingLeft,
          paddingRight: t.cardPaddingRight,
        },
      ]}
    >
      {t.headingVisible && (step === "otp" || !!t.headingText) && (
        <Text
          style={[
            styles.heading,
            {
              color: t.descriptionColor,
              fontSize: t.descriptionFontSize,
              fontWeight: t.descriptionFontWeight,
              fontStyle: t.descriptionFontStyle,
              textDecorationLine: t.descriptionTextDecoration,
              lineHeight: t.descriptionFontSize * t.descriptionLineHeight,
              letterSpacing: t.descriptionLetterSpacing,
              textAlign: t.descriptionAlign,
              ...(descriptionFontFamily ? { fontFamily: descriptionFontFamily } : {}),
            },
          ]}
        >
          {step === "otp"
            ? "Enter the code we emailed you and choose a new password."
            : t.headingText}
        </Text>
      )}

      {t.inputVisible && (
        step === "email" ? (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t.inputPlaceholderVisible ? t.emailPlaceholder : ""}
            placeholderTextColor={t.emailPlaceholderColor}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={[styles.input, inputStyle]}
          />
        ) : (
          <>
            <TextInput
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 4))}
              placeholder={t.inputPlaceholderVisible ? "4-digit code" : ""}
              placeholderTextColor={t.emailPlaceholderColor}
              keyboardType="number-pad"
              maxLength={4}
              editable={!loading}
              style={[styles.input, inputStyle]}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t.inputPlaceholderVisible ? "New password" : ""}
              placeholderTextColor={t.emailPlaceholderColor}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              style={[styles.input, inputStyle]}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t.inputPlaceholderVisible ? "Re-enter new password" : ""}
              placeholderTextColor={t.emailPlaceholderColor}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              style={[styles.input, inputStyle]}
            />
          </>
        )
      )}

      {!!error && (
        <View
          style={[
            styles.message,
            { backgroundColor: t.errorMessageBgColor, borderRadius: t.messageBorderRadius },
          ]}
        >
          <Text
            style={{
              color: t.errorMessageTextColor,
              fontSize: t.messageFontSize,
              fontWeight: t.messageFontWeight,
              ...(messageFontFamily ? { fontFamily: messageFontFamily } : {}),
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {!!successMessage && (
        <View
          style={[
            styles.message,
            { backgroundColor: t.successMessageBgColor, borderRadius: t.messageBorderRadius },
          ]}
        >
          <Text
            style={{
              color: t.successMessageTextColor,
              fontSize: t.messageFontSize,
              fontWeight: t.messageFontWeight,
              ...(messageFontFamily ? { fontFamily: messageFontFamily } : {}),
            }}
          >
            {successMessage}
          </Text>
        </View>
      )}

      {t.buttonVisible && (
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading}
          onPress={step === "email" ? handleSubmit : handleVerifyAndReset}
          style={[
            styles.button,
            {
              marginTop: t.buttonMarginTop,
              backgroundColor: t.buttonBgVisible ? t.buttonFillColor : "transparent",
              borderRadius: t.buttonBgVisible ? t.buttonRadius : 0,
              borderWidth: t.buttonBgVisible ? t.buttonBorderWidth : 0,
              borderColor: t.buttonBorderColor,
              paddingTop: t.buttonBgVisible ? t.buttonPaddingTop : 0,
              paddingBottom: t.buttonBgVisible ? t.buttonPaddingBottom : 0,
              paddingLeft: t.buttonBgVisible ? t.buttonPaddingLeft : 0,
              paddingRight: t.buttonBgVisible ? t.buttonPaddingRight : 0,
              opacity: loading ? 0.7 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={t.buttonTextColor} />
          ) : (
            t.buttonTextVisible && (
              <Text
                style={{
                  color: t.buttonTextColor,
                  fontSize: t.buttonFontSize,
                  fontWeight: t.buttonFontWeight,
                  fontStyle: t.buttonFontStyle,
                  textDecorationLine: t.buttonTextDecoration,
                  textTransform: t.buttonUppercase ? "uppercase" : "none",
                  ...(buttonFontFamily ? { fontFamily: buttonFontFamily } : {}),
                }}
              >
                {step === "otp" ? "Reset Password" : t.buttonText}
              </Text>
            )
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  heading: {
    marginBottom: 16,
  },
  input: {
    width: "100%",
    marginBottom: 12,
  },
  message: {
    width: "100%",
    padding: 10,
    marginBottom: 12,
  },
  button: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
