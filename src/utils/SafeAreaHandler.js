import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export const SafeArea = ({ children, edges = ["top", "left", "right", "bottom"] }) => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      {children}
    </SafeAreaView>
  );
};
