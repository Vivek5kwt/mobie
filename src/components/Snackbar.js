import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

/**
 * Snackbar — slides up from the bottom, auto-dismisses.
 *
 * Props:
 *   visible      {boolean}  — show/hide trigger
 *   message      {string}   — main text
 *   actionLabel  {string}   — optional right-side button label
 *   onAction     {function} — called when action button is pressed
 *   onDismiss    {function} — called when snackbar fully hides
 *   duration     {number}   — ms before auto-dismiss (default 2500)
 *   type         {string}   — "success" | "error" | "info"
 */
export default function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 2500,
  type = "success",
}) {
  // Internal show state drives Modal visibility so it stays mounted during animation
  const [modalVisible, setModalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const dismissingRef = useRef(false);

  const runDismiss = (callback) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      dismissingRef.current = false;
      callback?.();
    });
  };

  useEffect(() => {
    if (visible) {
      // Reset dismissing flag and reset values
      dismissingRef.current = false;
      translateY.setValue(120);
      opacity.setValue(0);
      setModalVisible(true);

      // Slide up + fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration
      timerRef.current = setTimeout(() => {
        runDismiss(onDismiss);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const bgColor =
    type === "error" ? "#DC2626" : type === "info" ? "#2563EB" : "#0D9488";
  const iconName =
    type === "error" ? "times-circle" : type === "info" ? "info-circle" : "check-circle";

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={() => runDismiss(onDismiss)}
    >
      {/* Overlay: touch outside snackbar has no effect */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.snackbar,
            {
              backgroundColor: bgColor,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Icon */}
          <FontAwesome name={iconName} size={22} color="#fff" style={styles.icon} />

          {/* Message */}
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>

          {/* Action button */}
          {!!actionLabel && (
            <TouchableOpacity
              onPress={() => runDismiss(() => { onDismiss?.(); onAction?.(); })}
              style={styles.actionBtn}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  snackbar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 10,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  actionBtn: {
    flexShrink: 0,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  actionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
