import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Linking, StyleSheet, Text, View } from "react-native";
import { getBuildStatus } from "../services/buildService";
import { resolveAppId } from "../utils/appId";

const APP_ID = resolveAppId();

export default function BuildStatusScreen() {
  const [status, setStatus] = useState("LOADING");
  const [apkUrl, setApkUrl] = useState(null);
  const [error, setError] = useState(null);
  const pollerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await getBuildStatus(APP_ID);
      const nextStatus = result?.status || "UNKNOWN";

      setStatus(nextStatus);
      setApkUrl(result?.apkUrl || null);
      setError(null);

      if (nextStatus === "SUCCESS" || nextStatus === "FAILED") {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    } catch (e) {
      setError("Unable to fetch build status");
      setStatus("ERROR");
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    pollerRef.current = setInterval(fetchStatus, 5000);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [fetchStatus]);

  const handleDownload = useCallback(() => {
    if (apkUrl) {
      Linking.openURL(apkUrl);
    }
  }, [apkUrl]);

  let content = (
    <Text style={styles.message}>Checking build status...</Text>
  );

  if (status === "BUILDING") {
    content = <Text style={styles.message}>Build in progress</Text>;
  }

  if (status === "SUCCESS") {
    content = (
      <View style={styles.content}>
        <Text style={styles.message}>Build ready</Text>
        {apkUrl ? (
          <Button title="Download APK" onPress={handleDownload} />
        ) : (
          <Text style={styles.subtle}>Download link unavailable</Text>
        )}
      </View>
    );
  }

  if (status === "FAILED") {
    content = <Text style={styles.error}>Build failed. Please try again.</Text>;
  }

  if (status === "ERROR") {
    content = (
      <View style={styles.content}>
        <Text style={styles.error}>{error || "Unable to fetch build status"}</Text>
        <Button title="Retry" onPress={fetchStatus} />
      </View>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  message: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 12,
  },
  error: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    marginBottom: 12,
  },
  subtle: {
    color: "#666",
    fontSize: 14,
  },
});
