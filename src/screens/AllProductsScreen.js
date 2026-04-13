import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fetchShopifyProductsPage } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";
import FilterSortHeader from "../components/FilterSortHeader";

const GAP = 12;
const H_PAD = 16;
const { width: SCREEN_W } = Dimensions.get("window");

function sortProducts(products, sortKey) {
  const copy = [...products];
  switch (sortKey) {
    case "Price: Low":
      return copy.sort((a, b) => parseFloat(a.priceAmount || 0) - parseFloat(b.priceAmount || 0));
    case "Price: High":
      return copy.sort((a, b) => parseFloat(b.priceAmount || 0) - parseFloat(a.priceAmount || 0));
    case "Newest":
      return copy.reverse();
    default:
      return copy;
  }
}

const PAGE_SIZE = 20;

export default function AllProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { title, detailSections } = route?.params || {};

  const [products, setProducts]       = useState([]);
  const [pageInfo, setPageInfo]       = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState("");
  const [sortKey, setSortKey]         = useState("Popular");
  const [viewMode, setViewMode]       = useState("grid");

  const numColumns = viewMode === "list" ? 1 : 2;
  const CARD_W = viewMode === "list"
    ? SCREEN_W - H_PAD * 2
    : (SCREEN_W - H_PAD * 2 - GAP) / 2;

  const loadProducts = useCallback(async ({ after = null, append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const payload = await fetchShopifyProductsPage({
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
  }, []);

  useEffect(() => {
    loadProducts({ after: null, append: false });
  }, [loadProducts]);

  const handleLoadMore = () => {
    if (loadingMore || !pageInfo?.hasNextPage) return;
    loadProducts({ after: pageInfo?.endCursor, append: true });
  };

  const displayProducts = useMemo(() => sortProducts(products, sortKey), [products, sortKey]);

  const renderItem = ({ item }) => {
    const isListMode = viewMode === "list";
    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_W }, isListMode && styles.cardList]}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate("ProductDetail", { product: item, detailSections })
        }
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.image, isListMode && styles.imageList]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, isListMode && styles.imageList, styles.placeholder]}>
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text numberOfLines={isListMode ? 1 : 2} style={styles.name}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {item.priceCurrency ? `${item.priceCurrency} ` : ""}
            {item.priceAmount || ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} />
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
            <Text style={styles.heading}>{title || "Products"}</Text>
          </View>
        </View>

        {/* Filter + Sort bar */}
        <FilterSortHeader
          section={{}}
          onSortChange={(opt) => setSortKey(opt)}
          onViewModeChange={(mode) => setViewMode(mode)}
        />

        <View style={styles.listArea}>
          {loading && <ActivityIndicator size="small" color="#111827" />}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && !error && (
            <FlatList
              key={`cols-${numColumns}`}
              data={displayProducts}
              keyExtractor={(item) => item.id}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.status}>No products available yet.</Text>}
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  cardList: {
    flexDirection: "row",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: "#f3f4f6",
  },
  imageList: {
    width: 100,
    height: 100,
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
    flex: 1,
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
