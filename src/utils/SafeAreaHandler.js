import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export const SafeArea = ({ children, edges = ["top", "left", "right", "bottom"] }) => {
  return (
    <SafeAreaView style={{ flex: 1, width: "100%", alignSelf: "stretch" }} edges={edges}>
      {children}
    </SafeAreaView>
  );
};
