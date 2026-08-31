import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * @param {string} [backgroundColor] fills the safe-area insets (status-bar
 *   strip, home indicator) too, so a Brand-Kit page background covers the
 *   whole screen edge to edge instead of leaving white bands. Omit to keep
 *   the previous transparent behaviour.
 */
export const SafeArea = ({
  children,
  edges = ["top", "left", "right", "bottom"],
  backgroundColor,
  style,
}) => {
  return (
    <SafeAreaView
      style={[
        { flex: 1, width: "100%", alignSelf: "stretch" },
        backgroundColor ? { backgroundColor } : null,
        style,
      ]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
};
