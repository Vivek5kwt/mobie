import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { fetchShopifyProducts } from "../services/shopify";

export default function ProductGrid({ section }) {
  const props = section?.properties?.props?.properties || {};

  const title = props?.title?.value || "";
  const titleSize = props?.titleSize?.value || 18;
  const alignText = (props?.alignText?.value || "Left").toLowerCase();

  const limit =
    props?.limit?.value ||
    props?.productCount?.value ||
    props?.productsToShow?.value ||
    4;

  const favEnabled =
    props?.favEnabled?.value ||
    props?.showFavorite?.value ||
    props?.showFavoriteIcon?.value ||
    false;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const FALLBACK_PRODUCTS = [
    {
      id: "demo-1",
      name: "Demo Hat",
      image:
        "https://images.unsplash.com/photo-1504595403659-9088ce801e29?auto=format&fit=crop&w=400&q=80",
      price: "14.99",
      currency: "USD",
    },
    {
      id: "demo-2",
      name: "Demo Sunglasses",
      image:
        "https://images.unsplash.com/photo-1465805139202-a644e217f00e?auto=format&fit=crop&w=400&q=80",
      price: "29.00",
      currency: "USD",
    },
    {
      id: "demo-3",
      name: "Demo Backpack",
      image:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80",
      price: "54.00",
      currency: "USD",
    },
    {
      id: "demo-4",
      name: "Demo Sneakers",
      image:
        "https://images.unsplash.com/photo-1521093470119-a3acdc43374b?auto=format&fit=crop&w=400&q=80",
      price: "79.00",
      currency: "USD",
    },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        const response = await fetchShopifyProducts(limit);

        if (isMounted) {
          // Use fallback demo products when API returns nothing or fails
          const nextProducts = response?.length ? response : FALLBACK_PRODUCTS;
          setProducts(nextProducts);
        }
      } catch (error) {
        if (isMounted) setProducts(FALLBACK_PRODUCTS);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [limit]);

  return (
    <View style={styles.wrapper}>
      {!!title && (
        <Text
          style={{
            fontSize: titleSize,
            fontWeight: "700",
            marginBottom: 12,
            textAlign: alignText,
          }}
        >
          {title}
        </Text>
      )}

      {loading && !products.length ? (
        <Text style={styles.statusText}>Loading products...</Text>
      ) : (
        <View style={styles.grid}>
          {products.map((item) => (
            <View key={item.id} style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.image} />

              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>

              <Text style={styles.price}>
                {item.currency} {item.price}
              </Text>

              {favEnabled && (
                <TouchableOpacity style={styles.favIcon}>
                  <Icon name="heart" size={18} color="red" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { padding: 12 },
  statusText: { textAlign: "center", color: "#666" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 12,
    position: "relative",
  },
  image: {
    width: "100%",
    height: 130,
    backgroundColor: "#eee",
    borderRadius: 8,
  },
  name: { marginTop: 5 },
  price: { marginTop: 4, fontWeight: "bold" },
  favIcon: { position: "absolute", top: 10, right: 10 },
});
