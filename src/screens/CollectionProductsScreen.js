import React, { useCallback, useEffect, useState } from "react";
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
import { useDispatch } from "react-redux";
import { fetchShopifyCollectionProducts } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import { addItem } from "../store/slices/cartSlice";
import Header from "../components/Topheader";

const PAGE_SIZE = 20;
const GAP = 12;
const H_PAD = 16;
const { width: SCREEN_W } = Dimensions.get("window");

export default function CollectionProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { collectionHandle, collectionTitle } = route?.params || {};

  const [products, setProducts] = useState([]);
  const [pageInfo, setPageInfo] = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState({});

  const loadProducts = useCallback(
    async ({ after = null, append = false } = {}) => {
      if (!collectionHandle) {
        setError("Collection not available.");
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const payload = await fetchShopifyCollectionProducts({
          handle: collectionHandle,
          first: PAGE_SIZE,
          after,
        });
        const next = payload?.products || [];
        const nextPage = payload?.pageInfo || { hasNextPage: false, endCursor: null };
        setProducts((prev) => (append ? [...prev, ...next] : next));
        setPageInfo(nextPage);
      } catch (_) {
        setError("Unable to load products right now.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionHandle]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddToCart = (product) => {
    dispatch(
      addItem({
        item: {
          id: product.variantId || product.id,
          variantId: product.variantId || "",
          title: product.title || "",
          image: product.imageUrl || "",
          price: parseFloat(product.priceAmount) || 0,
          variant: "",
          currency: product.priceCurrency || "",
          quantity: 1,
        },
      })
    );
  };

  const toggleFav = (id) =>
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderItem = ({ item }) => {
    const inStock = item.availableForSale !== false;
    const isFav = !!favorites[item.id];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate("ProductDetail", { handle: item.handle })
        }
      >
        {/* Product image */}
        <View style={styles.imageWrap}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {(item.title || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Favourite toggle */}
          <TouchableOpacity
            style={styles.favBtn}
            activeOpacity={0.8}
            onPress={() => toggleFav(item.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.favIcon, isFav && styles.favActive]}>
              {isFav ? "♥" : "♡"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.productName}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {parseFloat(item.priceAmount || 0).toFixed(1)}
          </Text>

          {/* Add to Cart / Sold Out */}
          <TouchableOpacity
            style={inStock ? styles.cartBtnActive : styles.cartBtnSoldOut}
            activeOpacity={inStock ? 0.8 : 1}
            disabled={!inStock}
            onPress={() => inStock && handleAddToCart(item)}
          >
            <Text
              style={
                inStock ? styles.cartBtnTextActive : styles.cartBtnTextSoldOut
              }
            >
              {inStock ? "Add To Cart" : "Sold Out"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeArea>
      <View style={styles.container}>
        {/* Header (same as home page — reads from headerdefault config) */}
        <Header />

        <View style={styles.body}>
          {/* Section title row */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {collectionTitle || "Products"}
            </Text>
            {pageInfo.hasNextPage && (
              <TouchableOpacity
                onPress={() =>
                  loadProducts({ after: pageInfo.endCursor, append: true })
                }
              >
                <Text style={styles.viewAll}>View all &gt;</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && (
            <ActivityIndicator
              style={styles.loader}
              size="small"
              color="#016D77"
            />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {!loading && !error && (
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              numColumns={2}
              columnWrapperStyle={{ gap: GAP }}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  No products in this collection.
                </Text>
              }
              ListFooterComponent={
                pageInfo.hasNextPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() =>
                      loadProducts({
                        after: pageInfo.endCursor,
                        append: true,
                      })
                    }
                    disabled={loadingMore}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.loadMoreText}>
                      {loadingMore ? "Loading…" : "Load more"}
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

const CARD_W = (SCREEN_W - H_PAD * 2 - GAP) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  body: {
    flex: 1,
    paddingHorizontal: H_PAD,
    paddingTop: 14,
  },

  // ── Section header row ──────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#016D77",
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#016D77",
  },

  // ── Grid ───────────────────────────────────────────────────────────────────
  list: {
    paddingBottom: 32,
    rowGap: GAP,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    width: CARD_W,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  imageWrap: {
    position: "relative",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F3F4F6",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  favBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  favIcon: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 15,
  },
  favActive: {
    color: "#EF4444",
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#016D77",
    lineHeight: 16,
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  cartBtnActive: {
    marginTop: 4,
    backgroundColor: "#111111",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  cartBtnSoldOut: {
    marginTop: 4,
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  cartBtnTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cartBtnTextSoldOut: {
    fontSize: 11,
    fontWeight: "600",
    color: "#016D77",
  },

  // ── States ─────────────────────────────────────────────────────────────────
  loader: {
    marginTop: 32,
  },
  error: {
    textAlign: "center",
    color: "#B91C1C",
    paddingVertical: 12,
  },
  empty: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 32,
    fontSize: 14,
  },
  loadMoreBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: "#111111",
    marginTop: 12,
    marginBottom: 8,
  },
  loadMoreText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
});
