import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fetchShopifyCollectionProducts } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";

const PAGE_SIZE = 20;

export default function CollectionProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { collectionHandle, collectionTitle } = route?.params || {};

  const [products, setProducts] = useState([]);
  const [pageInfo, setPageInfo] = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = useCallback(
    async ({ after = null, append = false } = {}) => {
      if (!collectionHandle) {
        setError("Collection not available.");
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const payload = await fetchShopifyCollectionProducts({
          handle: collectionHandle,
          first: PAGE_SIZE,
          after,
        });
        const nextProducts = payload?.products || [];
        const nextPageInfo = payload?.pageInfo || { hasNextPage: false, endCursor: null };

        setProducts((prev) => (append ? [...prev, ...nextProducts] : nextProducts));
        setPageInfo(nextPageInfo);
      } catch (err) {
        setError("Unable to load products right now. Please try again later.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionHandle]
  );

  useEffect(() => {
    loadProducts({ after: null, append: false });
  }, [loadProducts]);

  const handleLoadMore = () => {
    if (loadingMore || !pageInfo?.hasNextPage) return;
    loadProducts({ after: pageInfo?.endCursor, append: true });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("ProductDetail", {
          product: item,
        })
      }
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>No image</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.name}>
          {item.title}
        </Text>
        <Text style={styles.price}>
          {item.priceCurrency ? `${item.priceCurrency} ` : ""}
          {item.priceAmount || ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>{collectionTitle || "Collection"}</Text>
          </View>

          {loading && <ActivityIndicator size="small" color="#111827" />}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && !error && (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.status}>No products available yet.</Text>
              }
              ListFooterComponent={
                pageInfo?.hasNextPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={handleLoadMore}
                    activeOpacity={0.85}
                    disabled={loadingMore}
                  >
                    <Text style={styles.loadMoreText}>
                      {loadingMore ? "Loading..." : "Load more"}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backIcon: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "600",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  row: {
    justifyContent: "space-between",
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: "#f3f4f6",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#9ca3af",
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  price: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    textAlign: "center",
    color: "#6b7280",
    paddingVertical: 16,
  },
  error: {
    textAlign: "center",
    color: "#b91c1c",
    paddingVertical: 12,
  },
  loadMoreButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#111827",
    marginTop: 8,
  },
  loadMoreText: {
    color: "#111827",
    fontWeight: "600",
  },
});
