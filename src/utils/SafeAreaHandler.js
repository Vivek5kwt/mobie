import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export const SafeArea = ({ children }) => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
};
